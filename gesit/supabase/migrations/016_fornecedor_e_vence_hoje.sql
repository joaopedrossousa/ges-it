-- =========================================================
-- GesIT — 016 Fornecedor como nome principal e "vence hoje"
-- =========================================================
-- - servicos_financeiros: fornecedor passa a ser obrigatório (os
--   existentes recebem a descrição atual) e a descrição vira opcional
--   (ex.: fornecedor "IBL NET", descrição "Link principal"). Descrição
--   igual ao fornecedor é apagada, para não aparecer repetida.
-- - lancamentos: ganha fornecedor obrigatório (o do serviço ou, no avulso,
--   a descrição atual) e a descrição vira opcional, com a mesma limpeza.
-- - vw_lancamentos: situacao_vencimento separa 'hoje' (vence hoje) de
--   'proximo' (1 a 5 dias); colunas novas no fim: fornecedor e
--   dias_para_vencer ("create or replace view" mantém grants e o
--   security_invoker).
--
-- As atualizações de dados entram na auditoria como "Sistema (fora do app)".
-- Tudo em uma transação: se algo falhar, nada é aplicado.
begin;

-- ---------------------------------------------------------
-- 1. Catálogo: fornecedor obrigatório, descrição opcional
-- ---------------------------------------------------------
alter table public.servicos_financeiros alter column descricao drop not null;

update public.servicos_financeiros
   set fornecedor = descricao
 where fornecedor is null;

update public.servicos_financeiros
   set descricao = null
 where descricao = fornecedor;

alter table public.servicos_financeiros alter column fornecedor set not null;

-- ---------------------------------------------------------
-- 2. Lançamentos: fornecedor obrigatório, descrição opcional
-- ---------------------------------------------------------
alter table public.lancamentos
  add column fornecedor text,
  alter column descricao drop not null;

update public.lancamentos la
   set fornecedor = coalesce(
         (select nullif(btrim(s.fornecedor), '')
            from public.servicos_financeiros s
           where s.id = la.servico_id),
         la.descricao);

update public.lancamentos
   set descricao = null
 where descricao = fornecedor;

alter table public.lancamentos
  alter column fornecedor set not null,
  add constraint lancamentos_fornecedor_tamanho
    check (fornecedor = btrim(fornecedor) and char_length(fornecedor) between 1 and 150);

comment on column public.lancamentos.fornecedor is
  'Nome principal do lançamento (ex.: IBL NET). Vem do serviço; no avulso, digitado.';

-- O update de lancamentos é concedido por coluna (015): inclui a nova.
grant update (fornecedor) on public.lancamentos to authenticated;

-- ---------------------------------------------------------
-- 3. View: mesmas colunas da 015 + fornecedor e dias_para_vencer no fim
--      'pago'      situação pago
--      'cancelado' situação cancelado
--      'vencido'   vencimento antes de hoje
--      'hoje'      vence hoje
--      'proximo'   vence em 1 a 5 dias
--      'a_vencer'  vence depois disso
--    dias_para_vencer = vencimento − hoje (negativo se vencido).
--    "Hoje" é a data de Palmas (America/Araguaina), não a do servidor (UTC).
-- ---------------------------------------------------------
create or replace view public.vw_lancamentos with (security_invoker = true) as
select la.id,
       la.competencia,
       la.servico_id,
       la.tipo,
       la.descricao,
       la.loja_id,
       la.vencimento,
       la.valor,
       la.situacao,
       la.id_aprovacao,
       la.aprovacao_ok,
       la.data_pagamento,
       la.observacao,
       la.anexo_path,
       la.criado_por,
       la.created_at,
       la.updated_at,
       lo.nome          as loja_nome,
       lo.cidade        as loja_cidade,
       s.descricao      as servico_descricao,
       s.fornecedor     as servico_fornecedor,
       s.identificador  as servico_identificador,
       case
         when la.situacao = 'pago'        then 'pago'
         when la.situacao = 'cancelado'   then 'cancelado'
         when la.vencimento < h.hoje      then 'vencido'
         when la.vencimento = h.hoje      then 'hoje'
         when la.vencimento <= h.hoje + 5 then 'proximo'
         else 'a_vencer'
       end as situacao_vencimento,
       la.fornecedor,
       (la.vencimento - h.hoje) as dias_para_vencer
from public.lancamentos la
cross join lateral (
  select (now() at time zone 'America/Araguaina')::date as hoje
) h
left join public.lojas lo               on lo.id = la.loja_id
left join public.servicos_financeiros s on s.id = la.servico_id;

commit;

-- ---------------------------------------------------------
-- Conferências (opcional, rode depois)
-- ---------------------------------------------------------
-- 1) Ninguém sem fornecedor (esperado: 0 e 0)
-- select (select count(*) from public.servicos_financeiros where fornecedor is null) as servicos,
--        (select count(*) from public.lancamentos where fornecedor is null) as lancamentos;
--
-- 2) Como ficaram os nomes
-- select fornecedor, descricao, identificador from public.servicos_financeiros order by 1, 2;
-- select competencia, fornecedor, descricao from public.lancamentos order by 1 desc, 2 limit 20;
--
-- 3) Situação do vencimento (dias_para_vencer 0 = 'hoje')
-- select vencimento, dias_para_vencer, situacao, situacao_vencimento
--   from public.vw_lancamentos order by vencimento desc limit 20;
--
-- 4) Coluna nova liberada para update (esperado: 1 linha)
-- select column_name from information_schema.column_privileges
--  where table_schema = 'public' and table_name = 'lancamentos'
--    and grantee = 'authenticated' and privilege_type = 'UPDATE'
--    and column_name = 'fornecedor';
