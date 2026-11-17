-- =========================================================
-- GesIT — 019 Baixa de dispositivos (formulário obrigatório)
-- =========================================================
-- - dispositivo_baixas: uma por dispositivo (motivo, informações, data,
--   autor). dispositivo_baixa_anexos: arquivos da baixa (boletim de
--   ocorrência, prints...). Sem update nem delete nas duas tabelas.
-- - Bucket privado "baixas": JPG, PNG, WebP ou PDF até 10 MB, em
--   {dispositivo_id}/{timestamp}-{aleatorio}.{ext}. Enviados do navegador
--   ANTES da baixa; a função confere cada um e grava o vínculo.
-- - baixar_dispositivo (security definer): recusa com vínculo aberto, grava
--   a baixa e os anexos e muda o status, tudo numa transação.
-- - validar_status_dispositivo (004) passa a exigir o registro de baixa para
--   o status "baixado": a baixa só sai pela função. Um dispositivo com
--   registro de baixa não sai mais de "baixado" (reativação fica para depois).
--   Os baixados antigos, sem registro, continuam como estavam.
-- - Auditoria: a mudança de status já é registrada pela trigger da 012; a
--   função junta motivo, informações, data e anexos na mesma linha do log
--   do dispositivo (mesma ideia de kanban_definir_categorias, 017).
-- - vw_dispositivo_baixas: base do relatório de baixas.
--
-- Tudo em uma transação: se algo falhar, nada é aplicado.
-- (Enum NOVO pode ser usado na mesma transação.)
begin;

-- ---------------------------------------------------------
-- 1. Motivos (rótulos em português ficam na aplicação)
-- ---------------------------------------------------------
create type public.motivo_baixa as enum (
  'roubo',                -- Roubo
  'furto',                -- Furto
  'perda_extravio',       -- Perda/Extravio
  'defeito_irreparavel',  -- Defeito Irreparável
  'obsolescencia',        -- Obsolescência
  'doacao',               -- Doação
  'venda',                -- Venda
  'outro'                 -- Outro
);

-- ---------------------------------------------------------
-- 2. Tabelas
-- ---------------------------------------------------------
create table public.dispositivo_baixas (
  id             uuid primary key default gen_random_uuid(),
  dispositivo_id uuid not null references public.dispositivos(id)
    constraint dispositivo_baixas_dispositivo_unico unique,
  motivo         public.motivo_baixa not null,
  informacoes    text not null
    constraint dispositivo_baixas_informacoes_validas
      check (informacoes = btrim(informacoes)
             and char_length(informacoes) between 1 and 2000),
  data_baixa     date not null,
  criado_por     uuid references auth.users(id) default auth.uid(),
  created_at     timestamptz not null default now()
);

comment on table public.dispositivo_baixas is
  'Baixa do dispositivo (uma por dispositivo). Gravada só por baixar_dispositivo; sem update/delete.';

create index idx_dispositivo_baixas_data on public.dispositivo_baixas (data_baixa);

create table public.dispositivo_baixa_anexos (
  id           uuid primary key default gen_random_uuid(),
  baixa_id     uuid not null references public.dispositivo_baixas(id),
  -- {dispositivo_id}/{timestamp}-{aleatorio}.{ext} no bucket "baixas"
  -- (a pasta do dispositivo da baixa é conferida em baixar_dispositivo).
  path         text not null
    constraint dispositivo_baixa_anexos_path_unico unique
    constraint dispositivo_baixa_anexos_path_valido
      check (path ~ '^[0-9a-f-]{36}/[0-9]+-[a-z0-9]{8}\.(pdf|jpg|png|webp)$'),
  -- Nome do arquivo no computador de quem enviou (ex.: boletim.pdf).
  nome_arquivo text not null
    constraint dispositivo_baixa_anexos_nome_valido
      check (char_length(nome_arquivo) between 1 and 255),
  created_at   timestamptz not null default now()
);

comment on table public.dispositivo_baixa_anexos is
  'Anexos da baixa (bucket privado "baixas"). Gravados só por baixar_dispositivo.';

