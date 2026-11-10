-- =========================================================
-- GesIT — 003 Protege o histórico de vínculos
-- =========================================================
-- Vínculos passam a ser criados/alterados SOMENTE pelas funções
-- vincular_dispositivo, devolver_dispositivo e anexar_termo, que viram
-- security definer. Usuários autenticados continuam podendo LER vinculos
-- (policy ti_select), mas não escrevem mais direto na tabela.
--
-- Tudo em uma transação: se algo falhar, nada é aplicado.
begin;

-- ---------------------------------------------------------
-- 1. Sem escrita direta em vinculos
-- ---------------------------------------------------------
drop policy if exists ti_insert on public.vinculos;
drop policy if exists ti_update on public.vinculos;

-- Segunda barreira: mesmo que o RLS seja desligado por engano, anon e
-- authenticated não têm privilégio de escrita na tabela.
revoke insert, update, delete, truncate on public.vinculos from anon, authenticated;

-- ---------------------------------------------------------
-- 2. vincular_dispositivo — security definer
--    search_path vazio + nomes qualificados (recomendação do Supabase
--    para security definer: nada pode "sombrear" tabelas ou funções).
-- ---------------------------------------------------------
create or replace function public.vincular_dispositivo(
  p_dispositivo_id uuid,
  p_colaborador_id uuid,
  p_termo_path     text default null,
  p_observacao     text default null
) returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid    uuid := auth.uid();
  v_status public.status_dispositivo;
  v_loja   uuid;
  v_atual  uuid;
  v_id     uuid;
begin
  if v_uid is null then
    raise exception 'Não autenticado' using errcode = '42501';
  end if;

  -- Ordem de travas: dispositivo → colaborador → vínculos (igual em devolver).
  select status into v_status
    from public.dispositivos
   where id = p_dispositivo_id
     for update;
  if not found then raise exception 'Dispositivo não encontrado'; end if;
  if v_status in ('manutencao', 'baixado') then
    raise exception 'Dispositivo indisponível (status: %)', v_status;
  end if;

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

  update public.vinculos
     set data_fim = now(),
         encerrado_por = v_uid,
         observacao_devolucao = 'Encerrado por transferência'
   where dispositivo_id = p_dispositivo_id and data_fim is null;

  insert into public.vinculos
    (dispositivo_id, colaborador_id, loja_id, termo_path, observacao, criado_por)
  values
    (p_dispositivo_id, p_colaborador_id, v_loja, p_termo_path, p_observacao, v_uid)
  returning id into v_id;

  update public.dispositivos set status = 'em_uso' where id = p_dispositivo_id;
  return v_id;
end $$;

-- ---------------------------------------------------------
-- 3. devolver_dispositivo — security definer
--    Agora trava o dispositivo ANTES do vínculo (mesma ordem de
--    vincular_dispositivo), evitando deadlock entre devolução e
--    transferência simultâneas do mesmo aparelho.
-- ---------------------------------------------------------
create or replace function public.devolver_dispositivo(
  p_dispositivo_id uuid,
  p_observacao     text default null,
  p_novo_status    public.status_dispositivo default 'disponivel'
) returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'Não autenticado' using errcode = '42501';
  end if;
  if p_novo_status = 'em_uso' then
    raise exception 'Status inválido para devolução';
  end if;

  perform 1 from public.dispositivos where id = p_dispositivo_id for update;
  if not found then raise exception 'Dispositivo não encontrado'; end if;

  update public.vinculos
     set data_fim = now(),
         encerrado_por = v_uid,
         observacao_devolucao = p_observacao
   where dispositivo_id = p_dispositivo_id and data_fim is null;
  if not found then raise exception 'Dispositivo não possui vínculo aberto'; end if;

  update public.dispositivos set status = p_novo_status where id = p_dispositivo_id;
end $$;

-- ---------------------------------------------------------
-- 4. anexar_termo — security definer
--    Só grava se termo_path estiver nulo; caminho precisa ser
--    {dispositivo_id}/{timestamp}_{colaborador_id}.pdf deste vínculo.
-- ---------------------------------------------------------
create or replace function public.anexar_termo(
  p_vinculo_id uuid,
  p_termo_path text
) returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid         uuid := auth.uid();
  v_dispositivo uuid;
  v_colaborador uuid;
  v_termo       text;
begin
  if v_uid is null then
    raise exception 'Não autenticado' using errcode = '42501';
  end if;

  select dispositivo_id, colaborador_id, termo_path
    into v_dispositivo, v_colaborador, v_termo
    from public.vinculos
   where id = p_vinculo_id
     for update;
  if not found then raise exception 'Vínculo não encontrado'; end if;
  if v_termo is not null then
    raise exception 'Este vínculo já possui termo anexado';
  end if;

  if p_termo_path is null
     or p_termo_path !~ ('^' || v_dispositivo::text || '/[0-9]+_'
                         || v_colaborador::text || '\.pdf$') then
    raise exception 'Arquivo do termo inválido';
  end if;

  if not exists (
    select 1 from storage.objects
     where bucket_id = 'termos' and name = p_termo_path
  ) then
    raise exception 'Arquivo do termo não encontrado no Storage';
  end if;

  update public.vinculos set termo_path = p_termo_path where id = p_vinculo_id;
end $$;

-- ---------------------------------------------------------
-- 5. Trigger de inativação (já era security definer): mesmo
--    endurecimento de search_path das demais funções.
-- ---------------------------------------------------------
create or replace function public.impedir_inativar_com_vinculo() returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if exists (
    select 1 from public.vinculos
     where colaborador_id = new.id and data_fim is null
  ) then
    raise exception 'Devolva ou transfira os dispositivos antes de inativar';
  end if;
  return new;
end $$;

-- ---------------------------------------------------------
-- 6. Permissões de execução (reafirmadas): só usuários autenticados.
-- ---------------------------------------------------------
revoke execute on function public.vincular_dispositivo(uuid, uuid, text, text)        from public, anon;
revoke execute on function public.devolver_dispositivo(uuid, text, public.status_dispositivo) from public, anon;
revoke execute on function public.anexar_termo(uuid, text)                             from public, anon;
grant  execute on function public.vincular_dispositivo(uuid, uuid, text, text)        to authenticated;
grant  execute on function public.devolver_dispositivo(uuid, text, public.status_dispositivo) to authenticated;
grant  execute on function public.anexar_termo(uuid, text)                             to authenticated;

commit;

-- ---------------------------------------------------------
-- Conferência (opcional, rode depois):
-- ---------------------------------------------------------
-- Policies restantes em vinculos (esperado: só ti_select):
--   select policyname, cmd from pg_policies
--    where schemaname = 'public' and tablename = 'vinculos';
--
-- Funções como security definer com search_path vazio (esperado: 4 linhas, prosecdef = true):
--   select proname, prosecdef, proconfig from pg_proc
--    where pronamespace = 'public'::regnamespace
--      and proname in ('vincular_dispositivo', 'devolver_dispositivo',
--                      'anexar_termo', 'impedir_inativar_com_vinculo');
