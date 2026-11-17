-- =========================================================
-- GesIT — 022 Atividades: comentários com imagens e flag "Urgente"
-- =========================================================
-- 1) Comentários (substituem a "Descrição" na tela)
--    - kanban_comentarios: autor, data/hora, texto (opcional se houver
--      imagem). Editar e remover só pelo autor; remover = marcar removido.
--    - kanban_comentario_anexos: imagens do comentário (JPG/PNG/WebP até
--      10 MB) no bucket privado "atividades", em
--      {atividade_id}/{timestamp}-{aleatorio}.{ext}. Removidas na edição
--      também só são marcadas.
--    - A descrição de cada atividade existente vira o primeiro comentário
--      (autor = quem criou a atividade, data = criação da atividade).
--    - kanban_atividades.descricao fica como legado: não é apagada, mas
--      criar_atividade/atualizar_atividade deixam de gravá-la (mesma
--      assinatura; p_descricao é ignorado).
--    - Auditoria: kanban_comentarios entra no log; a lista de imagens entra
--      na mesma linha, como o campo "anexos" (padrão de kanban_definir_categorias).
-- 2) Urgente: urgente, urgente_por, urgente_em em kanban_atividades,
--    gravados por marcar_urgente (a trigger da 012 registra no log).
-- 3) Tela inicial (futura): vw_minhas_atividades (responsável = usuário
--    logado) e vw_atividades_urgentes, ambas sem arquivadas, com índices
--    parciais. vw_kanban_comentarios_contagem dá o número do cartão.
--
-- Escrita só por funções security definer (search_path vazio). Sem delete.
-- Tudo em uma transação: se algo falhar, nada é aplicado.
begin;

-- ---------------------------------------------------------
-- 1. Urgente
-- ---------------------------------------------------------
alter table public.kanban_atividades
  add column urgente     boolean not null default false,
  add column urgente_por uuid references auth.users (id) on delete set null,
  add column urgente_em  timestamptz,
  add constraint kanban_atividades_urgente_coerente
    check (urgente = (urgente_em is not null)
           and (urgente or urgente_por is null));

comment on column public.kanban_atividades.urgente_por is 'Quem marcou como urgente (nulo ao desmarcar).';
comment on column public.kanban_atividades.urgente_em  is 'Quando foi marcada como urgente (nulo ao desmarcar).';
comment on column public.kanban_atividades.descricao is
  'Legado (até a 022). O texto foi copiado para o primeiro comentário; não é mais gravado.';

-- Tela inicial: "atribuídas a mim" e "urgentes", sem arquivadas.
create index idx_kanban_atividades_responsavel_ativas
  on public.kanban_atividades (responsavel_id, prazo) where not arquivada;
create index idx_kanban_atividades_urgentes
  on public.kanban_atividades (urgente_em desc) where urgente and not arquivada;

-- ---------------------------------------------------------
-- 2. Comentários e imagens
-- ---------------------------------------------------------
create table public.kanban_comentarios (
  id           uuid primary key default gen_random_uuid(),
  atividade_id uuid not null references public.kanban_atividades (id),
  -- Opcional quando o comentário é só imagem (a função exige um dos dois).
  texto        text
    constraint kanban_comentarios_texto_tamanho
      check (texto = btrim(texto) and char_length(texto) between 1 and 5000),
  autor_id     uuid references auth.users (id) on delete set null default auth.uid(),
  created_at   timestamptz not null default now(),
  editado_em   timestamptz,
  removido     boolean not null default false,
  removido_em  timestamptz,
  constraint kanban_comentarios_remocao_coerente
    check (removido = (removido_em is not null))
);

comment on table public.kanban_comentarios is
  'Comentários das atividades. Escrita só pelas funções; remover = marcar removido.';

create index idx_kanban_comentarios_atividade
  on public.kanban_comentarios (atividade_id, created_at) where not removido;

create table public.kanban_comentario_anexos (
  id            uuid primary key default gen_random_uuid(),
  comentario_id uuid not null references public.kanban_comentarios (id),
  -- {atividade_id}/{timestamp}-{aleatorio}.{ext} no bucket "atividades"
  -- (a pasta da própria atividade é conferida nas funções).
  path          text not null
    constraint kanban_comentario_anexos_path_unico unique
    constraint kanban_comentario_anexos_path_valido
      check (path ~ '^[0-9a-f-]{36}/[0-9]+-[a-z0-9]{8}\.(jpg|png|webp)$'),
  nome_arquivo  text not null
    constraint kanban_comentario_anexos_nome_valido
      check (char_length(nome_arquivo) between 1 and 255),
  created_at    timestamptz not null default now(),
  removido      boolean not null default false
);