create index idx_dispositivo_baixa_anexos_baixa on public.dispositivo_baixa_anexos (baixa_id);

-- ---------------------------------------------------------
-- 3. RLS: só leitura para authenticated; escrita só pela função
-- ---------------------------------------------------------
alter table public.dispositivo_baixas       enable row level security;
alter table public.dispositivo_baixa_anexos enable row level security;

create policy ti_select on public.dispositivo_baixas       for select to authenticated using (true);
create policy ti_select on public.dispositivo_baixa_anexos for select to authenticated using (true);

revoke all on public.dispositivo_baixas       from anon;
revoke all on public.dispositivo_baixa_anexos from anon;
revoke insert, update, delete, truncate on public.dispositivo_baixas       from authenticated;
revoke insert, update, delete, truncate on public.dispositivo_baixa_anexos from authenticated;

-- ---------------------------------------------------------
-- 4. Coerência de status (substitui a versão da 004; mesmas triggers)
--    em_uso   <=> vínculo aberto (igual à 004)
--    baixado   => existe registro em dispositivo_baixas (novo)
--    com registro de baixa, o status não sai de "baixado" (novo)
-- ---------------------------------------------------------
create or replace function public.validar_status_dispositivo() returns trigger
language plpgsql
security definer   -- a checagem não depende do RLS de quem atualiza
set search_path = ''
as $$
declare
  v_vinculo_aberto boolean;
begin
  if tg_op = 'INSERT' then
    -- Dispositivo novo não tem vínculo nem baixa.
    if new.status = 'em_uso' then
      raise exception 'O status "em uso" só pode ser definido ao vincular o dispositivo';
    end if;
    if new.status = 'baixado' then
      raise exception 'Um dispositivo não pode ser cadastrado como baixado';
    end if;
    return new;
  end if;

  -- UPDATE (a trigger só dispara quando o status muda)
  select exists (
    select 1 from public.vinculos
     where dispositivo_id = new.id and data_fim is null
  ) into v_vinculo_aberto;

  if v_vinculo_aberto and new.status <> 'em_uso' then
    raise exception 'Dispositivo vinculado: faça a devolução ou transferência antes de alterar o status';
  end if;

  if not v_vinculo_aberto and new.status = 'em_uso' then
    raise exception 'O status "em uso" só pode ser definido ao vincular o dispositivo';
  end if;

  if new.status = 'baixado'
     and not exists (select 1 from public.dispositivo_baixas where dispositivo_id = new.id) then
    raise exception 'Para dar baixa, preencha o formulário de baixa do dispositivo';
  end if;

  if old.status = 'baixado'
     and exists (select 1 from public.dispositivo_baixas where dispositivo_id = new.id) then
    raise exception 'Dispositivo baixado não pode ser reativado';
  end if;

  return new;
end $$;

-- ---------------------------------------------------------
-- 5. baixar_dispositivo
--    p_anexos: [{"path": "<dispositivo_id>/<ts>-<aleatorio>.pdf", "nome": "BO.pdf"}, ...]
--    Arquivos já enviados ao bucket "baixas" pelo navegador.
-- ---------------------------------------------------------
create or replace function public.baixar_dispositivo(
  p_dispositivo_id uuid,
  p_motivo         public.motivo_baixa,
  p_informacoes    text,
  p_data_baixa     date,
  p_anexos         jsonb default '[]'::jsonb
) returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid         uuid := auth.uid();
  v_hoje        date := (now() at time zone 'America/Araguaina')::date;
  v_status      public.status_dispositivo;
  v_data_compra date;
  v_informacoes text := btrim(p_informacoes);
  v_anexos      jsonb := coalesce(p_anexos, '[]'::jsonb);
  v_item        jsonb;
  v_path        text;
  v_nome        text;
  v_paths       text[] := '{}';
  v_nomes       text[] := '{}';
  v_id          uuid;
  v_log         bigint;
  v_extra       jsonb;
