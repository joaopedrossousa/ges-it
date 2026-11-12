-- =========================================================
-- 014: filial de estoque dos dispositivos + ativos por filial
--
-- - dispositivos.loja_estoque_id: filial onde o aparelho fica guardado
--   quando não está vinculado (opcional).
-- - vw_dispositivos ganha loja_estoque_* e loja_atual_* (loja do vínculo
--   aberto; sem vínculo, a filial de estoque). As colunas novas entram no
--   fim, então "create or replace view" basta (mantém grants e o
--   security_invoker).
-- - devolver_dispositivo ganha p_loja_estoque_id: informado, vira a filial
--   de estoque; omitido, o aparelho fica na filial onde foi devolvido (a
--   loja do vínculo encerrado).
-- - vw_ativos_por_filial: contagem por tipo × filial para o Dashboard.
--
-- Tudo em uma transação: se algo falhar, nada é aplicado.
-- =========================================================

begin;

-- ---------------------------------------------------------
-- 1. Coluna
-- ---------------------------------------------------------
alter table public.dispositivos
  add column loja_estoque_id uuid references public.lojas (id);

comment on column public.dispositivos.loja_estoque_id is
  'Filial onde o aparelho fica guardado quando não está vinculado.';

create index dispositivos_loja_estoque_id_idx on public.dispositivos (loja_estoque_id);

-- ---------------------------------------------------------
-- 2. vw_dispositivos (mesmas colunas da 009 + 4 no fim)
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
       le.nome                              as loja_estoque_nome,
       coalesce(v.loja_id, d.loja_estoque_id) as loja_atual_id,
       coalesce(l.nome, le.nome)              as loja_atual_nome
from public.dispositivos d
cross join lateral (
  select (now() at time zone 'America/Araguaina')::date as hoje
) h
left join public.vinculos v      on v.dispositivo_id = d.id and v.data_fim is null
left join public.colaboradores c on c.id = v.colaborador_id
left join public.lojas l         on l.id = v.loja_id
left join public.lojas le        on le.id = d.loja_estoque_id;

-- ---------------------------------------------------------
-- 3. devolver_dispositivo com a filial de estoque
--    (parâmetro novo muda a assinatura: drop + create, grants refeitos)
-- ---------------------------------------------------------
drop function if exists public.devolver_dispositivo(uuid, text, public.status_dispositivo, text[], boolean);

create function public.devolver_dispositivo(
  p_dispositivo_id          uuid,
  p_observacao              text    default null,
  p_novo_status             public.status_dispositivo default 'disponivel',
  p_perifericos_devolvidos  text[]  default '{}',
  p_formatado               boolean default null,
  p_loja_estoque_id         uuid    default null
) returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid          uuid := auth.uid();
  v_tipo         public.tipo_dispositivo;
  v_perifericos  text[];
  v_loja_vinculo uuid;
begin
  if v_uid is null then
    raise exception 'Não autenticado' using errcode = '42501';
  end if;
  if p_novo_status = 'em_uso' then
    raise exception 'Status inválido para devolução';
  end if;
  if p_loja_estoque_id is not null
     and not exists (select 1 from public.lojas where id = p_loja_estoque_id) then
    raise exception 'Filial de estoque não encontrada';
  end if;

  select tipo into v_tipo
    from public.dispositivos
   where id = p_dispositivo_id
     for update;
  if not found then raise exception 'Dispositivo não encontrado'; end if;

  v_perifericos := public.normalizar_perifericos(v_tipo, p_perifericos_devolvidos, p_formatado);

  update public.vinculos
     set data_fim = now(),
         encerrado_por = v_uid,
         observacao_devolucao = p_observacao,
         perifericos_devolucao = v_perifericos,
         formatado_devolucao = p_formatado
   where dispositivo_id = p_dispositivo_id and data_fim is null
  returning loja_id into v_loja_vinculo;
  if not found then raise exception 'Dispositivo não possui vínculo aberto'; end if;

  -- Filial escolhida na devolução; sem escolha, a filial onde foi devolvido.
  update public.dispositivos
     set status = p_novo_status,
         loja_estoque_id = coalesce(p_loja_estoque_id, v_loja_vinculo, loja_estoque_id)
   where id = p_dispositivo_id;
end $$;

revoke execute on function public.devolver_dispositivo(uuid, text, public.status_dispositivo, text[], boolean, uuid)
  from public, anon;
grant  execute on function public.devolver_dispositivo(uuid, text, public.status_dispositivo, text[], boolean, uuid)
  to authenticated;

-- ---------------------------------------------------------
-- 4. Ativos por filial (Dashboard)
--    Uma linha por tipo × loja (todas as lojas, mesmo com zero) e, por
--    tipo, uma linha com loja nula para os aparelhos sem filial.
--    Baixados ficam fora. "Em uso" = vínculo aberto (status em_uso, ver
--    004); disponível e manutenção contam como estoque da filial de estoque.
-- ---------------------------------------------------------
create view public.vw_ativos_por_filial with (security_invoker = true) as
with contagem as (
  select tipo,
         loja_atual_id,
         count(*) filter (where status = 'em_uso')  as em_uso,
         count(*) filter (where status <> 'em_uso') as em_estoque
    from public.vw_dispositivos
   where status <> 'baixado'
   group by tipo, loja_atual_id
)
select t.tipo,
       l.id                         as loja_id,
       l.nome                       as loja_nome,
       l.ativo                      as loja_ativa,
       coalesce(c.em_uso, 0)::int     as em_uso,
       coalesce(c.em_estoque, 0)::int as em_estoque
  from public.lojas l
 cross join unnest(enum_range(null::public.tipo_dispositivo)) as t(tipo)
  left join contagem c on c.tipo = t.tipo and c.loja_atual_id = l.id
union all
select c.tipo, null, null, null, c.em_uso::int, c.em_estoque::int
  from contagem c
 where c.loja_atual_id is null;

revoke all on public.vw_ativos_por_filial from anon;

commit;

-- ---------------------------------------------------------
-- Conferências (rode depois; todas devem bater)
-- ---------------------------------------------------------
-- 1) Coluna e view (esperado: 4 colunas novas, todas nulas por enquanto
--    em loja_estoque_*; loja_atual_* igual à loja do vínculo nos vinculados)
-- select id, status, loja_nome, loja_estoque_nome, loja_atual_nome
--   from public.vw_dispositivos order by status limit 20;
--
-- 2) Função nova com os grants (esperado: authenticated e postgres/owner)
-- select p.oid::regprocedure, a.grantee::regrole
--   from pg_proc p, aclexplode(p.proacl) a
--  where p.proname = 'devolver_dispositivo';
--
-- 3) Só uma devolver_dispositivo (esperado: 1 linha, com 6 argumentos)
-- select oid::regprocedure from pg_proc where proname = 'devolver_dispositivo';
--
-- 4) Ativos por filial (esperado: 3 × nº de lojas linhas, + linhas sem loja;
--    soma de em_uso + em_estoque = dispositivos não baixados)
-- select tipo, loja_nome, em_uso, em_estoque
--   from public.vw_ativos_por_filial order by tipo, loja_nome nulls last;
-- select (select sum(em_uso + em_estoque) from public.vw_ativos_por_filial) as na_view,
--        (select count(*) from public.dispositivos where status <> 'baixado') as na_tabela;