comment on table public.kanban_comentario_anexos is
  'Imagens dos comentários (bucket privado "atividades"). Escrita só pelas funções.';

create index idx_kanban_comentario_anexos_comentario
  on public.kanban_comentario_anexos (comentario_id) where not removido;

alter table public.kanban_comentarios       enable row level security;
alter table public.kanban_comentario_anexos enable row level security;

create policy ti_select on public.kanban_comentarios       for select to authenticated using (true);
create policy ti_select on public.kanban_comentario_anexos for select to authenticated using (true);

revoke all on public.kanban_comentarios       from anon;
revoke all on public.kanban_comentario_anexos from anon;
revoke insert, update, delete, truncate on public.kanban_comentarios       from authenticated;
revoke insert, update, delete, truncate on public.kanban_comentario_anexos from authenticated;

-- ---------------------------------------------------------
-- 3. Migração de dados: descrição → primeiro comentário
--    Antes da trigger de auditoria (seção 4): não entra no log.
-- ---------------------------------------------------------
insert into public.kanban_comentarios (atividade_id, texto, autor_id, created_at)
select a.id, btrim(a.descricao), a.criado_por, a.created_at
  from public.kanban_atividades a
 where nullif(btrim(a.descricao), '') is not null
   and not exists (select 1 from public.kanban_comentarios c where c.atividade_id = a.id);

-- ---------------------------------------------------------
-- 4. Auditoria
-- ---------------------------------------------------------
alter table public.auditoria drop constraint auditoria_tabela_valida;
alter table public.auditoria add constraint auditoria_tabela_valida
  check (tabela in ('lojas', 'colaboradores', 'dispositivos', 'vinculos', 'servicos',
                    'servicos_financeiros', 'lancamentos',
                    'kanban_colunas', 'kanban_categorias', 'kanban_atividades',
                    'dispositivo_imagens', 'kanban_comentarios'));

create trigger trg_auditoria after insert or update on public.kanban_comentarios
  for each row execute function public.registrar_auditoria();

-- Junta a lista de imagens (nomes) na linha do log do comentário gravada
-- nesta transação. p_antes nulo = inserção (só "depois").
create or replace function public.kanban_log_anexos_comentario(
  p_comentario uuid,
  p_antes      text[],
  p_depois     text[]
) returns void
language plpgsql
set search_path = ''
as $$
declare
  v_log bigint;
begin
  if p_antes is not distinct from p_depois then
    return;
  end if;
  -- Comentário novo sem imagem: nada a acrescentar no log.
  if p_antes is null and cardinality(p_depois) = 0 then
    return;
  end if;

  select max(id) into v_log
    from public.auditoria
   where tabela = 'kanban_comentarios'
     and registro_id = p_comentario
     and alterado_em = now()
     and alterado_por is not distinct from auth.uid();

  if v_log is not null then
    update public.auditoria
       set antes = case when acao = 'insercao' then null
                        else coalesce(antes, '{}') || jsonb_build_object('anexos', to_jsonb(p_antes)) end,
           depois = coalesce(depois, '{}') || jsonb_build_object('anexos', to_jsonb(p_depois)),
           campos_alterados = campos_alterados || 'anexos'::text
     where id = v_log;
  end if;
end $$;

revoke execute on function public.kanban_log_anexos_comentario(uuid, text[], text[])
  from public, anon, authenticated;

-- Confere e grava imagens novas de um comentário. Uso interno.
create or replace function public.kanban_gravar_anexos_comentario(
  p_comentario uuid,
  p_atividade  uuid,
  p_anexos     jsonb
) returns void
language plpgsql
set search_path = ''
as $$
declare
  v_anexos jsonb := coalesce(p_anexos, '[]'::jsonb);
  v_item   jsonb;
  v_path   text;
  v_nome   text;
  v_paths  text[] := '{}';
