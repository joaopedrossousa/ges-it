-- =========================================================
-- GesIT — 017 Atividades (quadro Kanban da equipe de T.I.)
-- =========================================================
-- - kanban_colunas: colunas do quadro, em ordem (posicao). Nome único entre
--   as ativas. Arquivar só sem atividades ativas.
-- - kanban_categorias: etiquetas coloridas. Nome único; inativar em vez de
--   apagar (uma inativa continua nas atividades que já a tinham).
-- - kanban_atividades: cartões. Arquivada some do quadro, mas fica no banco.
-- - kanban_atividade_categorias: N:N entre atividade e categoria.
--
-- Posições (0, 1, 2...) só mudam pelas funções abaixo, que reindexam as
-- colunas envolvidas sob uma trava única do quadro (pg_advisory_xact_lock):
-- duas pessoas arrastando ao mesmo tempo não geram posições repetidas.
-- Colunas, atividades e categorias das atividades só são gravadas pelas
-- funções (security definer); categorias, direto na tabela (grant por coluna).
-- Sem delete em nenhuma tabela.
--
-- Auditoria (012): as três tabelas principais entram no log. "posicao" é
-- ignorada (reordenar não é alteração de conteúdo) e a troca de categorias
-- aparece na atividade como o campo "categorias".
--
-- Tudo em uma transação: se algo falhar, nada é aplicado.
-- (Enums NOVOS podem ser usados na mesma transação.)
begin;

-- ---------------------------------------------------------
-- 1. Enums (rótulos em português ficam na aplicação)
-- ---------------------------------------------------------
create type public.prioridade_atividade as enum ('alta', 'media', 'baixa');

-- Paleta fixa de cores (tokens --etiqueta-* em globals.css).
create type public.cor_kanban as enum (
  'cinza', 'marrom', 'laranja', 'amarelo', 'verde', 'ciano', 'azul', 'roxo', 'rosa', 'vermelho'
);