begin
  if v_uid is null then
    raise exception 'Não autenticado' using errcode = '42501';
  end if;

  -- Mesma ordem de travas de vincular/devolver: o dispositivo primeiro.
  select status, data_compra into v_status, v_data_compra
    from public.dispositivos
   where id = p_dispositivo_id
     for update;
  if not found then raise exception 'Dispositivo não encontrado'; end if;

  if v_status = 'baixado' then
    raise exception 'Este dispositivo já está baixado';
  end if;
  if v_status = 'em_uso' or exists (
    select 1 from public.vinculos
     where dispositivo_id = p_dispositivo_id and data_fim is null
  ) then
    raise exception 'Faça a devolução antes de dar baixa';
  end if;

  if p_motivo is null then
    raise exception 'Selecione o motivo da baixa';
  end if;
  if coalesce(v_informacoes, '') = '' then
    raise exception 'Informe as informações da baixa';
  end if;
  if char_length(v_informacoes) > 2000 then
    raise exception 'As informações da baixa devem ter no máximo 2000 caracteres';
  end if;
  if p_data_baixa is null then
    raise exception 'Informe a data da baixa';
  end if;
  if p_data_baixa > v_hoje then
    raise exception 'A data da baixa não pode ser futura';
  end if;
  if v_data_compra is not null and p_data_baixa < v_data_compra then
    raise exception 'A data da baixa não pode ser anterior à data de compra';
  end if;

  -- Anexos: lista de objetos {path, nome}, até 20, cada um na pasta deste
  -- dispositivo, já no bucket e ainda não usado.
  if jsonb_typeof(v_anexos) <> 'array' then
    raise exception 'Lista de anexos inválida';
  end if;
  if jsonb_array_length(v_anexos) > 20 then
    raise exception 'Envie no máximo 20 anexos';
  end if;

  for v_item in select * from jsonb_array_elements(v_anexos) loop
    v_path := v_item ->> 'path';
    v_nome := btrim(v_item ->> 'nome');
    if v_path is null
       or v_path !~ ('^' || p_dispositivo_id::text || '/[0-9]+-[a-z0-9]{8}\.(pdf|jpg|png|webp)$') then
      raise exception 'Arquivo de anexo inválido';
    end if;
    if coalesce(v_nome, '') = '' or char_length(v_nome) > 255 then
      raise exception 'Nome de anexo inválido';
    end if;
    if v_path = any (v_paths) then
      raise exception 'Anexo repetido';
    end if;
    if not exists (
      select 1 from storage.objects where bucket_id = 'baixas' and name = v_path
    ) then
      raise exception 'Arquivo de anexo não encontrado no Storage';
    end if;
    v_paths := v_paths || v_path;
    v_nomes := v_nomes || v_nome;
  end loop;

  insert into public.dispositivo_baixas
    (dispositivo_id, motivo, informacoes, data_baixa, criado_por)
  values
    (p_dispositivo_id, p_motivo, v_informacoes, p_data_baixa, v_uid)
  returning id into v_id;

  insert into public.dispositivo_baixa_anexos (baixa_id, path, nome_arquivo)
  select v_id, p, n
    from unnest(v_paths, v_nomes) as a(p, n);

  -- Por último: a trigger de status confere o registro gravado acima.
  update public.dispositivos set status = 'baixado' where id = p_dispositivo_id;

  -- Junta a baixa na linha do log da mudança de status (trigger AFTER da
  -- 012, já executada). now() = início da transação = alterado_em dela.
  v_extra := jsonb_build_object(
    'baixa_motivo', p_motivo,
    'baixa_informacoes', v_informacoes,
    'baixa_data', p_data_baixa,
    'baixa_anexos', to_jsonb(v_nomes)
  );

  select max(id) into v_log
    from public.auditoria
   where tabela = 'dispositivos'
     and registro_id = p_dispositivo_id
     and alterado_em = now()
     and alterado_por is not distinct from v_uid;

  if v_log is not null then
    update public.auditoria
       set depois = coalesce(depois, '{}') || v_extra,
           campos_alterados = campos_alterados
             || array['baixa_motivo', 'baixa_informacoes', 'baixa_data', 'baixa_anexos']
     where id = v_log;
  else
    insert into public.auditoria
      (tabela, registro_id, acao, alterado_por, antes, depois, campos_alterados)
    values
      ('dispositivos', p_dispositivo_id, 'alteracao', v_uid, '{}', v_extra,
       array['baixa_motivo', 'baixa_informacoes', 'baixa_data', 'baixa_anexos']);
  end if;

  return v_id;
