-- =========================================================
-- GesIT — 011 Histórico de serviços (manutenções) dos dispositivos
-- =========================================================
-- Tudo em uma transação: se algo falhar, nada é aplicado.
-- (Um enum NOVO pode ser usado na mesma transação; a restrição da 008 vale
-- só para "alter type ... add value".)
begin;

-- ---------------------------------------------------------
-- 1. Tipos de serviço (rótulos em português ficam na aplicação)
-- ---------------------------------------------------------
create type public.tipo_servico as enum (
  'formatacao',           -- Formatação
  'troca_tela',           -- Troca de tela
  'troca_bateria',        -- Troca de bateria
  'troca_teclado',        -- Troca de teclado
  'limpeza',              -- Limpeza
  'reparo_placa',         -- Reparo de placa
  'atualizacao_sistema',  -- Atualização de sistema
  'outro'                 -- Outro
);

-- ---------------------------------------------------------
-- 2. Tabela
-- ---------------------------------------------------------
create table public.servicos (
  id             uuid primary key default gen_random_uuid(),
  dispositivo_id uuid not null references public.dispositivos(id),
  tipo           public.tipo_servico not null,
  data_servico   date not null,
  -- Técnico interno ou empresa.
  fornecedor     text
    constraint servicos_fornecedor_tamanho check (char_length(fornecedor) between 1 and 150),
  custo          numeric(10, 2)
    constraint servicos_custo_nao_negativo check (custo >= 0),
  na_garantia    boolean not null default false,
  descricao      text
    constraint servicos_descricao_tamanho check (char_length(descricao) <= 1000),
  -- {dispositivo_id}/{timestamp}.{pdf|jpg|png} no bucket "servicos".
  anexo_path     text,
  criado_por     uuid references auth.users(id) default auth.uid(),
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  constraint servicos_anexo_path_valido
    check (anexo_path ~ ('^' || dispositivo_id::text || '/[0-9]+\.(pdf|jpg|png)$')),
  -- "Outro" sem descrição não diz nada no histórico.
  constraint servicos_outro_exige_descricao
    check (tipo <> 'outro' or descricao is not null)
);

comment on table public.servicos is
  'Serviços (manutenções) feitos nos dispositivos. Sem delete (auditoria).';

create index idx_servicos_dispositivo on public.servicos (dispositivo_id, data_servico desc);
create index idx_servicos_data on public.servicos (data_servico);

create trigger trg_servicos_upd before update on public.servicos
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------
-- 3. Anexo precisa existir no bucket ao ser gravado
--    (mesma ideia de validar_nota_fiscal, migration 009)
-- ---------------------------------------------------------
create or replace function public.validar_anexo_servico() returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.anexo_path is not null
     and (tg_op = 'INSERT' or new.anexo_path is distinct from old.anexo_path)
     and not exists (
       select 1 from storage.objects
        where bucket_id = 'servicos' and name = new.anexo_path
     ) then
    raise exception 'Arquivo do anexo não encontrado no Storage';
  end if;
  return new;
end $$;

create trigger trg_servicos_anexo
  before insert or update of anexo_path on public.servicos
  for each row
  execute function public.validar_anexo_servico();

-- ---------------------------------------------------------
-- 4. RLS: select, insert e update para authenticated; sem delete
-- ---------------------------------------------------------
alter table public.servicos enable row level security;

create policy ti_select on public.servicos for select to authenticated using (true);
-- criado_por sempre é quem está logado (o default; não dá para forjar).
create policy ti_insert on public.servicos for insert to authenticated
  with check (criado_por = auth.uid());
create policy ti_update on public.servicos for update to authenticated
  using (true) with check (true);

-- Segunda barreira: sem delete/truncate, e o update só alcança os campos
-- editáveis (dispositivo, autor e datas de registro não mudam).
revoke delete, truncate on public.servicos from anon, authenticated;
revoke update on public.servicos from anon, authenticated;
grant update (tipo, data_servico, fornecedor, custo, na_garantia, descricao, anexo_path)
  on public.servicos to authenticated;
revoke insert, select on public.servicos from anon;

-- ---------------------------------------------------------
-- 5. View para relatório: dispositivo + usuário e loja do vínculo que
--    estava aberto NA DATA do serviço (datas no fuso de Palmas).
--    Serviço feito com o dispositivo sem vínculo (ex.: em manutenção,
--    disponível) fica com loja e usuário nulos.
-- ---------------------------------------------------------
create view public.vw_servicos with (security_invoker = true) as
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
       l.nome              as loja_nome
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

revoke all on public.vw_servicos from anon;
grant select on public.vw_servicos to authenticated;

-- ---------------------------------------------------------
-- 6. Storage: bucket privado "servicos" (PDF, JPG ou PNG, até 10 MB)
--    Caminho: {dispositivo_id}/{timestamp}.{pdf|jpg|png}, na pasta de um
--    dispositivo existente. Sem update/delete (substituir = novo arquivo).
-- ---------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('servicos', 'servicos', false, 10485760,
        array['application/pdf', 'image/jpeg', 'image/png'])
on conflict (id) do nothing;

create policy servicos_select on storage.objects for select to authenticated
  using (bucket_id = 'servicos');

create policy servicos_insert on storage.objects for insert to authenticated
  with check (
    bucket_id = 'servicos'
    and name ~ '^[0-9a-f-]{36}/[0-9]+\.(pdf|jpg|png)$'
    and exists (
      select 1 from public.dispositivos d
       where d.id::text = (storage.foldername(name))[1]
    )
  );

commit;

-- ---------------------------------------------------------
-- Conferência (opcional, rode depois):
-- ---------------------------------------------------------
-- Policies de servicos (esperado: ti_select, ti_insert, ti_update):
--   select policyname, cmd from pg_policies
--    where schemaname = 'public' and tablename = 'servicos';
--
-- Colunas que authenticated pode atualizar (esperado: as 7 editáveis):
--   select column_name from information_schema.column_privileges
--    where table_schema = 'public' and table_name = 'servicos'
--      and grantee = 'authenticated' and privilege_type = 'UPDATE'
--    order by column_name;
--
-- Bucket:
--   select id, public, file_size_limit, allowed_mime_types
--     from storage.buckets where id = 'servicos';
