-- =========================================================
-- GesIT — 018 Tipo de dispositivo "infraestrutura"
-- =========================================================
-- Access point, switch, firewall, rack etc. Reaproveita a tabela
-- dispositivos (status, baixa, nota fiscal, vida útil, auditoria, Serial
-- único), com estas diferenças:
--
-- - Não é atribuído a usuário: pertence à filial. loja_estoque_id é
--   obrigatória, vincular_dispositivo recusa o tipo e uma trigger em
--   vinculos barra qualquer vínculo para ele. Status nunca é "em_uso".
-- - Sem marca: o "Dispositivo" (o que é o item, ex.: "Access Point") vai na
--   coluna nova equipamento. marca deixa de ser NOT NULL na tabela, mas uma
--   check mantém a obrigatoriedade para notebook, telefone e monitor.
-- - Serial Number e Nº de patrimônio opcionais (continuam únicos).
-- - Sem periféricos nem "formatado" (normalizar_perifericos, como monitor).
--
-- Enum: o valor novo é adicionado nesta mesma transação. O Postgres não
-- deixa usar um valor de enum recém-criado antes do commit, por isso as
-- checks comparam tipo::text (texto, não o enum). Nas funções plpgsql a
-- comparação só roda na execução, já depois do commit.
--
-- vw_dispositivos e vw_servicos ganham equipamento no fim ("create or
-- replace view" mantém grants e security_invoker). vw_ativos_por_filial lê
-- enum_range na execução: o tipo novo entra sozinho.
--
-- Rode o arquivo inteiro de uma vez. Tudo em uma transação: se algo
-- falhar, nada é aplicado (nem o valor novo do enum).
begin;

-- ---------------------------------------------------------
-- 1. Enum
-- ---------------------------------------------------------
alter type public.tipo_dispositivo add value if not exists 'infraestrutura';

-- ---------------------------------------------------------
-- 2. Coluna "Dispositivo" (equipamento) e marca opcional só para infra
-- ---------------------------------------------------------
alter table public.dispositivos
  add column equipamento text
    constraint equipamento_valido
      check (equipamento = btrim(equipamento)
             and char_length(equipamento) between 1 and 60);

comment on column public.dispositivos.equipamento is
  'O que é o item de infraestrutura (ex.: Access Point, Switch). Só e sempre no tipo infraestrutura.';

alter table public.dispositivos alter column marca drop not null;

comment on column public.dispositivos.marca is
  'Marca. Obrigatória para notebook, telefone e monitor; sempre nula em infraestrutura.';

-- ---------------------------------------------------------
-- 3. Regras por tipo (mesmo padrão "tipo <> X or ..." da 009)
-- ---------------------------------------------------------
alter table public.dispositivos
  -- Notebook, telefone e monitor continuam exigindo marca.
  add constraint marca_obrigatoria
    check (tipo::text = 'infraestrutura' or marca is not null),
  -- equipamento é exclusivo da infraestrutura.
  add constraint equipamento_so_infraestrutura
    check (tipo::text = 'infraestrutura' or equipamento is null),
  -- Infraestrutura: com equipamento e filial; sem marca e sem IMEI
  -- (linha e operadora já são barradas por linha_so_telefone).
  add constraint infraestrutura_regras
    check (tipo::text <> 'infraestrutura'
           or (equipamento is not null
               and marca is null
               and loja_estoque_id is not null
               and imei1 is null
               and imei2 is null)),
  -- Nunca "em uso": em_uso <=> vínculo aberto (004), e infra não tem vínculo.
  -- Também impede trocar para infraestrutura um aparelho vinculado.
  add constraint infraestrutura_sem_uso
    check (tipo::text <> 'infraestrutura' or status <> 'em_uso');

-- ---------------------------------------------------------
-- 4. Periféricos: infraestrutura igual a monitor (nenhum, sem "formatado")
--    Mesma assinatura: o revoke da 010 continua valendo; reafirmado abaixo.
--    Manter igual a src/lib/perifericos.ts.
-- ---------------------------------------------------------
create or replace function public.normalizar_perifericos(
  p_tipo        public.tipo_dispositivo,
  p_perifericos text[],
  p_formatado   boolean
) returns text[]
language plpgsql
immutable
set search_path = ''
as $$
declare
  v_permitidos text[] := case p_tipo::text
    when 'notebook' then array['carregador', 'headset', 'mouse', 'suporte_notebook']
    when 'telefone' then array['carregador', 'chip']
    else array[]::text[]
  end;
  v_invalidos text[];
  v_lista     text[];
begin
  if p_tipo::text = 'monitor' and p_formatado is not null then
    raise exception 'Monitor não tem a opção "formatado"';
  end if;
  if p_tipo::text = 'infraestrutura' and p_formatado is not null then
    raise exception 'Item de infraestrutura não tem a opção "formatado"';
  end if;

  select array_agg(coalesce(p, '(vazio)'))
    into v_invalidos
    from unnest(coalesce(p_perifericos, '{}')) as p
   where p is null or not (p = any (v_permitidos));
  if v_invalidos is not null then
    raise exception 'Periféricos não permitidos para %: %',
      p_tipo, array_to_string(v_invalidos, ', ');
  end if;

  select coalesce(array_agg(distinct p order by p), '{}')
    into v_lista
    from unnest(coalesce(p_perifericos, '{}')) as p;
  return v_lista;
end $$;

revoke execute on function public.normalizar_perifericos(public.tipo_dispositivo, text[], boolean)
  from public, anon, authenticated;

-- ---------------------------------------------------------
-- 5. vincular_dispositivo: recusa infraestrutura
--    Mesma assinatura e corpo da 010, com a checagem logo depois de travar
--    o dispositivo (antes do status, para a mensagem ser a certa).
-- ---------------------------------------------------------
create or replace function public.vincular_dispositivo(
  p_dispositivo_id uuid,
  p_colaborador_id uuid,
  p_termo_path     text    default null,
  p_observacao     text    default null,
  p_perifericos    text[]  default '{}',
  p_formatado      boolean default null
) returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid         uuid := auth.uid();
  v_status      public.status_dispositivo;
  v_tipo        public.tipo_dispositivo;
  v_perifericos text[];
  v_loja        uuid;
  v_atual       uuid;
  v_id          uuid;
begin
  if v_uid is null then
    raise exception 'Não autenticado' using errcode = '42501';
  end if;

  -- Ordem de travas: dispositivo → colaborador → vínculos (igual em devolver).
  select status, tipo into v_status, v_tipo
    from public.dispositivos
   where id = p_dispositivo_id
     for update;
  if not found then raise exception 'Dispositivo não encontrado'; end if;

  if v_tipo::text = 'infraestrutura' then
    raise exception 'Itens de infraestrutura pertencem à filial e não podem ser vinculados a um usuário';
  end if;

  if v_status in ('manutencao', 'baixado') then
    raise exception 'Dispositivo indisponível (status: %)', v_status;
  end if;

  v_perifericos := public.normalizar_perifericos(v_tipo, p_perifericos, p_formatado);

  select loja_id into v_loja
    from public.colaboradores
   where id = p_colaborador_id and ativo
     for update;
  if not found then raise exception 'Colaborador inativo ou inexistente'; end if;

  -- Termo (opcional): {dispositivo_id}/{timestamp}_{colaborador_id}.pdf já no bucket.
  if p_termo_path is not null then
    if p_termo_path !~ ('^' || p_dispositivo_id::text || '/[0-9]+_'
                        || p_colaborador_id::text || '\.pdf$') then
      raise exception 'Arquivo do termo inválido';
    end if;
    if not exists (
      select 1 from storage.objects
       where bucket_id = 'termos' and name = p_termo_path
    ) then
      raise exception 'Arquivo do termo não encontrado no Storage';
    end if;
  end if;

  select colaborador_id into v_atual
    from public.vinculos
   where dispositivo_id = p_dispositivo_id and data_fim is null;
  if v_atual = p_colaborador_id then
    raise exception 'Dispositivo já está vinculado a este colaborador';
  end if;

  -- Transferência: o vínculo anterior fecha sem conferência de devolução.
  update public.vinculos
     set data_fim = now(),
         encerrado_por = v_uid,
         observacao_devolucao = 'Encerrado por transferência',
         perifericos_devolucao = null,
         formatado_devolucao = null
   where dispositivo_id = p_dispositivo_id and data_fim is null;

  insert into public.vinculos
    (dispositivo_id, colaborador_id, loja_id, termo_path, observacao, criado_por,
     perifericos_entrega, formatado_entrega)
  values
    (p_dispositivo_id, p_colaborador_id, v_loja, p_termo_path, p_observacao, v_uid,
     v_perifericos, p_formatado)
  returning id into v_id;

  update public.dispositivos set status = 'em_uso' where id = p_dispositivo_id;
  return v_id;
end $$;

revoke execute on function public.vincular_dispositivo(uuid, uuid, text, text, text[], boolean)
  from public, anon;
grant  execute on function public.vincular_dispositivo(uuid, uuid, text, text, text[], boolean)
  to authenticated;

-- ---------------------------------------------------------
-- 6. Segunda barreira: nenhum vínculo para infraestrutura, venha de onde
--    vier (SQL Editor, função futura). security definer: lê dispositivos
--    sem depender do RLS de quem grava.
-- ---------------------------------------------------------
create or replace function public.impedir_vinculo_infraestrutura() returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if exists (
    select 1 from public.dispositivos
     where id = new.dispositivo_id and tipo::text = 'infraestrutura'
  ) then
    raise exception 'Itens de infraestrutura pertencem à filial e não podem ser vinculados a um usuário';
  end if;
  return new;
end $$;

revoke execute on function public.impedir_vinculo_infraestrutura() from public, anon, authenticated;

create trigger trg_vinculos_sem_infraestrutura
  before insert on public.vinculos
  for each row
  execute function public.impedir_vinculo_infraestrutura();

-- ---------------------------------------------------------
-- 7. vw_dispositivos (mesmas colunas da 014 + equipamento no fim)
-- ---------------------------------------------------------
create or replace view public.vw_dispositivos with (security_invoker = true) as
select d.id,
       d.tipo,
       d.marca,
       d.modelo,
       d.serial_number,
       d.imei1,
       d.imei2,
       d.status,
       d.observacao,
       d.created_at,
       d.updated_at,
       d.numero_patrimonio,
       d.numero_linha,
       d.operadora,
       d.data_compra,
       d.fim_vida_util,
       d.nota_fiscal_path,
       v.id          as vinculo_id,
       v.data_inicio as vinculado_em,
       v.termo_path  as termo_atual,
       c.id          as colaborador_id,
       c.nome        as colaborador_nome,
       l.nome        as loja_nome,
       v.loja_id     as loja_id,
       (extract(year  from age(h.hoje, d.data_compra)) * 12
        + extract(month from age(h.hoje, d.data_compra)))::int as idade_meses,
       case
         when d.status = 'baixado'                                    then 'baixado'
         when d.fim_vida_util is null                                 then 'sem_data'
         when d.fim_vida_util < h.hoje                                then 'vencido'
         when d.fim_vida_util <= (h.hoje + interval '6 months')::date then 'proximo'
         else 'ok'
       end as situacao_vida_util,
       d.loja_estoque_id,
       le.nome                                as loja_estoque_nome,
       coalesce(v.loja_id, d.loja_estoque_id) as loja_atual_id,
       coalesce(l.nome, le.nome)              as loja_atual_nome,
       d.equipamento
from public.dispositivos d
cross join lateral (
  select (now() at time zone 'America/Araguaina')::date as hoje
) h
left join public.vinculos v      on v.dispositivo_id = d.id and v.data_fim is null
left join public.colaboradores c on c.id = v.colaborador_id
left join public.lojas l         on l.id = v.loja_id
left join public.lojas le        on le.id = d.loja_estoque_id;

-- ---------------------------------------------------------
-- 8. vw_servicos (mesmas colunas da 011 + equipamento no fim)
-- ---------------------------------------------------------
create or replace view public.vw_servicos with (security_invoker = true) as
select s.id,
       s.dispositivo_id,
       s.tipo,
       s.data_servico,
       s.fornecedor,
       s.custo,
       s.na_garantia,
       s.descricao,
       s.anexo_path,
       s.criado_por,
       s.created_at,
       s.updated_at,
       d.tipo              as dispositivo_tipo,
       d.marca,
       d.modelo,
       d.serial_number,
       d.imei1,
       d.numero_patrimonio,
       v.colaborador_id,
       c.nome              as colaborador_nome,
       v.loja_id,
       l.nome              as loja_nome,
       d.equipamento
from public.servicos s
join public.dispositivos d on d.id = s.dispositivo_id
left join lateral (
  select vi.colaborador_id, vi.loja_id
    from public.vinculos vi
   where vi.dispositivo_id = s.dispositivo_id
     and (vi.data_inicio at time zone 'America/Araguaina')::date <= s.data_servico
     and (vi.data_fim is null
          or (vi.data_fim at time zone 'America/Araguaina')::date >= s.data_servico)
   order by vi.data_inicio desc
   limit 1
) v on true
left join public.colaboradores c on c.id = v.colaborador_id
left join public.lojas l         on l.id = v.loja_id;

-- PostgREST: recarrega o cache (enum, coluna e views novas).
notify pgrst, 'reload schema';

commit;

-- ---------------------------------------------------------
-- Conferências (opcionais, rode depois)
-- ---------------------------------------------------------
-- 1) Enum (esperado: notebook, telefone, monitor, infraestrutura)
-- select enum_range(null::public.tipo_dispositivo);
--
-- 2) Checks novas (esperado: marca_obrigatoria, equipamento_so_infraestrutura,
--    infraestrutura_regras, infraestrutura_sem_uso, equipamento_valido)
-- select conname, pg_get_constraintdef(oid) from pg_constraint
--  where conrelid = 'public.dispositivos'::regclass and contype = 'c'
--  order by conname;
--
-- 3) Funções security definer com search_path vazio e uma versão só de
--    vincular_dispositivo (6 argumentos)
-- select p.oid::regprocedure, p.prosecdef, p.proconfig
--   from pg_proc p
--  where p.pronamespace = 'public'::regnamespace
--    and p.proname in ('vincular_dispositivo', 'impedir_vinculo_infraestrutura',
--                      'normalizar_perifericos');
--
-- 4) Índice de vínculo aberto único continua lá
-- select indexname, indexdef from pg_indexes
--  where schemaname = 'public' and indexname = 'vinculo_aberto_unico';
--
-- 5) Coluna nova nas views (esperado: equipamento na última posição)
-- select table_name, column_name, ordinal_position
--   from information_schema.columns
--  where table_schema = 'public' and table_name in ('vw_dispositivos', 'vw_servicos')
--    and column_name = 'equipamento';
--
-- 6) Ativos por filial já com o tipo novo (esperado: uma linha por loja)
-- select tipo, loja_nome, em_uso, em_estoque from public.vw_ativos_por_filial
--  where tipo::text = 'infraestrutura' order by loja_nome nulls last;