-- ---------------------------------------------------------
-- 2. Tabelas
-- ---------------------------------------------------------
create table public.kanban_colunas (
  id         uuid primary key default gen_random_uuid(),
  nome       text not null
    constraint kanban_colunas_nome_tamanho
      check (nome = btrim(nome) and char_length(nome) between 1 and 60),
  cor        public.cor_kanban not null default 'cinza',
  posicao    integer not null default 0
    constraint kanban_colunas_posicao_valida check (posicao >= 0),
  arquivada  boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.kanban_colunas is
  'Colunas do quadro de atividades. Gravadas só pelas funções criar/atualizar/mover/arquivar/restaurar_coluna.';

-- Nome único (sem diferenciar maiúsculas) entre as colunas ativas.
create unique index kanban_colunas_nome_key
  on public.kanban_colunas (lower(nome)) where not arquivada;

create table public.kanban_categorias (
  id         uuid primary key default gen_random_uuid(),
  nome       text not null
    constraint kanban_categorias_nome_tamanho
      check (nome = btrim(nome) and char_length(nome) between 1 and 40),
  cor        public.cor_kanban not null default 'cinza',
  ativa      boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.kanban_categorias is
  'Categorias (etiquetas) das atividades. Sem delete: inativar.';

create unique index kanban_categorias_nome_key on public.kanban_categorias (lower(nome));

create table public.kanban_atividades (
  id             uuid primary key default gen_random_uuid(),
  coluna_id      uuid not null references public.kanban_colunas (id),
  titulo         text not null
    constraint kanban_atividades_titulo_tamanho
      check (titulo = btrim(titulo) and char_length(titulo) between 1 and 200),
  descricao      text
    constraint kanban_atividades_descricao_tamanho
      check (char_length(descricao) between 1 and 5000),
  prioridade     public.prioridade_atividade not null default 'media',
  posicao        integer not null default 0
    constraint kanban_atividades_posicao_valida check (posicao >= 0),
  responsavel_id uuid references auth.users (id) on delete set null,
  prazo          date,
  arquivada      boolean not null default false,
  criado_por     uuid references auth.users (id) default auth.uid(),
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

comment on table public.kanban_atividades is
  'Atividades (cartões) do quadro. Gravadas só pelas funções; arquivada some do quadro.';

create index idx_kanban_atividades_coluna
  on public.kanban_atividades (coluna_id, posicao) where not arquivada;
create index idx_kanban_atividades_responsavel on public.kanban_atividades (responsavel_id);

create table public.kanban_atividade_categorias (
  atividade_id uuid not null references public.kanban_atividades (id),
  categoria_id uuid not null references public.kanban_categorias (id),
  primary key (atividade_id, categoria_id)
);

comment on table public.kanban_atividade_categorias is
  'Categorias de cada atividade (N:N). Gravada só por criar_atividade/atualizar_atividade.';

create index idx_kanban_atividade_categorias_categoria
  on public.kanban_atividade_categorias (categoria_id);

-- ---------------------------------------------------------
-- 3. updated_at
--    Colunas e atividades: reordenar (só posicao) não conta como alteração.
-- ---------------------------------------------------------
create or replace function public.kanban_set_updated_at() returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if (to_jsonb(new) - 'posicao' - 'updated_at') is distinct from
     (to_jsonb(old) - 'posicao' - 'updated_at') then
    new.updated_at := now();
  end if;
  return new;
end $$;

revoke execute on function public.kanban_set_updated_at() from public, anon, authenticated;

create trigger trg_kanban_colunas_upd before update on public.kanban_colunas
  for each row execute function public.kanban_set_updated_at();
create trigger trg_kanban_atividades_upd before update on public.kanban_atividades
  for each row execute function public.kanban_set_updated_at();
create trigger trg_kanban_categorias_upd before update on public.kanban_categorias
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------
-- 4. RLS e privilégios
--    Leitura para authenticated. Escrita: categorias direto na tabela (só
--    os campos editáveis); o resto só pelas funções da seção 6.
-- ---------------------------------------------------------
alter table public.kanban_colunas              enable row level security;
alter table public.kanban_categorias           enable row level security;
alter table public.kanban_atividades           enable row level security;
alter table public.kanban_atividade_categorias enable row level security;

create policy ti_select on public.kanban_colunas              for select to authenticated using (true);
create policy ti_select on public.kanban_categorias           for select to authenticated using (true);
create policy ti_select on public.kanban_atividades           for select to authenticated using (true);
create policy ti_select on public.kanban_atividade_categorias for select to authenticated using (true);

create policy ti_insert on public.kanban_categorias for insert to authenticated with check (true);
create policy ti_update on public.kanban_categorias for update to authenticated
  using (true) with check (true);

revoke all on public.kanban_colunas              from anon;
revoke all on public.kanban_categorias           from anon;
revoke all on public.kanban_atividades           from anon;
revoke all on public.kanban_atividade_categorias from anon;

revoke insert, update, delete, truncate on public.kanban_colunas              from authenticated;
revoke insert, update, delete, truncate on public.kanban_atividades           from authenticated;
revoke insert, update, delete, truncate on public.kanban_atividade_categorias from authenticated;
revoke insert, update, delete, truncate on public.kanban_categorias           from authenticated;

grant insert (nome, cor)        on public.kanban_categorias to authenticated;
grant update (nome, cor, ativa) on public.kanban_categorias to authenticated;

-- ---------------------------------------------------------
-- 5. Auditoria: ignora "posicao" (create or replace mantém grants e triggers)
--    Igual à versão da 013, só com o "- 'posicao'" a mais.
-- ---------------------------------------------------------
create or replace function public.registrar_auditoria() returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_novo   jsonb := to_jsonb(new) - 'updated_at' - 'posicao';
  v_antigo jsonb;
  v_antes  jsonb := '{}';
  v_depois jsonb := '{}';
  v_campos text[] := '{}';
  v_chave  text;
begin
  if tg_op = 'INSERT' then
    v_depois := jsonb_strip_nulls(v_novo - 'id' - 'created_at');
    select coalesce(array_agg(k order by k), '{}') into v_campos
      from jsonb_object_keys(v_depois) as k;
  else
    v_antigo := to_jsonb(old) - 'updated_at' - 'posicao';
    for v_chave in select jsonb_object_keys(v_novo) loop
      if v_novo -> v_chave is distinct from v_antigo -> v_chave then
        v_antes  := v_antes  || jsonb_build_object(v_chave, v_antigo -> v_chave);
        v_depois := v_depois || jsonb_build_object(v_chave, v_novo -> v_chave);
        v_campos := v_campos || v_chave;
      end if;
    end loop;
    if cardinality(v_campos) = 0 then
      return null; -- nada mudou de fato (ou só a posição)
    end if;
  end if;

  -- CPF nunca vai inteiro para o log: ***.456.789-** (null continua null)
  if tg_table_name = 'colaboradores' then
    if v_antes ? 'cpf' then
      v_antes := jsonb_set(v_antes, '{cpf}', public.mascarar_cpf_auditoria(v_antes ->> 'cpf'));
    end if;
    if v_depois ? 'cpf' then
      v_depois := jsonb_set(v_depois, '{cpf}', public.mascarar_cpf_auditoria(v_depois ->> 'cpf'));
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

revoke execute on function public.registrar_auditoria() from public, anon, authenticated;

alter table public.auditoria drop constraint auditoria_tabela_valida;
alter table public.auditoria add constraint auditoria_tabela_valida
  check (tabela in ('lojas', 'colaboradores', 'dispositivos', 'vinculos', 'servicos',
                    'servicos_financeiros', 'lancamentos',
                    'kanban_colunas', 'kanban_categorias', 'kanban_atividades'));

-- ---------------------------------------------------------
-- 6. Funções
--    Mensagens de erro em português (a app as mostra como vierem).
--    Todas pegam a mesma trava do quadro antes de ler posições.
-- ---------------------------------------------------------

-- 6.1 Auxiliares internas (ninguém chama direto)

-- Posições 0..n-1 das atividades ativas de uma coluna, mantendo a ordem.
create or replace function public.kanban_reindexar_atividades(p_coluna uuid) returns void
language sql
set search_path = ''
as $$
  with ordem as (
    select id, (row_number() over (order by posicao, created_at, id) - 1)::integer as nova
      from public.kanban_atividades
     where coluna_id = p_coluna and not arquivada
  )
  update public.kanban_atividades a
     set posicao = o.nova
    from ordem o
   where a.id = o.id and a.posicao <> o.nova;
$$;

-- Posições 0..n-1 das colunas ativas, mantendo a ordem.
create or replace function public.kanban_reindexar_colunas() returns void
language sql
set search_path = ''
as $$
  with ordem as (
    select id, (row_number() over (order by posicao, created_at, id) - 1)::integer as nova
      from public.kanban_colunas
     where not arquivada
  )
  update public.kanban_colunas c
     set posicao = o.nova
    from ordem o
   where c.id = o.id and c.posicao <> o.nova;
$$;

-- Troca as categorias de uma atividade e registra no log como o campo
-- "categorias" (ids em ordem). Se a mesma transação já gravou uma linha de
-- log da atividade (inserção ou alteração de campos), junta nela.
create or replace function public.kanban_definir_categorias(p_atividade uuid, p_categorias uuid[])
returns void
language plpgsql
set search_path = ''
as $$
declare
  v_antes  uuid[];
  v_depois uuid[];
  v_log    bigint;
begin
  select coalesce(array_agg(categoria_id order by categoria_id), '{}') into v_antes
    from public.kanban_atividade_categorias
   where atividade_id = p_atividade;

  select coalesce(array_agg(distinct c order by c), '{}') into v_depois
    from unnest(coalesce(p_categorias, '{}'::uuid[])) as c
   where c is not null;

  -- Só categorias ativas; uma inativa pode continuar onde já estava.
  if exists (
    select 1 from unnest(v_depois) as c
     where not exists (
       select 1 from public.kanban_categorias k
        where k.id = c and (k.ativa or c = any (v_antes))
     )
  ) then
    raise exception 'Categoria não encontrada ou inativa. Atualize a página.';
  end if;

  if v_antes = v_depois then
    return;
  end if;

  delete from public.kanban_atividade_categorias
   where atividade_id = p_atividade and categoria_id <> all (v_depois);
  insert into public.kanban_atividade_categorias (atividade_id, categoria_id)
  select p_atividade, c from unnest(v_depois) as c where c <> all (v_antes);

  -- now() é o início da transação: o mesmo alterado_em das linhas gravadas
  -- pela trigger nesta chamada.
  select max(id) into v_log
    from public.auditoria
   where tabela = 'kanban_atividades'
     and registro_id = p_atividade
     and alterado_em = now()
     and alterado_por is not distinct from auth.uid();

  if v_log is not null then
    update public.auditoria
       set antes = case when acao = 'insercao' then null
                        else coalesce(antes, '{}') || jsonb_build_object('categorias', to_jsonb(v_antes)) end,
           depois = coalesce(depois, '{}') || jsonb_build_object('categorias', to_jsonb(v_depois)),
           campos_alterados = campos_alterados || 'categorias'::text
     where id = v_log;
  else
    insert into public.auditoria
      (tabela, registro_id, acao, alterado_por, antes, depois, campos_alterados)
    values
      ('kanban_atividades', p_atividade, 'alteracao', auth.uid(),
       jsonb_build_object('categorias', to_jsonb(v_antes)),
       jsonb_build_object('categorias', to_jsonb(v_depois)),
       array['categorias']);
  end if;
end $$;

revoke execute on function public.kanban_reindexar_atividades(uuid)         from public, anon, authenticated;
revoke execute on function public.kanban_reindexar_colunas()                from public, anon, authenticated;
revoke execute on function public.kanban_definir_categorias(uuid, uuid[])   from public, anon, authenticated;

-- 6.2 Colunas

create or replace function public.criar_coluna(p_nome text, p_cor public.cor_kanban default 'cinza')
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_nome text := btrim(p_nome);
  v_id   uuid;
begin
  if coalesce(v_nome, '') = '' then
    raise exception 'Informe o nome da coluna.';
  end if;

  perform pg_advisory_xact_lock(hashtext('gesit_kanban'));

  if exists (select 1 from public.kanban_colunas
              where not arquivada and lower(nome) = lower(v_nome)) then
    raise exception 'Já existe uma coluna chamada "%".', v_nome;
  end if;

  insert into public.kanban_colunas (nome, cor, posicao)
  values (v_nome, coalesce(p_cor, 'cinza'),
          (select count(*) from public.kanban_colunas where not arquivada))
  returning id into v_id;

  return v_id;
end $$;

-- Renomear e trocar a cor.
create or replace function public.atualizar_coluna(p_coluna uuid, p_nome text, p_cor public.cor_kanban)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_nome text := btrim(p_nome);
begin
  if coalesce(v_nome, '') = '' then
    raise exception 'Informe o nome da coluna.';
  end if;

  perform pg_advisory_xact_lock(hashtext('gesit_kanban'));

  if not exists (select 1 from public.kanban_colunas where id = p_coluna and not arquivada) then
    raise exception 'Coluna não encontrada ou arquivada. Atualize a página.';
  end if;
  if exists (select 1 from public.kanban_colunas
              where not arquivada and id <> p_coluna and lower(nome) = lower(v_nome)) then
    raise exception 'Já existe uma coluna chamada "%".', v_nome;
  end if;

  update public.kanban_colunas
     set nome = v_nome, cor = coalesce(p_cor, cor)
   where id = p_coluna;
end $$;

-- Leva a coluna para a posição pedida (0 = primeira) e reindexa as demais.
create or replace function public.mover_coluna(p_coluna uuid, p_posicao integer)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_total integer;
  v_pos   integer;
begin
  perform pg_advisory_xact_lock(hashtext('gesit_kanban'));

  if not exists (select 1 from public.kanban_colunas where id = p_coluna and not arquivada) then
    raise exception 'Coluna não encontrada ou arquivada. Atualize a página.';
  end if;

  select count(*) into v_total
    from public.kanban_colunas where not arquivada and id <> p_coluna;
  v_pos := least(greatest(coalesce(p_posicao, v_total), 0), v_total);

  with ordem as (
    select id, (row_number() over (order by posicao, created_at, id) - 1)::integer as rn
      from public.kanban_colunas
     where not arquivada and id <> p_coluna
  )
  update public.kanban_colunas c
     set posicao = case when o.rn < v_pos then o.rn else o.rn + 1 end
    from ordem o
   where c.id = o.id
     and c.posicao <> case when o.rn < v_pos then o.rn else o.rn + 1 end;

  update public.kanban_colunas set posicao = v_pos where id = p_coluna;
end $$;

-- Só sem atividades ativas (as arquivadas podem ficar).
create or replace function public.arquivar_coluna(p_coluna uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_nome      text;
  v_arquivada boolean;
  v_qtd       integer;
begin
  perform pg_advisory_xact_lock(hashtext('gesit_kanban'));

  select nome, arquivada into v_nome, v_arquivada
    from public.kanban_colunas where id = p_coluna;
  if not found then
    raise exception 'Coluna não encontrada. Atualize a página.';
  end if;
  if v_arquivada then
    return;
  end if;

  select count(*) into v_qtd
    from public.kanban_atividades where coluna_id = p_coluna and not arquivada;
  if v_qtd > 0 then
    raise exception 'A coluna "%" tem %. Mova ou arquive as atividades antes de arquivar a coluna.',
      v_nome,
      case when v_qtd = 1 then '1 atividade ativa' else v_qtd || ' atividades ativas' end;
  end if;

  update public.kanban_colunas set arquivada = true where id = p_coluna;
  perform public.kanban_reindexar_colunas();
end $$;

-- Volta para o fim do quadro.
create or replace function public.restaurar_coluna(p_coluna uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_nome      text;
  v_arquivada boolean;
begin
  perform pg_advisory_xact_lock(hashtext('gesit_kanban'));

  select nome, arquivada into v_nome, v_arquivada
    from public.kanban_colunas where id = p_coluna;
  if not found then
    raise exception 'Coluna não encontrada. Atualize a página.';
  end if;
  if not v_arquivada then
    return;
  end if;
  if exists (select 1 from public.kanban_colunas
              where not arquivada and lower(nome) = lower(v_nome)) then
    raise exception 'Já existe uma coluna ativa chamada "%". Renomeie-a antes de restaurar esta.', v_nome;
  end if;

  update public.kanban_colunas
     set arquivada = false,
         posicao = (select count(*) from public.kanban_colunas where not arquivada)
   where id = p_coluna;
end $$;

-- 6.3 Atividades

-- Entra no fim da coluna.
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
    (coluna_id, titulo, descricao, prioridade, responsavel_id, prazo, posicao)
  values
    (p_coluna, btrim(p_titulo), nullif(btrim(p_descricao), ''),
     coalesce(p_prioridade, 'media'), p_responsavel, p_prazo,
     (select count(*) from public.kanban_atividades
       where coluna_id = p_coluna and not arquivada))
  returning id into v_id;

  perform public.kanban_definir_categorias(v_id, p_categorias);
  return v_id;
end $$;

-- Edita os campos e as categorias. Trocar de coluna leva para o fim da nova.
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
         descricao = nullif(btrim(p_descricao), ''),
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

-- Arrastar e soltar: leva a atividade para a coluna e posição pedidas
-- (0 = topo; nula ou além do fim = fim) e reindexa origem e destino.
create or replace function public.mover_atividade(
  p_atividade      uuid,
  p_coluna_destino uuid,
  p_posicao        integer default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_origem    uuid;
  v_arquivada boolean;
  v_total     integer;
  v_pos       integer;
begin
  perform pg_advisory_xact_lock(hashtext('gesit_kanban'));

  select coluna_id, arquivada into v_origem, v_arquivada
    from public.kanban_atividades where id = p_atividade;
  if not found then
    raise exception 'Atividade não encontrada. Atualize a página.';
  end if;
  if v_arquivada then
    raise exception 'Esta atividade está arquivada. Restaure-a antes de mover.';
  end if;
  if not exists (select 1 from public.kanban_colunas
                  where id = p_coluna_destino and not arquivada) then
    raise exception 'Coluna não encontrada ou arquivada. Atualize a página.';
  end if;

  -- Destino sem a atividade movida; a posição fica entre 0 e o total.
  select count(*) into v_total
    from public.kanban_atividades
   where coluna_id = p_coluna_destino and not arquivada and id <> p_atividade;
  v_pos := least(greatest(coalesce(p_posicao, v_total), 0), v_total);

  with ordem as (
    select id, (row_number() over (order by posicao, created_at, id) - 1)::integer as rn
      from public.kanban_atividades
     where coluna_id = p_coluna_destino and not arquivada and id <> p_atividade
  )
  update public.kanban_atividades a
     set posicao = case when o.rn < v_pos then o.rn else o.rn + 1 end
    from ordem o
   where a.id = o.id
     and a.posicao <> case when o.rn < v_pos then o.rn else o.rn + 1 end;

  update public.kanban_atividades
     set coluna_id = p_coluna_destino, posicao = v_pos
   where id = p_atividade;

  if v_origem <> p_coluna_destino then
    perform public.kanban_reindexar_atividades(v_origem);
  end if;
end $$;

-- Some do quadro (fica no banco).
create or replace function public.arquivar_atividade(p_atividade uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_coluna    uuid;
  v_arquivada boolean;
begin
  perform pg_advisory_xact_lock(hashtext('gesit_kanban'));

  select coluna_id, arquivada into v_coluna, v_arquivada
    from public.kanban_atividades where id = p_atividade;
  if not found then
    raise exception 'Atividade não encontrada. Atualize a página.';
  end if;
  if v_arquivada then
    return;
  end if;

  update public.kanban_atividades set arquivada = true where id = p_atividade;
  perform public.kanban_reindexar_atividades(v_coluna);
end $$;

-- Volta para o fim da coluna pedida (nula = a coluna em que estava).
create or replace function public.restaurar_atividade(p_atividade uuid, p_coluna uuid default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_coluna    uuid;
  v_arquivada boolean;
  v_destino   uuid;
begin
  perform pg_advisory_xact_lock(hashtext('gesit_kanban'));

  select coluna_id, arquivada into v_coluna, v_arquivada
    from public.kanban_atividades where id = p_atividade;
  if not found then
    raise exception 'Atividade não encontrada. Atualize a página.';
  end if;
  if not v_arquivada then
    return;
  end if;

  v_destino := coalesce(p_coluna, v_coluna);
  if not exists (select 1 from public.kanban_colunas where id = v_destino and not arquivada) then
    raise exception 'A coluna escolhida está arquivada. Restaure a atividade em outra coluna.';
  end if;

  update public.kanban_atividades
     set arquivada = false,
         coluna_id = v_destino,
         posicao = (select count(*) from public.kanban_atividades
                     where coluna_id = v_destino and not arquivada)
   where id = p_atividade;
end $$;

-- 6.4 Usuários do sistema (responsável). auth.users não passa pelo PostgREST.
--     Os removidos só aparecem se ainda forem responsáveis por alguma atividade.
create or replace function public.usuarios_sistema()
returns table (id uuid, email text, nome text)
language sql
stable
security definer
set search_path = ''
as $$
  select u.id,
         u.email::text,
         nullif(btrim(coalesce(u.raw_user_meta_data ->> 'full_name',
                               u.raw_user_meta_data ->> 'name')), '')
    from auth.users u
   where u.email is not null
     and (u.deleted_at is null
          or exists (select 1 from public.kanban_atividades a where a.responsavel_id = u.id))
   order by u.email;
$$;

revoke execute on function public.criar_coluna(text, public.cor_kanban)                from public, anon;
revoke execute on function public.atualizar_coluna(uuid, text, public.cor_kanban)      from public, anon;
revoke execute on function public.mover_coluna(uuid, integer)                          from public, anon;
revoke execute on function public.arquivar_coluna(uuid)                                from public, anon;
revoke execute on function public.restaurar_coluna(uuid)                               from public, anon;
revoke execute on function public.criar_atividade(uuid, text, public.prioridade_atividade, text, uuid, date, uuid[])         from public, anon;
revoke execute on function public.atualizar_atividade(uuid, uuid, text, public.prioridade_atividade, text, uuid, date, uuid[]) from public, anon;
revoke execute on function public.mover_atividade(uuid, uuid, integer)                 from public, anon;
revoke execute on function public.arquivar_atividade(uuid)                             from public, anon;
revoke execute on function public.restaurar_atividade(uuid, uuid)                      from public, anon;
revoke execute on function public.usuarios_sistema()                                   from public, anon;

grant execute on function public.criar_coluna(text, public.cor_kanban)                 to authenticated;
grant execute on function public.atualizar_coluna(uuid, text, public.cor_kanban)       to authenticated;
grant execute on function public.mover_coluna(uuid, integer)                           to authenticated;
grant execute on function public.arquivar_coluna(uuid)                                 to authenticated;
grant execute on function public.restaurar_coluna(uuid)                                to authenticated;
grant execute on function public.criar_atividade(uuid, text, public.prioridade_atividade, text, uuid, date, uuid[])          to authenticated;
grant execute on function public.atualizar_atividade(uuid, uuid, text, public.prioridade_atividade, text, uuid, date, uuid[]) to authenticated;
grant execute on function public.mover_atividade(uuid, uuid, integer)                  to authenticated;
grant execute on function public.arquivar_atividade(uuid)                              to authenticated;
grant execute on function public.restaurar_atividade(uuid, uuid)                       to authenticated;
grant execute on function public.usuarios_sistema()                                    to authenticated;

-- ---------------------------------------------------------
-- 7. Dados iniciais (antes das triggers de auditoria: não entram no log)
-- ---------------------------------------------------------
insert into public.kanban_colunas (nome, cor, posicao) values
  ('KPI''s',           'roxo',     0),
  ('Desenvolvimento',  'azul',     1),
  ('Não Iniciado',     'cinza',    2),
  ('Em Andamento',     'amarelo',  3),
  ('Prioritário',      'vermelho', 4),
  ('Tickets Aliare',   'laranja',  5),
  ('Tickets Syngenta', 'verde',    6);

insert into public.kanban_categorias (nome, cor) values
  ('Suporte',         'azul'),
  ('Telefonia',       'roxo'),
  ('Gestão',          'cinza'),
  ('Acesso',          'verde'),
  ('Acesso Siagri',   'ciano'),
  ('Pagamento',       'amarelo'),
  ('Infraestrutura',  'marrom'),
  ('Compra',          'laranja'),
  ('Serviços',        'rosa'),
  ('Treinamento',     'ciano'),
  ('Desenvolvimento', 'azul'),
  ('Ticket Aliare',   'laranja'),
  ('Ticket Syngenta', 'verde'),
  ('Erro',            'vermelho');

-- ---------------------------------------------------------
-- 8. Triggers de auditoria
-- ---------------------------------------------------------
create trigger trg_auditoria after insert or update on public.kanban_colunas
  for each row execute function public.registrar_auditoria();
create trigger trg_auditoria after insert or update on public.kanban_categorias
  for each row execute function public.registrar_auditoria();
create trigger trg_auditoria after insert or update on public.kanban_atividades
  for each row execute function public.registrar_auditoria();

commit;

-- ---------------------------------------------------------
-- Conferências (opcional, rode depois)
-- ---------------------------------------------------------
-- 1) Seed (esperado: 7 colunas na ordem do quadro e 14 categorias)
-- select posicao, nome, cor from public.kanban_colunas order by posicao;
-- select count(*) from public.kanban_categorias;
--
-- 2) Escrita direta (esperado: só INSERT e UPDATE em kanban_categorias)
-- select table_name, privilege_type from information_schema.role_table_grants
--  where table_schema = 'public' and grantee = 'authenticated'
--    and table_name like 'kanban%' and privilege_type in ('INSERT', 'UPDATE', 'DELETE', 'TRUNCATE')
--  order by 1, 2;
-- (column_privileges mostra os campos: nome, cor; e nome, cor, ativa)
--
-- 3) Triggers de auditoria (esperado: 10 tabelas)
-- select event_object_table from information_schema.triggers
--  where trigger_name = 'trg_auditoria' group by 1 order by 1;
--
-- 4) Posições sem buraco nem repetição (esperado: nenhuma linha)
-- select coluna_id from public.kanban_atividades where not arquivada
--  group by coluna_id having max(posicao) <> count(*) - 1 or count(distinct posicao) <> count(*);