begin
  if jsonb_typeof(v_anexos) <> 'array' then
    raise exception 'Lista de imagens inválida.';
  end if;

  for v_item in select * from jsonb_array_elements(v_anexos) loop
    v_path := v_item ->> 'path';
    v_nome := btrim(v_item ->> 'nome');
    if v_path is null
       or v_path !~ ('^' || p_atividade::text || '/[0-9]+-[a-z0-9]{8}\.(jpg|png|webp)$') then
      raise exception 'Arquivo de imagem inválido.';
    end if;
    if coalesce(v_nome, '') = '' or char_length(v_nome) > 255 then
      raise exception 'Nome de imagem inválido.';
    end if;
    if v_path = any (v_paths) then
      raise exception 'Imagem repetida.';
    end if;
    if not exists (
      select 1 from storage.objects where bucket_id = 'atividades' and name = v_path
    ) then
      raise exception 'Imagem não encontrada no Storage. Envie de novo.';
    end if;
    v_paths := v_paths || v_path;

    insert into public.kanban_comentario_anexos (comentario_id, path, nome_arquivo)
    values (p_comentario, v_path, v_nome);
  end loop;
end $$;

revoke execute on function public.kanban_gravar_anexos_comentario(uuid, uuid, jsonb)
  from public, anon, authenticated;

-- Nomes das imagens ativas de um comentário, em ordem. Uso interno.
create or replace function public.kanban_nomes_anexos_comentario(p_comentario uuid)
returns text[]
language sql
stable
set search_path = ''
as $$
  select coalesce(array_agg(nome_arquivo order by created_at, id), '{}')
    from public.kanban_comentario_anexos
   where comentario_id = p_comentario and not removido;
$$;

revoke execute on function public.kanban_nomes_anexos_comentario(uuid)
  from public, anon, authenticated;

-- ---------------------------------------------------------
-- 5. Funções de comentário
--    p_anexos: [{"path": "<atividade_id>/<ts>-<aleatorio>.jpg", "nome": "print.png"}, ...]
-- ---------------------------------------------------------
create or replace function public.adicionar_comentario(
  p_atividade uuid,
  p_texto     text,
  p_anexos    jsonb default '[]'::jsonb
) returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid       uuid := auth.uid();
  v_texto     text := nullif(btrim(p_texto), '');
  v_arquivada boolean;
  v_qtd       integer := jsonb_array_length(coalesce(p_anexos, '[]'::jsonb));
  v_id        uuid;
begin
  if v_uid is null then
    raise exception 'Não autenticado' using errcode = '42501';
  end if;

  select arquivada into v_arquivada
    from public.kanban_atividades where id = p_atividade
     for share;
  if not found then raise exception 'Atividade não encontrada. Atualize a página.'; end if;
  if v_arquivada then
    raise exception 'Esta atividade está arquivada. Restaure-a antes de comentar.';
  end if;

  if v_texto is null and v_qtd = 0 then
    raise exception 'Escreva um comentário ou anexe uma imagem.';
  end if;
  if char_length(v_texto) > 5000 then
    raise exception 'O comentário deve ter no máximo 5000 caracteres.';
  end if;
  if v_qtd > 20 then
    raise exception 'Envie no máximo 20 imagens por comentário.';
  end if;

  insert into public.kanban_comentarios (atividade_id, texto, autor_id)
  values (p_atividade, v_texto, v_uid)
  returning id into v_id;

  perform public.kanban_gravar_anexos_comentario(v_id, p_atividade, p_anexos);
  perform public.kanban_log_anexos_comentario(
    v_id, null, public.kanban_nomes_anexos_comentario(v_id));
  return v_id;
end $$;

-- Só o autor. Troca o texto, acrescenta imagens e marca as removidas.
create or replace function public.editar_comentario(
  p_comentario       uuid,
  p_texto            text,
  p_anexos_novos     jsonb  default '[]'::jsonb,
  p_anexos_removidos uuid[] default '{}'
) returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid       uuid := auth.uid();
  v_texto     text := nullif(btrim(p_texto), '');
  v_autor     uuid;
  v_removido  boolean;
  v_atividade uuid;
  v_arquivada boolean;
  v_antes     text[];
  v_depois    text[];
