-- =========================================================
-- GesIT — 027 Nome de exibição dos usuários do sistema
-- =========================================================
-- Usuário do sistema = quem faz login (auth.users). Até aqui o nome vinha só
-- de raw_user_meta_data (full_name/name), lido por usuarios_sistema (017) e
-- nome_curto_usuario (023, avisos do Telegram). Não há tabela de perfil.
--
-- - perfis_usuarios: nome de exibição cadastrado no GesIT (Administração >
--   Usuários). auth.users não é alterada (o schema auth é do Supabase).
-- - Ordem do nome, em todo lugar: perfis_usuarios → full_name/name do
--   Supabase → (só onde já era assim) parte do e-mail antes do @.
-- - usuarios_sistema e nome_curto_usuario: mesmas assinaturas (create or
--   replace), agora lendo perfis_usuarios primeiro. Quem já as usa (app,
--   tela Início, aviso de urgente no Telegram) passa a mostrar o nome sem
--   mudança. nome_curto_usuario ganha o mesmo fallback do app: parte do
--   e-mail antes do @ com iniciais maiúsculas ("joao.sousa-4" → "Joao Sousa 4").
-- - usuarios_administracao(): lista da tela de administração (e-mail,
--   nomes, último acesso). Sem telefone, metadados nem dados de login.
-- - definir_nome_usuario(usuario, nome): única escrita (security definer).
--   Sem perfis de acesso por enquanto: qualquer usuário logado pode editar;
--   cada mudança vai para a auditoria (trigger da 012).
--
-- Tudo em uma transação: se algo falhar, nada é aplicado.
begin;

-- ---------------------------------------------------------
-- 1. Tabela
-- ---------------------------------------------------------
create table public.perfis_usuarios (
  id            uuid primary key references auth.users (id) on delete cascade,
  nome_exibicao text not null
    constraint perfis_usuarios_nome_valido
      check (nome_exibicao = btrim(nome_exibicao) and char_length(nome_exibicao) between 1 and 100),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

comment on table public.perfis_usuarios is
  'Nome de exibição dos usuários do sistema (auth.users). Escrita só por definir_nome_usuario.';

create trigger trg_perfis_usuarios_upd before update on public.perfis_usuarios
  for each row execute function public.set_updated_at();

alter table public.perfis_usuarios enable row level security;

create policy ti_select on public.perfis_usuarios for select to authenticated using (true);

revoke all on public.perfis_usuarios from anon;
revoke insert, update, delete, truncate on public.perfis_usuarios from authenticated;

-- ---------------------------------------------------------
-- 2. Auditoria (quem alterou, nome antigo e novo)
-- ---------------------------------------------------------
alter table public.auditoria drop constraint auditoria_tabela_valida;
alter table public.auditoria add constraint auditoria_tabela_valida
  check (tabela in ('lojas', 'colaboradores', 'dispositivos', 'vinculos', 'servicos',
                    'servicos_financeiros', 'lancamentos',
                    'kanban_colunas', 'kanban_categorias', 'kanban_atividades',
                    'dispositivo_imagens', 'kanban_comentarios',
                    'perfis_usuarios'));

create trigger trg_auditoria after insert or update on public.perfis_usuarios
  for each row execute function public.registrar_auditoria();

-- ---------------------------------------------------------
-- 3. usuarios_sistema (017): mesma assinatura; nome do perfil primeiro
-- ---------------------------------------------------------
create or replace function public.usuarios_sistema()
returns table (id uuid, email text, nome text)
language sql
stable
security definer
set search_path = ''
as $$
  select u.id,
         u.email::text,
         coalesce(
           p.nome_exibicao,
           nullif(btrim(coalesce(u.raw_user_meta_data ->> 'full_name',
                                 u.raw_user_meta_data ->> 'name')), ''))
    from auth.users u
    left join public.perfis_usuarios p on p.id = u.id
   where u.email is not null
     and (u.deleted_at is null
          or exists (select 1 from public.kanban_atividades a where a.responsavel_id = u.id))
   order by u.email;
$$;

revoke execute on function public.usuarios_sistema() from public, anon;
grant  execute on function public.usuarios_sistema() to authenticated;

-- ---------------------------------------------------------
-- 4. nome_curto_usuario (023, Telegram): mesma assinatura; perfil primeiro
--    e o fallback do app (e-mail antes do @, iniciais maiúsculas).
-- ---------------------------------------------------------
create or replace function public.nome_curto_usuario(p_id uuid)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
           p.nome_exibicao,
           nullif(btrim(coalesce(u.raw_user_meta_data ->> 'full_name',
                                 u.raw_user_meta_data ->> 'name')), ''),
           nullif(initcap(btrim(regexp_replace(split_part(u.email::text, '@', 1), '[._-]+', ' ', 'g'))), ''))
    from auth.users u
    left join public.perfis_usuarios p on p.id = u.id
   where u.id = p_id;
