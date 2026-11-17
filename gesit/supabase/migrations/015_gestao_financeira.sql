-- =========================================================
-- GesIT — 015 Gestão Financeira (catálogo de serviços e lançamentos)
-- =========================================================
-- - servicos_financeiros: catálogo das despesas recorrentes (provedor de
--   internet, telefonia, serviços...). Não gera nada sozinho; serve para
--   preencher o lançamento.
-- - lancamentos: uma despesa de uma competência (mês). Pode vir do catálogo
--   (servico_id) ou ser avulsa (servico_id nulo, ex.: compras). Sem unique
--   por mês: o mesmo serviço pode ter mais de um lançamento na competência
--   (a app avisa e pede confirmação).
-- - vw_lancamentos: lançamento + loja + serviço + situação do vencimento,
--   calculada com a data de Palmas.
-- - Anexo (boleto/NF) no bucket privado "financeiro", em
--   {lancamento_id}/{timestamp}.{pdf|jpg|png}.
-- - Sem delete (usar a situação "cancelado"); as duas tabelas entram na
--   auditoria (012).
--
-- Tudo em uma transação: se algo falhar, nada é aplicado.
-- (Enums NOVOS podem ser usados na mesma transação.)
begin;

-- ---------------------------------------------------------
-- 1. Enums (rótulos em português ficam na aplicação)
-- ---------------------------------------------------------
create type public.tipo_despesa as enum (
  'provedor_internet',  -- Provedor de internet
  'servico',            -- Serviço
  'telefonia',          -- Telefonia
  'compras',            -- Compras
  'outro'               -- Outro
);

create type public.situacao_pagamento as enum (
  'solicitado_compras', -- Solicitado ao Compras
  'enviado_financeiro', -- Enviado ao Financeiro
  'pago',               -- Pago
  'nao_pago',           -- Não pago
  'cancelado'           -- Cancelado
);

