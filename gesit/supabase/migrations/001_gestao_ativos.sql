
-- =========================================================
-- GesIT — 001 Gestão de Ativos
-- =========================================================

-- Tipos
create type tipo_dispositivo   as enum ('notebook', 'telefone');
create type status_dispositivo as enum ('disponivel', 'em_uso', 'manutencao', 'baixado');

-- Atualiza updated_at automaticamente
create or replace function set_updated_at() returns trigger
language plpgsql as $$
begin new.updated_at = now(); return new; end $$;

-- Lojas / Filiais
create table lojas (
  id         uuid primary key default gen_random_uuid(),
  nome       text not null unique,
  cidade     text,
  ativo      boolean not null default true,
  created_at timestamptz not null default now()
);

-- Colaboradores ("Usuários" na tela)
create table colaboradores (
  id         uuid primary key default gen_random_uuid(),
  nome       text not null,
  loja_id    uuid not null references lojas(id),
  cpf        text not null unique check (cpf ~ '^[0-9]{11}$'),
  email      text not null unique check (email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  ativo      boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger trg_colaboradores_upd before update on colaboradores
  for each row execute function set_updated_at();

-- Dispositivos
create table dispositivos (
  id            uuid primary key default gen_random_uuid(),
  tipo          tipo_dispositivo not null,
  marca         text not null,
  modelo        text not null,
  serial_number text unique,
  imei1         text unique check (imei1 ~ '^[0-9]{15}$'),
  imei2         text unique check (imei2 ~ '^[0-9]{15}$'),
  status        status_dispositivo not null default 'disponivel',
  observacao    text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  constraint notebook_exige_serial check (tipo <> 'notebook' or serial_number is not null),
  constraint telefone_exige_imei1  check (tipo <> 'telefone' or imei1 is not null),
  constraint imeis_diferentes      check (imei2 is null or imei2 <> imei1)
);
create trigger trg_dispositivos_upd before update on dispositivos
  for each row execute function set_updated_at();

-- Vínculos (histórico de uso)
create table vinculos (
  id                   uuid primary key default gen_random_uuid(),
  dispositivo_id       uuid not null references dispositivos(id),
  colaborador_id       uuid not null references colaboradores(id),
  data_inicio          timestamptz not null default now(),
  data_fim             timestamptz,
  termo_path           text,
  observacao           text,
  observacao_devolucao text,
  criado_por           uuid references auth.users(id) default auth.uid(),
  encerrado_por        uuid references auth.users(id),
  created_at           timestamptz not null default now(),
  constraint periodo_valido check (data_fim is null or data_fim >= data_inicio)
);
create unique index vinculo_aberto_unico on vinculos (dispositivo_id) where data_fim is null;
create index idx_vinculos_colaborador on vinculos (colaborador_id);
create index idx_vinculos_dispositivo on vinculos (dispositivo_id, data_inicio desc);

-- View: dispositivo + usuário atual
create view vw_dispositivos with (security_invoker = true) as
select d.*,
       v.id          as vinculo_id,
       v.data_inicio as vinculado_em,
       v.termo_path  as termo_atual,
       c.id          as colaborador_id,
       c.nome        as colaborador_nome,
       l.nome        as loja_nome
from dispositivos d
left join vinculos v      on v.dispositivo_id = d.id and v.data_fim is null
left join colaboradores c on c.id = v.colaborador_id
left join lojas l         on l.id = c.loja_id;

-- Vincular (transfere automaticamente se já houver usuário)
create or replace function vincular_dispositivo(
  p_dispositivo_id uuid,
  p_colaborador_id uuid,
  p_termo_path     text default null,
  p_observacao     text default null
) returns uuid
language plpgsql security invoker set search_path = public as $$
declare
  v_status status_dispositivo;
  v_atual  uuid;
  v_id     uuid;
begin
  select status into v_status from dispositivos where id = p_dispositivo_id for update;
  if not found then raise exception 'Dispositivo não encontrado'; end if;
  if v_status in ('manutencao', 'baixado') then
    raise exception 'Dispositivo indisponível (status: %)', v_status;
  end if;
  if not exists (select 1 from colaboradores where id = p_colaborador_id and ativo) then
    raise exception 'Colaborador inativo ou inexistente';
  end if;

  select colaborador_id into v_atual
    from vinculos where dispositivo_id = p_dispositivo_id and data_fim is null;
  if v_atual = p_colaborador_id then
    raise exception 'Dispositivo já está vinculado a este colaborador';
  end if;

  update vinculos
     set data_fim = now(), encerrado_por = auth.uid(),
         observacao_devolucao = 'Encerrado por transferência'
   where dispositivo_id = p_dispositivo_id and data_fim is null;

  insert into vinculos (dispositivo_id, colaborador_id, termo_path, observacao)
  values (p_dispositivo_id, p_colaborador_id, p_termo_path, p_observacao)
  returning id into v_id;

  update dispositivos set status = 'em_uso' where id = p_dispositivo_id;
  return v_id;
end $$;

-- Devolver (encerra o vínculo aberto)
create or replace function devolver_dispositivo(
  p_dispositivo_id uuid,
  p_observacao     text default null,
  p_novo_status    status_dispositivo default 'disponivel'
) returns void
language plpgsql security invoker set search_path = public as $$
begin
  if p_novo_status = 'em_uso' then
    raise exception 'Status inválido para devolução';
  end if;
  update vinculos
     set data_fim = now(), encerrado_por = auth.uid(), observacao_devolucao = p_observacao
   where dispositivo_id = p_dispositivo_id and data_fim is null;
  if not found then raise exception 'Dispositivo não possui vínculo aberto'; end if;
  update dispositivos set status = p_novo_status where id = p_dispositivo_id;
end $$;

revoke execute on function vincular_dispositivo(uuid, uuid, text, text) from public, anon;
revoke execute on function devolver_dispositivo(uuid, text, status_dispositivo) from public, anon;
grant  execute on function vincular_dispositivo(uuid, uuid, text, text) to authenticated;
grant  execute on function devolver_dispositivo(uuid, text, status_dispositivo) to authenticated;

-- RLS: só a equipe de TI logada acessa; sem DELETE (auditoria)
alter table lojas         enable row level security;
alter table colaboradores enable row level security;
alter table dispositivos  enable row level security;
alter table vinculos      enable row level security;

create policy ti_select on lojas         for select to authenticated using (true);
create policy ti_insert on lojas         for insert to authenticated with check (true);
create policy ti_update on lojas         for update to authenticated using (true) with check (true);
create policy ti_select on colaboradores for select to authenticated using (true);
create policy ti_insert on colaboradores for insert to authenticated with check (true);
create policy ti_update on colaboradores for update to authenticated using (true) with check (true);
create policy ti_select on dispositivos  for select to authenticated using (true);
create policy ti_insert on dispositivos  for insert to authenticated with check (true);
create policy ti_update on dispositivos  for update to authenticated using (true) with check (true);
create policy ti_select on vinculos      for select to authenticated using (true);
create policy ti_insert on vinculos      for insert to authenticated with check (true);
create policy ti_update on vinculos      for update to authenticated using (true) with check (true);

-- Storage: bucket privado só para PDF de até 5 MB
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('termos', 'termos', false, 5242880, array['application/pdf'])
on conflict (id) do nothing;

create policy termos_select on storage.objects for select to authenticated
  using (bucket_id = 'termos');
create policy termos_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'termos');

-- Carga inicial
insert into lojas (nome, cidade) values
  ('Matriz Palmas',      'Palmas'),
  ('Filial Balsas',      'Balsas'),
  ('Filial Açailândia',  'Açailândia'),
  ('Filial Bom Jesus',   'Bom Jesus'),
  ('Filial Dom Eliseu',  'Dom Eliseu'),
  ('Filial Guaraí',      'Guaraí'),
  ('Filial Gurupi',      'Gurupi'),
  ('Filial Araguaína',   'Araguaína'),
  ('Filial Porangatu',   'Porangatu');