$$;

revoke execute on function public.nome_curto_usuario(uuid) from public, anon, authenticated;

-- ---------------------------------------------------------
-- 5. Lista da tela Administração > Usuários
--    Só e-mail, nomes e datas (último acesso e cadastro). Sem excluídos.
-- ---------------------------------------------------------
create or replace function public.usuarios_administracao()
returns table (
  id            uuid,
  email         text,
  nome_exibicao text,
  nome_supabase text,
  ultimo_acesso timestamptz,
  criado_em     timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select u.id,
         u.email::text,
         p.nome_exibicao,
         nullif(btrim(coalesce(u.raw_user_meta_data ->> 'full_name',
                               u.raw_user_meta_data ->> 'name')), ''),
         u.last_sign_in_at,
         u.created_at
    from auth.users u
    left join public.perfis_usuarios p on p.id = u.id
   where u.email is not null
     and u.deleted_at is null
   order by lower(coalesce(p.nome_exibicao, u.email::text));
$$;

revoke execute on function public.usuarios_administracao() from public, anon;
grant  execute on function public.usuarios_administracao() to authenticated;

-- ---------------------------------------------------------
-- 6. Gravar o nome (única escrita)
--    Hoje qualquer usuário logado pode editar (não há perfis de acesso);
--    a auditoria registra quem alterou, o nome antigo e o novo.
-- ---------------------------------------------------------
create or replace function public.definir_nome_usuario(p_usuario uuid, p_nome text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_nome text := btrim(p_nome);
begin
  if auth.uid() is null then
    raise exception 'Não autenticado' using errcode = '42501';
  end if;
  if coalesce(v_nome, '') = '' then
    raise exception 'Informe o nome de exibição.';
  end if;
  if char_length(v_nome) > 100 then
    raise exception 'O nome deve ter no máximo 100 caracteres.';
  end if;
  if not exists (
    select 1 from auth.users where id = p_usuario and deleted_at is null
  ) then
    raise exception 'Usuário não encontrado. Atualize a página.';
  end if;

  -- Sem mudança de fato, nada é gravado (e nada vai para o log).
  insert into public.perfis_usuarios (id, nome_exibicao)
  values (p_usuario, v_nome)
  on conflict (id) do update
     set nome_exibicao = excluded.nome_exibicao
   where public.perfis_usuarios.nome_exibicao is distinct from excluded.nome_exibicao;
end $$;

revoke execute on function public.definir_nome_usuario(uuid, text) from public, anon;
grant  execute on function public.definir_nome_usuario(uuid, text) to authenticated;

notify pgrst, 'reload schema';

commit;

-- ---------------------------------------------------------
-- Conferências (rode depois, no SQL Editor)
-- ---------------------------------------------------------
-- 1) Lista da administração (e-mail, nomes e datas)
-- select * from public.usuarios_administracao();
--
-- 2) Nome usado no app e no Telegram para cada usuário
-- select s.email, s.nome as nome_app, public.nome_curto_usuario(s.id) as nome_telegram
--   from public.usuarios_sistema() s;
--
-- 3) Sem escrita direta (esperado: nenhuma linha)
-- select grantee, privilege_type from information_schema.role_table_grants
--  where table_schema = 'public' and table_name = 'perfis_usuarios'
--    and grantee in ('anon', 'authenticated')
--    and privilege_type in ('INSERT', 'UPDATE', 'DELETE', 'TRUNCATE');