begin
  if v_uid is null then
    raise exception 'Não autenticado' using errcode = '42501';
  end if;

  select c.autor_id, c.removido, c.atividade_id, a.arquivada
    into v_autor, v_removido, v_atividade, v_arquivada
    from public.kanban_comentarios c
    join public.kanban_atividades a on a.id = c.atividade_id
   where c.id = p_comentario
     for update of c;
  if not found then raise exception 'Comentário não encontrado. Atualize a página.'; end if;
  if v_autor is distinct from v_uid then
    raise exception 'Só o autor pode editar este comentário.';
  end if;
  if v_removido then raise exception 'Este comentário foi removido.'; end if;
  if v_arquivada then
    raise exception 'Esta atividade está arquivada. Restaure-a antes de editar comentários.';
  end if;
  if char_length(v_texto) > 5000 then
    raise exception 'O comentário deve ter no máximo 5000 caracteres.';
  end if;

  v_antes := public.kanban_nomes_anexos_comentario(p_comentario);

  if exists (
    select 1 from unnest(coalesce(p_anexos_removidos, '{}')) as r
     where not exists (
       select 1 from public.kanban_comentario_anexos x
        where x.id = r and x.comentario_id = p_comentario
     )
  ) then
    raise exception 'Imagem não encontrada neste comentário. Atualize a página.';
  end if;

  update public.kanban_comentario_anexos
     set removido = true
   where comentario_id = p_comentario
     and id = any (coalesce(p_anexos_removidos, '{}'))
     and not removido;

  perform public.kanban_gravar_anexos_comentario(p_comentario, v_atividade, p_anexos_novos);

  v_depois := public.kanban_nomes_anexos_comentario(p_comentario);
  if v_texto is null and cardinality(v_depois) = 0 then
    raise exception 'O comentário ficaria vazio. Escreva um texto, mantenha uma imagem ou remova o comentário.';
  end if;
  if cardinality(v_depois) > 20 then
    raise exception 'Use no máximo 20 imagens por comentário.';
  end if;

  -- editado_em sempre muda: a linha do log existe mesmo se só as imagens mudaram.
  update public.kanban_comentarios
     set texto = v_texto,
         editado_em = now()
   where id = p_comentario;

  perform public.kanban_log_anexos_comentario(p_comentario, v_antes, v_depois);
end $$;

