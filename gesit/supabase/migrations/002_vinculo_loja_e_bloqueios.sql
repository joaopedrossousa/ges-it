-- =========================================================
-- GesIT — 002 Loja no vínculo, bloqueios e anexo de termo
-- =========================================================
-- Tudo em uma transação: se algo falhar, nada é aplicado.
begin;

-- ---------------------------------------------------------
-- 1. Loja do vínculo
--    Guarda a loja do colaborador no momento da entrega, para o
--    histórico não mudar quando ele trocar de filial.
-- ---------------------------------------------------------
alter table vinculos add column loja_id uuid references lojas(id);

update vinculos v
   set loja_id = c.loja_id
  from colaboradores c
 where c.id = v.colaborador_id
   and v.loja_id is null;

alter table vinculos alter column loja_id set not null;

create index idx_vinculos_loja on vinculos (loja_id);

-- ---------------------------------------------------------
-- 2. vincular_dispositivo: trava o colaborador e grava a loja dele
--    (mesma assinatura: as permissões de execução são mantidas)
-- ---------------------------------------------------------
create or replace function vincular_dispositivo(
  p_dispositivo_id uuid,
  p_colaborador_id uuid,
  p_termo_path     text default null,
  p_observacao     text default null
) returns uuid
language plpgsql security invoker set search_path = public as $$
declare
  v_status status_dispositivo;
  v_loja   uuid;
  v_atual  uuid;
  v_id     uuid;
begin
  select status into v_status from dispositivos where id = p_dispositivo_id for update;
  if not found then raise exception 'Dispositivo não encontrado'; end if;
  if v_status in ('manutencao', 'baixado') then
    raise exception 'Dispositivo indisponível (status: %)', v_status;
  end if;

  -- Trava a linha do colaborador. Com isso, uma inativação simultânea
  -- espera este vínculo terminar (e é barrada pela trigger), ou este
  -- vínculo espera a inativação e cai aqui por ativo = false.
  select loja_id into v_loja
    from colaboradores
   where id = p_colaborador_id and ativo
     for update;
  if not found then raise exception 'Colaborador inativo ou inexistente'; end if;

  select colaborador_id into v_atual
    from vinculos where dispositivo_id = p_dispositivo_id and data_fim is null;
  if v_atual = p_colaborador_id then
    raise exception 'Dispositivo já está vinculado a este colaborador';
  end if;

  update vinculos
     set data_fim = now(), encerrado_por = auth.uid(),
         observacao_devolucao = 'Encerrado por transferência'
   where dispositivo_id = p_dispositivo_id and data_fim is null;

  insert into vinculos (dispositivo_id, colaborador_id, loja_id, termo_path, observacao)
  values (p_dispositivo_id, p_colaborador_id, v_loja, p_termo_path, p_observacao)
  returning id into v_id;

  update dispositivos set status = 'em_uso' where id = p_dispositivo_id;
  return v_id;
end $$;

-- ---------------------------------------------------------
-- 3. Bloqueia inativar colaborador com vínculo aberto
--    security definer: a checagem não depende do RLS de quem atualiza.
-- ---------------------------------------------------------
create or replace function impedir_inativar_com_vinculo() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if exists (
    select 1 from vinculos
     where colaborador_id = new.id and data_fim is null
  ) then
    raise exception 'Devolva ou transfira os dispositivos antes de inativar';
  end if;
  return new;
end $$;

create trigger trg_colaboradores_bloqueia_inativacao
  before update of ativo on colaboradores
  for each row
  when (old.ativo and not new.ativo)
  execute function impedir_inativar_com_vinculo();

-- ---------------------------------------------------------
-- 4. View: loja do vínculo aberto (não a loja atual do colaborador)
--    loja_id é nova e vai no fim (exigência do create or replace view).
-- ---------------------------------------------------------
create or replace view vw_dispositivos with (security_invoker = true) as
select d.*,
       v.id          as vinculo_id,
       v.data_inicio as vinculado_em,
       v.termo_path  as termo_atual,
       c.id          as colaborador_id,
       c.nome        as colaborador_nome,
       l.nome        as loja_nome,
       v.loja_id     as loja_id
from dispositivos d
left join vinculos v      on v.dispositivo_id = d.id and v.data_fim is null
left join colaboradores c on c.id = v.colaborador_id
left join lojas l         on l.id = v.loja_id;

-- ---------------------------------------------------------
-- 5. Anexar termo a um vínculo que ainda não tem
--    Função em vez de policy: a policy ti_update atual já libera qualquer
--    update em vinculos, e policies permissivas se somam (OR); uma policy
--    "só se termo_path for nulo" não restringiria nada.
-- ---------------------------------------------------------
create or replace function anexar_termo(
  p_vinculo_id uuid,
  p_termo_path text
) returns void
language plpgsql security invoker set search_path = public as $$
declare
  v_dispositivo uuid;
  v_termo       text;
begin
  select dispositivo_id, termo_path into v_dispositivo, v_termo
    from vinculos where id = p_vinculo_id
     for update;
  if not found then raise exception 'Vínculo não encontrado'; end if;
  if v_termo is not null then
    raise exception 'Este vínculo já possui termo anexado';
  end if;

  -- Só aceita PDF na pasta do próprio dispositivo: <dispositivo_id>/<nome>.pdf
  if p_termo_path is null
     or p_termo_path !~ ('^' || v_dispositivo::text || '/[A-Za-z0-9_-]+\.pdf$') then
    raise exception 'Arquivo do termo inválido';
  end if;

  if not exists (
    select 1 from storage.objects
     where bucket_id = 'termos' and name = p_termo_path
  ) then
    raise exception 'Arquivo do termo não encontrado no Storage';
  end if;

  update vinculos set termo_path = p_termo_path where id = p_vinculo_id;
end $$;

revoke execute on function anexar_termo(uuid, text) from public, anon;
grant  execute on function anexar_termo(uuid, text) to authenticated;

commit;

-- ---------------------------------------------------------
-- Conferência (opcional, rode depois): colaboradores que JÁ estavam
-- inativos com vínculo aberto antes desta migration. A trigger só barra
-- novas inativações; estes casos precisam de devolução manual.
-- ---------------------------------------------------------
-- select c.id, c.nome, count(*) as vinculos_abertos
--   from colaboradores c
--   join vinculos v on v.colaborador_id = c.id and v.data_fim is null
--  where not c.ativo
--  group by c.id, c.nome;
