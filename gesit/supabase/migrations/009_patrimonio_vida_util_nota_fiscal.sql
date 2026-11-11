-- =========================================================
-- GesIT — 009 Patrimônio, linha telefônica, vida útil e nota fiscal
-- =========================================================
-- Pré-requisito: 008 (valor 'monitor' no enum tipo_dispositivo) já aplicada
-- em execução separada.
--
-- Tudo em uma transação: se algo falhar, nada é aplicado.
begin;

-- ---------------------------------------------------------
-- 1. Novas colunas (todas opcionais no banco: dispositivos antigos não
--    têm data de compra; a obrigatoriedade no cadastro novo fica na app)
-- ---------------------------------------------------------
alter table public.dispositivos
  add column numero_patrimonio text
    constraint dispositivos_numero_patrimonio_key unique
    constraint numero_patrimonio_valido
      check (numero_patrimonio = btrim(numero_patrimonio)
             and char_length(numero_patrimonio) between 1 and 50),
  add column numero_linha text
    -- Só dígitos, com DDD: 10 (fixo) ou 11 (celular).
    constraint numero_linha_valido check (numero_linha ~ '^[0-9]{10,11}$'),
  add column operadora text
    constraint operadora_valida
      check (operadora in ('Vivo', 'Claro', 'TIM', 'Oi', 'Algar', 'Outra')),
  add column data_compra date,
  add column fim_vida_util date,
  add column nota_fiscal_path text;

comment on column public.dispositivos.numero_patrimonio is
  'Número de patrimônio (etiqueta). Único; obrigatório para monitor.';
comment on column public.dispositivos.numero_linha is
  'Número da linha com DDD, só dígitos (10 ou 11). Só telefone.';
comment on column public.dispositivos.operadora is
  'Operadora da linha: Vivo, Claro, TIM, Oi, Algar ou Outra. Só telefone.';
comment on column public.dispositivos.data_compra is
  'Data de compra (base da idade do dispositivo).';
comment on column public.dispositivos.fim_vida_util is
  'Data prevista para a troca (fim da vida útil).';
comment on column public.dispositivos.nota_fiscal_path is
  'Caminho no bucket notas-fiscais: {dispositivo_id}/{timestamp}.{pdf|jpg|png}.';

-- ---------------------------------------------------------
-- 2. Regras por tipo
--    As checks antigas são recriadas com o mesmo nome e escritas como
--    "regra do tipo X" (tipo <> X or ...), para valerem só no próprio tipo
--    e conviverem com monitor.
-- ---------------------------------------------------------
alter table public.dispositivos
  drop constraint if exists notebook_exige_serial,
  drop constraint if exists telefone_exige_imei1;

alter table public.dispositivos
  add constraint notebook_exige_serial
    check (tipo <> 'notebook' or serial_number is not null),
  add constraint telefone_exige_imei1
    check (tipo <> 'telefone' or imei1 is not null),
  add constraint monitor_exige_patrimonio
    check (tipo <> 'monitor'
           or (numero_patrimonio is not null
               and serial_number is null
               and imei1 is null
               and imei2 is null)),
  add constraint linha_so_telefone
    check (tipo = 'telefone' or (numero_linha is null and operadora is null)),
  add constraint vida_util_valida
    check (fim_vida_util is null or data_compra is null or fim_vida_util >= data_compra),
  -- Arquivo sempre na pasta do próprio dispositivo.
  add constraint nota_fiscal_path_valido
    check (nota_fiscal_path ~ ('^' || id::text || '/[0-9]+\.(pdf|jpg|png)$'));

-- ---------------------------------------------------------
-- 3. Nota fiscal precisa existir no bucket ao ser gravada
--    security definer: lê storage.objects independente do RLS de quem grava.
-- ---------------------------------------------------------
create or replace function public.validar_nota_fiscal() returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.nota_fiscal_path is not null
     and (tg_op = 'INSERT' or new.nota_fiscal_path is distinct from old.nota_fiscal_path)
     and not exists (
       select 1 from storage.objects
        where bucket_id = 'notas-fiscais' and name = new.nota_fiscal_path
     ) then
    raise exception 'Arquivo da nota fiscal não encontrado no Storage';
  end if;
  return new;
end $$;

create trigger trg_dispositivos_nota_fiscal
  before insert or update of nota_fiscal_path on public.dispositivos
  for each row
  execute function public.validar_nota_fiscal();

-- ---------------------------------------------------------
-- 4. View recriada (drop + create: colunas novas no meio de d.* mudariam
--    a posição das colunas, o que "create or replace view" não aceita)
--
--    idade_meses: meses completos desde a compra.
--    situacao_vida_util:
--      'baixado'  dispositivo baixado (fica fora dos alertas)
--      'sem_data' sem fim_vida_util
--      'vencido'  fim_vida_util já passou
--      'proximo'  faltam 6 meses ou menos
--      'ok'       faltam mais de 6 meses
--    "Hoje" é a data de Palmas (America/Araguaina), não a do servidor (UTC).
-- ---------------------------------------------------------
drop view if exists public.vw_dispositivos;

create view public.vw_dispositivos with (security_invoker = true) as
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
       end as situacao_vida_util
from public.dispositivos d
cross join lateral (
  select (now() at time zone 'America/Araguaina')::date as hoje
) h
left join public.vinculos v      on v.dispositivo_id = d.id and v.data_fim is null
left join public.colaboradores c on c.id = v.colaborador_id
left join public.lojas l         on l.id = v.loja_id;

grant select on public.vw_dispositivos to authenticated;

-- ---------------------------------------------------------
-- 5. Storage: bucket privado "notas-fiscais" (PDF, JPG ou PNG, até 10 MB)
--    Caminho: {dispositivo_id}/{timestamp}.{pdf|jpg|png}, na pasta de um
--    dispositivo existente. Sem update/delete (substituir = novo arquivo).
-- ---------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('notas-fiscais', 'notas-fiscais', false, 10485760,
        array['application/pdf', 'image/jpeg', 'image/png'])
on conflict (id) do nothing;

create policy notas_fiscais_select on storage.objects for select to authenticated
  using (bucket_id = 'notas-fiscais');

create policy notas_fiscais_insert on storage.objects for insert to authenticated
  with check (
    bucket_id = 'notas-fiscais'
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
-- Checks de dispositivos (esperado: as 5 de tipo/linha/vida útil + nota fiscal):
--   select conname, pg_get_constraintdef(oid) from pg_constraint
--    where conrelid = 'public.dispositivos'::regclass and contype = 'c'
--    order by conname;
--
-- Situação da vida útil por tipo:
--   select tipo, situacao_vida_util, count(*) from public.vw_dispositivos
--    group by 1, 2 order by 1, 2;
--
-- Bucket:
--   select id, public, file_size_limit, allowed_mime_types
--     from storage.buckets where id = 'notas-fiscais';
