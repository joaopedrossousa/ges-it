-- =========================================================
-- GesIT — 012 Log de auditoria
-- =========================================================
-- Registra inserções e alterações em lojas, colaboradores, dispositivos,
-- vinculos e servicos, com quem fez (auth.uid()), quando e o que mudou.
--
-- A trigger é security definer: grava no log mesmo que o usuário não tenha
-- permissão de escrita nele. auth.uid() lê a claim do JWT da requisição, por
-- isso o autor fica certo também quando a alteração vem das funções
-- vincular_dispositivo, devolver_dispositivo e anexar_termo (que também são
-- security definer). Alterações feitas fora do app (SQL Editor, service_role)
-- ficam com alterado_por nulo.
--
-- Tudo em uma transação: se algo falhar, nada é aplicado.
begin;

-- ---------------------------------------------------------
-- 1. Tabela
-- ---------------------------------------------------------
create table public.auditoria (
  id               bigserial primary key,
  tabela           text not null
    constraint auditoria_tabela_valida
      check (tabela in ('lojas', 'colaboradores', 'dispositivos', 'vinculos', 'servicos')),
  registro_id      uuid not null,
  acao             text not null
    constraint auditoria_acao_valida check (acao in ('insercao', 'alteracao')),
  alterado_por     uuid default auth.uid(),
  alterado_em      timestamptz not null default now(),
  -- Só os campos que mudaram. Na inserção, antes é nulo e depois traz os
  -- campos preenchidos. CPF já gravado mascarado (***.456.789-**).
  antes            jsonb,
  depois           jsonb,
  campos_alterados text[] not null default '{}'
);

comment on table public.auditoria is
  'Log de inserções e alterações (trigger registrar_auditoria). Somente leitura para a aplicação.';

create index idx_auditoria_registro on public.auditoria (tabela, registro_id, alterado_em desc);
create index idx_auditoria_data     on public.auditoria (alterado_em desc);
create index idx_auditoria_usuario  on public.auditoria (alterado_por, alterado_em desc);

-- ---------------------------------------------------------
-- 2. RLS: só leitura para authenticated; ninguém escreve direto
-- ---------------------------------------------------------
alter table public.auditoria enable row level security;

create policy ti_select on public.auditoria for select to authenticated using (true);

revoke insert, update, delete, truncate on public.auditoria from anon, authenticated;
revoke select on public.auditoria from anon;
revoke all on sequence public.auditoria_id_seq from anon, authenticated;

-- ---------------------------------------------------------
-- 3. Trigger genérica
--    Ignora updated_at (e, na inserção, id e created_at). Update sem
--    mudança real não gera linha. CPF mascarado antes de gravar.
-- ---------------------------------------------------------
create or replace function public.registrar_auditoria() returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_novo   jsonb := to_jsonb(new) - 'updated_at';
  v_antigo jsonb;
  v_antes  jsonb := '{}';
  v_depois jsonb := '{}';
  v_campos text[] := '{}';
  v_chave  text;
  v_cpf    text;
begin
  if tg_op = 'INSERT' then
    v_depois := jsonb_strip_nulls(v_novo - 'id' - 'created_at');
    select coalesce(array_agg(k order by k), '{}') into v_campos
      from jsonb_object_keys(v_depois) as k;
  else
    v_antigo := to_jsonb(old) - 'updated_at';
    for v_chave in select jsonb_object_keys(v_novo) loop
      if v_novo -> v_chave is distinct from v_antigo -> v_chave then
        v_antes  := v_antes  || jsonb_build_object(v_chave, v_antigo -> v_chave);
        v_depois := v_depois || jsonb_build_object(v_chave, v_novo -> v_chave);
        v_campos := v_campos || v_chave;
      end if;
    end loop;
    if cardinality(v_campos) = 0 then
      return null; -- nada mudou de fato
    end if;
  end if;

  -- CPF nunca vai inteiro para o log: ***.456.789-**
  if tg_table_name = 'colaboradores' then
    if v_antes ? 'cpf' then
      v_cpf := v_antes ->> 'cpf';
      v_antes := jsonb_set(v_antes, '{cpf}',
        to_jsonb('***.' || substr(v_cpf, 4, 3) || '.' || substr(v_cpf, 7, 3) || '-**'));
    end if;
    if v_depois ? 'cpf' then
      v_cpf := v_depois ->> 'cpf';
      v_depois := jsonb_set(v_depois, '{cpf}',
        to_jsonb('***.' || substr(v_cpf, 4, 3) || '.' || substr(v_cpf, 7, 3) || '-**'));
    end if;
  end if;

  insert into public.auditoria
    (tabela, registro_id, acao, alterado_por, antes, depois, campos_alterados)
  values
    (tg_table_name,
     new.id,
     case when tg_op = 'INSERT' then 'insercao' else 'alteracao' end,
     auth.uid(),
     case when tg_op = 'INSERT' then null else v_antes end,
     v_depois,
     v_campos);

  return null; -- trigger AFTER: o retorno é ignorado