end $$;

revoke execute on function public.baixar_dispositivo(uuid, public.motivo_baixa, text, date, jsonb)
  from public, anon;
grant  execute on function public.baixar_dispositivo(uuid, public.motivo_baixa, text, date, jsonb)
  to authenticated;

-- ---------------------------------------------------------
-- 6. View do relatório de baixas
-- ---------------------------------------------------------
create view public.vw_dispositivo_baixas with (security_invoker = true) as
select b.id,
       b.dispositivo_id,
       b.motivo,
       b.informacoes,
       b.data_baixa,
       b.criado_por,
       b.created_at,
       d.tipo,
       d.marca,
       d.modelo,
       d.equipamento,
       d.serial_number,
       d.imei1,
       d.numero_patrimonio,
       d.loja_estoque_id                      as loja_id,
       l.nome                                 as loja_nome,
       (select count(*) from public.dispositivo_baixa_anexos a
         where a.baixa_id = b.id)::int        as qtd_anexos
from public.dispositivo_baixas b
join public.dispositivos d on d.id = b.dispositivo_id
left join public.lojas l   on l.id = d.loja_estoque_id;

revoke all on public.vw_dispositivo_baixas from anon;
grant select on public.vw_dispositivo_baixas to authenticated;

-- ---------------------------------------------------------
-- 7. Storage: bucket privado "baixas" (JPG, PNG, WebP ou PDF, até 10 MB)
--    Só na pasta de um dispositivo existente e ainda não baixado.
--    Sem update/delete.
-- ---------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('baixas', 'baixas', false, 10485760,
        array['image/jpeg', 'image/png', 'image/webp', 'application/pdf'])
on conflict (id) do nothing;

create policy baixas_select on storage.objects for select to authenticated
  using (bucket_id = 'baixas');

create policy baixas_insert on storage.objects for insert to authenticated
  with check (
    bucket_id = 'baixas'
    and name ~ '^[0-9a-f-]{36}/[0-9]+-[a-z0-9]{8}\.(pdf|jpg|png|webp)$'
    and exists (
      select 1 from public.dispositivos d
       where d.id::text = (storage.foldername(name))[1]
         and d.status <> 'baixado'
    )
  );

notify pgrst, 'reload schema';

commit;

-- ---------------------------------------------------------
-- Conferências (opcionais, rode depois)
-- ---------------------------------------------------------
-- 1) Funções security definer com search_path vazio
-- select p.oid::regprocedure, p.prosecdef, p.proconfig
--   from pg_proc p
--  where p.pronamespace = 'public'::regnamespace
--    and p.proname in ('baixar_dispositivo', 'validar_status_dispositivo');
--
-- 2) Sem escrita direta (esperado: nenhuma linha)
-- select table_name, grantee, privilege_type from information_schema.role_table_grants
--  where table_schema = 'public'
--    and table_name in ('dispositivo_baixas', 'dispositivo_baixa_anexos')
--    and grantee in ('anon', 'authenticated')
--    and privilege_type in ('INSERT', 'UPDATE', 'DELETE', 'TRUNCATE');
--
-- 3) Bucket
-- select id, public, file_size_limit, allowed_mime_types
--   from storage.buckets where id = 'baixas';
--
-- 4) Baixados antigos, sem registro de baixa (continuam baixados; ainda
--    podem mudar de status pelo diálogo, como antes)
-- select d.id, d.tipo, d.marca, d.modelo, d.equipamento
--   from public.dispositivos d
--  where d.status = 'baixado'
--    and not exists (select 1 from public.dispositivo_baixas b where b.dispositivo_id = d.id);
--
-- 5) Mudar para baixado por fora da função (esperado: erro "Para dar baixa...")
-- update public.dispositivos set status = 'baixado' where id = '<id de um disponível>';
