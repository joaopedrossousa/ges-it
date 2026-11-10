-- =========================================================
-- GesIT — 004 Status do dispositivo coerente com o vínculo
-- =========================================================
-- Regra: status = 'em_uso'  <=>  existe vínculo aberto (data_fim nula).
--   - Com vínculo aberto, o status não pode deixar de ser 'em_uso'
--     (é preciso devolver ou transferir antes).
--   - Sem vínculo aberto, o status não pode virar 'em_uso'
--     (só vincular_dispositivo coloca em uso, depois de criar o vínculo).
--
-- As funções já respeitam a ordem:
--   vincular_dispositivo: cria o vínculo  -> depois status = 'em_uso'
--   devolver_dispositivo: encerra vínculo -> depois status = novo status
--
-- Tudo em uma transação: se algo falhar, nada é aplicado.
begin;

create or replace function public.validar_status_dispositivo() returns trigger
language plpgsql
security definer   -- a checagem não depende do RLS de quem atualiza
set search_path = ''
as $$
declare
  v_vinculo_aberto boolean;
begin
  if tg_op = 'INSERT' then
    -- Dispositivo novo não tem vínculo: não pode nascer "em uso".
    if new.status = 'em_uso' then
      raise exception 'O status "em uso" só pode ser definido ao vincular o dispositivo';
    end if;
    return new;
  end if;

  -- UPDATE (a trigger só dispara quando o status muda; ver WHEN abaixo)
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

  return new;
end $$;

create trigger trg_dispositivos_status_insert
  before insert on public.dispositivos
  for each row
  execute function public.validar_status_dispositivo();

-- Só quando o status realmente muda: editar marca/modelo/observação de um
-- dispositivo em uso não é bloqueado.
create trigger trg_dispositivos_status_update
  before update of status on public.dispositivos
  for each row
  when (old.status is distinct from new.status)
  execute function public.validar_status_dispositivo();

commit;

-- ---------------------------------------------------------
-- Conferência (opcional, rode ANTES ou depois): dispositivos que já estão
-- incoerentes. A trigger não altera dados existentes; esses casos se
-- corrigem pelos fluxos normais (Status -> Disponível quando não há
-- vínculo; Transferir/Devolver quando há).
-- ---------------------------------------------------------
-- select d.id, d.marca, d.modelo, d.status,
--        (v.id is not null) as tem_vinculo_aberto
--   from public.dispositivos d
--   left join public.vinculos v
--          on v.dispositivo_id = d.id and v.data_fim is null
--  where (d.status = 'em_uso') <> (v.id is not null);