-- ---------------------------------------------------------
-- 2. Catálogo de serviços
-- ---------------------------------------------------------
create table public.servicos_financeiros (
  id               uuid primary key default gen_random_uuid(),
  tipo             public.tipo_despesa not null,
  descricao        text not null
    constraint servicos_financeiros_descricao_tamanho
      check (descricao = btrim(descricao) and char_length(descricao) between 1 and 150),
  fornecedor       text
    constraint servicos_financeiros_fornecedor_tamanho
      check (char_length(fornecedor) between 1 and 150),
  -- Nº do contrato, da linha ou da conta (ex.: as várias contas Claro).
  identificador    text
    constraint servicos_financeiros_identificador_tamanho
      check (char_length(identificador) between 1 and 100),
  loja_id          uuid references public.lojas (id),
  dia_vencimento   smallint
    constraint servicos_financeiros_dia_vencimento_valido
      check (dia_vencimento between 1 and 31),
  valor_referencia numeric(12, 2)
    constraint servicos_financeiros_valor_nao_negativo check (valor_referencia >= 0),
  ativo            boolean not null default true,
  observacao       text
    constraint servicos_financeiros_observacao_tamanho check (char_length(observacao) <= 1000),
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

comment on table public.servicos_financeiros is
  'Catálogo de despesas recorrentes (preenche os lançamentos). Sem delete: desativar.';

create index idx_servicos_financeiros_loja on public.servicos_financeiros (loja_id);

create trigger trg_servicos_financeiros_upd before update on public.servicos_financeiros
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------
-- 3. Lançamentos
-- ---------------------------------------------------------
create table public.lancamentos (
  id             uuid primary key default gen_random_uuid(),
  -- Sempre o dia 1 do mês de referência.
  competencia    date not null
    constraint lancamentos_competencia_dia_1 check (extract(day from competencia) = 1),
  -- Nulo = avulso (ex.: compras).
  servico_id     uuid references public.servicos_financeiros (id),
  tipo           public.tipo_despesa not null,
  descricao      text not null
    constraint lancamentos_descricao_tamanho
      check (descricao = btrim(descricao) and char_length(descricao) between 1 and 150),
  loja_id        uuid references public.lojas (id),
  vencimento     date not null,
  valor          numeric(12, 2) not null
    constraint lancamentos_valor_nao_negativo check (valor >= 0),
  situacao       public.situacao_pagamento not null default 'solicitado_compras',
  id_aprovacao   text
    constraint lancamentos_id_aprovacao_tamanho
      check (char_length(id_aprovacao) between 1 and 100),
  -- Nulo = não informado.
  aprovacao_ok   boolean,
  data_pagamento date,
  observacao     text
    constraint lancamentos_observacao_tamanho check (char_length(observacao) <= 1000),
  -- {lancamento_id}/{timestamp}.{pdf|jpg|png} no bucket "financeiro".
  anexo_path     text,
  criado_por     uuid references auth.users (id) default auth.uid(),
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  -- Data do pagamento só (e sempre) quando pago.
  constraint lancamentos_data_pagamento_quando_pago
    check ((situacao = 'pago') = (data_pagamento is not null)),
  constraint lancamentos_anexo_path_valido
    check (anexo_path ~ ('^' || id::text || '/[0-9]+\.(pdf|jpg|png)$'))
);

comment on table public.lancamentos is
  'Despesas por competência (mês). Sem delete: usar a situação "cancelado".';

create index idx_lancamentos_competencia on public.lancamentos (competencia, tipo);
create index idx_lancamentos_servico     on public.lancamentos (servico_id, competencia);
create index idx_lancamentos_loja        on public.lancamentos (loja_id);
create index idx_lancamentos_vencimento  on public.lancamentos (vencimento);

create trigger trg_lancamentos_upd before update on public.lancamentos
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------
-- 4. Anexo precisa existir no bucket ao ser gravado
--    (mesma ideia de validar_anexo_servico, migration 011)
-- ---------------------------------------------------------
create or replace function public.validar_anexo_lancamento() returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.anexo_path is not null
     and (tg_op = 'INSERT' or new.anexo_path is distinct from old.anexo_path)
     and not exists (
       select 1 from storage.objects
        where bucket_id = 'financeiro' and name = new.anexo_path
     ) then
    raise exception 'Arquivo do anexo não encontrado no Storage';
  end if;
  return new;
end $$;

revoke execute on function public.validar_anexo_lancamento() from public, anon, authenticated;

create trigger trg_lancamentos_anexo
  before insert or update of anexo_path on public.lancamentos
  for each row
  execute function public.validar_anexo_lancamento();

-- ---------------------------------------------------------
-- 5. RLS: select, insert e update para authenticated; sem delete
-- ---------------------------------------------------------
alter table public.servicos_financeiros enable row level security;
alter table public.lancamentos          enable row level security;

create policy ti_select on public.servicos_financeiros for select to authenticated using (true);
create policy ti_insert on public.servicos_financeiros for insert to authenticated with check (true);
create policy ti_update on public.servicos_financeiros for update to authenticated
  using (true) with check (true);

create policy ti_select on public.lancamentos for select to authenticated using (true);
-- criado_por sempre é quem está logado (o default; não dá para forjar).
create policy ti_insert on public.lancamentos for insert to authenticated
  with check (criado_por = auth.uid());
create policy ti_update on public.lancamentos for update to authenticated
  using (true) with check (true);

-- Segunda barreira: sem delete/truncate, e o update só alcança os campos
-- editáveis (id, autor e datas de registro não mudam).
revoke all on public.servicos_financeiros from anon;
revoke all on public.lancamentos          from anon;
revoke delete, truncate on public.servicos_financeiros from authenticated;
revoke delete, truncate on public.lancamentos          from authenticated;

revoke update on public.servicos_financeiros from authenticated;
grant update (tipo, descricao, fornecedor, identificador, loja_id, dia_vencimento,
              valor_referencia, ativo, observacao)
  on public.servicos_financeiros to authenticated;

revoke update on public.lancamentos from authenticated;
grant update (competencia, servico_id, tipo, descricao, loja_id, vencimento, valor,
              situacao, id_aprovacao, aprovacao_ok, data_pagamento, observacao, anexo_path)
  on public.lancamentos to authenticated;

-- ---------------------------------------------------------
-- 6. View: lançamento + loja + serviço + situação do vencimento
--      'pago'      situação pago
--      'cancelado' situação cancelado
--      'vencido'   vencimento antes de hoje
--      'proximo'   vence hoje ou em até 5 dias
--      'a_vencer'  vence depois disso
--    "Hoje" é a data de Palmas (America/Araguaina), não a do servidor (UTC).
-- ---------------------------------------------------------
create view public.vw_lancamentos with (security_invoker = true) as
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
         when la.situacao = 'pago'                   then 'pago'
         when la.situacao = 'cancelado'              then 'cancelado'
         when la.vencimento < h.hoje                 then 'vencido'
         when la.vencimento <= h.hoje + 5            then 'proximo'
         else 'a_vencer'
       end as situacao_vencimento
from public.lancamentos la
cross join lateral (
  select (now() at time zone 'America/Araguaina')::date as hoje
) h
left join public.lojas lo               on lo.id = la.loja_id
left join public.servicos_financeiros s on s.id = la.servico_id;

revoke all on public.vw_lancamentos from anon;
grant select on public.vw_lancamentos to authenticated;

-- ---------------------------------------------------------
-- 7. Storage: bucket privado "financeiro" (PDF, JPG ou PNG, até 10 MB)
--    Caminho: {lancamento_id}/{timestamp}.{pdf|jpg|png}, na pasta de um
--    lançamento existente. Sem update/delete (substituir = novo arquivo).
-- ---------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('financeiro', 'financeiro', false, 10485760,
        array['application/pdf', 'image/jpeg', 'image/png'])
on conflict (id) do nothing;

create policy financeiro_select on storage.objects for select to authenticated
  using (bucket_id = 'financeiro');

create policy financeiro_insert on storage.objects for insert to authenticated
  with check (
    bucket_id = 'financeiro'
    and name ~ '^[0-9a-f-]{36}/[0-9]+\.(pdf|jpg|png)$'
    and exists (
      select 1 from public.lancamentos l
       where l.id::text = (storage.foldername(name))[1]
    )
  );

-- ---------------------------------------------------------
-- 8. Auditoria (012): as duas tabelas novas
-- ---------------------------------------------------------
alter table public.auditoria drop constraint auditoria_tabela_valida;
alter table public.auditoria add constraint auditoria_tabela_valida
  check (tabela in ('lojas', 'colaboradores', 'dispositivos', 'vinculos', 'servicos',
                    'servicos_financeiros', 'lancamentos'));

create trigger trg_auditoria after insert or update on public.servicos_financeiros
  for each row execute function public.registrar_auditoria();
create trigger trg_auditoria after insert or update on public.lancamentos
  for each row execute function public.registrar_auditoria();

commit;

-- ---------------------------------------------------------
-- Conferências (opcional, rode depois)
-- ---------------------------------------------------------
-- 1) Policies (esperado: ti_select, ti_insert e ti_update nas duas tabelas)
-- select tablename, policyname, cmd from pg_policies
--  where schemaname = 'public' and tablename in ('servicos_financeiros', 'lancamentos')
--  order by 1, 2;
--
-- 2) Colunas que authenticated pode atualizar (esperado: 9 e 13)
-- select table_name, count(*) from information_schema.column_privileges
--  where table_schema = 'public' and grantee = 'authenticated' and privilege_type = 'UPDATE'
--    and table_name in ('servicos_financeiros', 'lancamentos')
--  group by 1;
--
-- 3) Triggers de auditoria (esperado: 7 tabelas)
-- select event_object_table from information_schema.triggers
--  where trigger_name = 'trg_auditoria' group by 1 order by 1;
--
-- 4) Bucket
-- select id, public, file_size_limit, allowed_mime_types
--   from storage.buckets where id = 'financeiro';