end $$;

-- Só dispara por trigger; ninguém chama direto.
revoke execute on function public.registrar_auditoria() from public, anon, authenticated;

create trigger trg_auditoria after insert or update on public.lojas
  for each row execute function public.registrar_auditoria();
create trigger trg_auditoria after insert or update on public.colaboradores
  for each row execute function public.registrar_auditoria();
create trigger trg_auditoria after insert or update on public.dispositivos
  for each row execute function public.registrar_auditoria();
create trigger trg_auditoria after insert or update on public.vinculos
  for each row execute function public.registrar_auditoria();
create trigger trg_auditoria after insert or update on public.servicos
  for each row execute function public.registrar_auditoria();

-- ---------------------------------------------------------
-- 4. emails_operadores: também quem aparece na auditoria
--    (mesma assinatura: as permissões de execução são mantidas)
-- ---------------------------------------------------------
create or replace function public.emails_operadores(p_ids uuid[])
returns table (id uuid, email text)
language sql
stable
security definer
set search_path = ''
as $$
  select u.id, u.email::text
    from auth.users u
   where u.id = any (p_ids)
     and (
       exists (
         select 1 from public.vinculos v
          where v.criado_por = u.id or v.encerrado_por = u.id
       )
       or exists (
         select 1 from public.auditoria a where a.alterado_por = u.id
       )
     );
$$;

revoke execute on function public.emails_operadores(uuid[]) from public, anon;
grant  execute on function public.emails_operadores(uuid[]) to authenticated;

-- ---------------------------------------------------------
-- 5. Usuários que aparecem no log (para o filtro "Usuário" de /auditoria)
--    O PostgREST não faz "select distinct"; esta função devolve a lista
--    pronta, com e-mail, em ordem alfabética.
-- ---------------------------------------------------------
create or replace function public.usuarios_auditoria()
returns table (id uuid, email text)
language sql
stable
security definer
set search_path = ''
as $$
  select u.id, u.email::text
    from auth.users u
   where exists (select 1 from public.auditoria a where a.alterado_por = u.id)
   order by u.email;
$$;

revoke execute on function public.usuarios_auditoria() from public, anon;
grant  execute on function public.usuarios_auditoria() to authenticated;

commit;

-- ---------------------------------------------------------
-- Conferência (opcional, rode depois):
-- ---------------------------------------------------------
-- Triggers (esperado: 5 linhas, uma por tabela):
--   select event_object_table, trigger_name
--     from information_schema.triggers
--    where trigger_name = 'trg_auditoria'
--    group by 1, 2 order by 1;
--
-- Privilégios de escrita em auditoria (esperado: nenhuma linha):
--   select grantee, privilege_type from information_schema.role_table_grants
--    where table_schema = 'public' and table_name = 'auditoria'
--      and grantee in ('anon', 'authenticated')
--      and privilege_type in ('INSERT', 'UPDATE', 'DELETE', 'TRUNCATE');
--
-- Teste rápido (pelo app): edite a observação de um dispositivo e rode
--   select * from public.auditoria order by id desc limit 5;