-- Só o autor. Some do histórico, mas fica no banco e no log.
create or replace function public.remover_comentario(p_comentario uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid      uuid := auth.uid();
  v_autor    uuid;
  v_removido boolean;
begin
  if v_uid is null then
    raise exception 'Não autenticado' using errcode = '42501';
  end if;

  select autor_id, removido into v_autor, v_removido
    from public.kanban_comentarios where id = p_comentario
     for update;
  if not found then raise exception 'Comentário não encontrado. Atualize a página.'; end if;
  if v_autor is distinct from v_uid then
    raise exception 'Só o autor pode remover este comentário.';
  end if;
  if v_removido then raise exception 'Este comentário já foi removido.'; end if;

  update public.kanban_comentarios
     set removido = true, removido_em = now()
   where id = p_comentario;
end $$;

-- ---------------------------------------------------------
-- 6. Urgente
-- ---------------------------------------------------------
create or replace function public.marcar_urgente(p_atividade uuid, p_urgente boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid       uuid := auth.uid();
  v_urgente   boolean;
  v_arquivada boolean;
begin
  if v_uid is null then
    raise exception 'Não autenticado' using errcode = '42501';
  end if;
  if p_urgente is null then
    raise exception 'Valor inválido para "Urgente".';
  end if;

  select urgente, arquivada into v_urgente, v_arquivada
    from public.kanban_atividades where id = p_atividade
     for update;
  if not found then raise exception 'Atividade não encontrada. Atualize a página.'; end if;
  if v_arquivada then
    raise exception 'Esta atividade está arquivada. Restaure-a antes de editar.';
  end if;
  if v_urgente = p_urgente then
    return; -- já estava assim (ex.: outra pessoa marcou antes)
  end if;

  update public.kanban_atividades
     set urgente = p_urgente,
         urgente_por = case when p_urgente then v_uid end,
         urgente_em = case when p_urgente then now() end
   where id = p_atividade;
end $$;

-- ---------------------------------------------------------
-- 7. criar_atividade / atualizar_atividade sem a descrição
--    Mesmas assinaturas e corpos da 017, sem gravar descricao
--    (p_descricao continua na assinatura e é ignorado).
-- ---------------------------------------------------------
create or replace function public.criar_atividade(
  p_coluna      uuid,
  p_titulo      text,
  p_prioridade  public.prioridade_atividade default 'media',
  p_descricao   text default null,
  p_responsavel uuid default null,
  p_prazo       date default null,
  p_categorias  uuid[] default '{}'
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
begin
  if coalesce(btrim(p_titulo), '') = '' then
    raise exception 'Informe o título da atividade.';
  end if;

  perform pg_advisory_xact_lock(hashtext('gesit_kanban'));

  if not exists (select 1 from public.kanban_colunas where id = p_coluna and not arquivada) then
    raise exception 'Coluna não encontrada ou arquivada. Atualize a página.';
  end if;

  insert into public.kanban_atividades
    (coluna_id, titulo, prioridade, responsavel_id, prazo, posicao)
  values
    (p_coluna, btrim(p_titulo),
     coalesce(p_prioridade, 'media'), p_responsavel, p_prazo,
     (select count(*) from public.kanban_atividades
       where coluna_id = p_coluna and not arquivada))
  returning id into v_id;

  perform public.kanban_definir_categorias(v_id, p_categorias);
  return v_id;
end $$;

create or replace function public.atualizar_atividade(
  p_atividade   uuid,
  p_coluna      uuid,
  p_titulo      text,
  p_prioridade  public.prioridade_atividade,
  p_descricao   text default null,
  p_responsavel uuid default null,
  p_prazo       date default null,
  p_categorias  uuid[] default '{}'
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_coluna    uuid;
  v_arquivada boolean;
  v_destino   uuid;
  v_posicao   integer;
begin
  if coalesce(btrim(p_titulo), '') = '' then
    raise exception 'Informe o título da atividade.';
  end if;

  perform pg_advisory_xact_lock(hashtext('gesit_kanban'));

  select coluna_id, arquivada into v_coluna, v_arquivada
    from public.kanban_atividades where id = p_atividade;
  if not found then
    raise exception 'Atividade não encontrada. Atualize a página.';
  end if;
  if v_arquivada then
    raise exception 'Esta atividade está arquivada. Restaure-a antes de editar.';
  end if;

  v_destino := coalesce(p_coluna, v_coluna);
  if v_destino <> v_coluna then
    if not exists (select 1 from public.kanban_colunas where id = v_destino and not arquivada) then
      raise exception 'Coluna não encontrada ou arquivada. Atualize a página.';
    end if;
    select count(*) into v_posicao
      from public.kanban_atividades where coluna_id = v_destino and not arquivada;
  end if;

  -- Um update só: campos e coluna saem na mesma linha do log.
  update public.kanban_atividades
     set titulo = btrim(p_titulo),
         prioridade = coalesce(p_prioridade, prioridade),
         responsavel_id = p_responsavel,
         prazo = p_prazo,
         coluna_id = v_destino,
         posicao = coalesce(v_posicao, posicao)
   where id = p_atividade;

  if v_destino <> v_coluna then
    perform public.kanban_reindexar_atividades(v_coluna);
  end if;

  perform public.kanban_definir_categorias(p_atividade, p_categorias);
end $$;

-- ---------------------------------------------------------
-- 8. Permissões de execução
-- ---------------------------------------------------------
revoke execute on function public.adicionar_comentario(uuid, text, jsonb)              from public, anon;
revoke execute on function public.editar_comentario(uuid, text, jsonb, uuid[])         from public, anon;
revoke execute on function public.remover_comentario(uuid)                             from public, anon;
revoke execute on function public.marcar_urgente(uuid, boolean)                        from public, anon;
grant  execute on function public.adicionar_comentario(uuid, text, jsonb)              to authenticated;
grant  execute on function public.editar_comentario(uuid, text, jsonb, uuid[])         to authenticated;
grant  execute on function public.remover_comentario(uuid)                             to authenticated;
grant  execute on function public.marcar_urgente(uuid, boolean)                        to authenticated;

-- Mesmas assinaturas da 017: grants mantidos; reafirmados.
revoke execute on function public.criar_atividade(uuid, text, public.prioridade_atividade, text, uuid, date, uuid[])         from public, anon;
revoke execute on function public.atualizar_atividade(uuid, uuid, text, public.prioridade_atividade, text, uuid, date, uuid[]) from public, anon;
grant  execute on function public.criar_atividade(uuid, text, public.prioridade_atividade, text, uuid, date, uuid[])          to authenticated;
grant  execute on function public.atualizar_atividade(uuid, uuid, text, public.prioridade_atividade, text, uuid, date, uuid[]) to authenticated;

-- ---------------------------------------------------------
-- 9. Views (security_invoker: o RLS de quem consulta vale)
-- ---------------------------------------------------------
-- Comentários ativos por atividade (número do cartão).
create view public.vw_kanban_comentarios_contagem with (security_invoker = true) as
select atividade_id, count(*)::int as total
  from public.kanban_comentarios
 where not removido
 group by atividade_id;

-- Base da tela inicial: atividade + coluna + contagem de comentários.
create view public.vw_minhas_atividades with (security_invoker = true) as
select a.id, a.titulo, a.prioridade, a.prazo, a.urgente, a.urgente_em,
       a.responsavel_id, a.coluna_id,
       c.nome as coluna_nome, c.cor as coluna_cor,
       coalesce(k.total, 0) as comentarios,
       a.created_at, a.updated_at
  from public.kanban_atividades a
  join public.kanban_colunas c on c.id = a.coluna_id
  left join public.vw_kanban_comentarios_contagem k on k.atividade_id = a.id
 where not a.arquivada
   and a.responsavel_id = auth.uid();

create view public.vw_atividades_urgentes with (security_invoker = true) as
select a.id, a.titulo, a.prioridade, a.prazo, a.urgente, a.urgente_em, a.urgente_por,
       a.responsavel_id, a.coluna_id,
       c.nome as coluna_nome, c.cor as coluna_cor,
       coalesce(k.total, 0) as comentarios,
       a.created_at, a.updated_at
  from public.kanban_atividades a
  join public.kanban_colunas c on c.id = a.coluna_id
  left join public.vw_kanban_comentarios_contagem k on k.atividade_id = a.id
 where not a.arquivada
   and a.urgente;

revoke all on public.vw_kanban_comentarios_contagem from anon;
revoke all on public.vw_minhas_atividades           from anon;
revoke all on public.vw_atividades_urgentes         from anon;
grant select on public.vw_kanban_comentarios_contagem to authenticated;
grant select on public.vw_minhas_atividades           to authenticated;
grant select on public.vw_atividades_urgentes         to authenticated;

-- ---------------------------------------------------------
-- 10. Storage: bucket privado "atividades" (JPG, PNG ou WebP, 10 MB)
--     Só na pasta de uma atividade existente e não arquivada.
--     Sem update/delete.
-- ---------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('atividades', 'atividades', false, 10485760,
        array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

create policy atividades_select on storage.objects for select to authenticated
  using (bucket_id = 'atividades');

create policy atividades_insert on storage.objects for insert to authenticated
  with check (
    bucket_id = 'atividades'
    and name ~ '^[0-9a-f-]{36}/[0-9]+-[a-z0-9]{8}\.(jpg|png|webp)$'
    and exists (
      select 1 from public.kanban_atividades a
       where a.id::text = (storage.foldername(name))[1]
         and not a.arquivada
    )
  );

notify pgrst, 'reload schema';

commit;

-- ---------------------------------------------------------
-- Conferências (opcionais, rode depois)
-- ---------------------------------------------------------
-- 1) Descrições migradas (esperado: os dois números iguais)
-- select (select count(*) from public.kanban_atividades
--          where nullif(btrim(descricao), '') is not null) as com_descricao,
--        (select count(*) from public.kanban_comentarios) as comentarios;
--
-- 2) Funções security definer com search_path vazio
-- select p.oid::regprocedure, p.prosecdef, p.proconfig
--   from pg_proc p
--  where p.pronamespace = 'public'::regnamespace
--    and p.proname in ('adicionar_comentario', 'editar_comentario', 'remover_comentario',
--                      'marcar_urgente', 'criar_atividade', 'atualizar_atividade');
--
-- 3) Sem escrita direta (esperado: nenhuma linha)
-- select table_name, grantee, privilege_type from information_schema.role_table_grants
--  where table_schema = 'public'
--    and table_name in ('kanban_comentarios', 'kanban_comentario_anexos')
--    and grantee in ('anon', 'authenticated')
--    and privilege_type in ('INSERT', 'UPDATE', 'DELETE', 'TRUNCATE');
--
-- 4) Índices novos
-- select indexname from pg_indexes
--  where tablename in ('kanban_atividades', 'kanban_comentarios', 'kanban_comentario_anexos')
--  order by indexname;
--
-- 5) Bucket
-- select id, public, file_size_limit, allowed_mime_types
--   from storage.buckets where id = 'atividades';
