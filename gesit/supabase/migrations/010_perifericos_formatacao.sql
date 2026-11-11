-- =========================================================
-- GesIT — 010 Periféricos e formatação na entrega e na devolução
-- =========================================================
-- Periféricos permitidos por tipo:
--   notebook → carregador, headset, mouse, suporte_notebook
--   telefone → carregador, chip
--   monitor  → nenhum (e sem "formatado")
--
-- vincular_dispositivo e devolver_dispositivo ganham parâmetros novos. Como
-- a assinatura muda, as versões antigas são removidas (senão ficariam duas
-- sobrecargas e o PostgREST não saberia qual chamar). As novas mantêm
-- security definer, search_path vazio, checagem de auth.uid() e execução
-- só para authenticated (migration 003).
--
-- Tudo em uma transação: se algo falhar, nada é aplicado.
begin;

-- ---------------------------------------------------------
-- 1. Colunas em vinculos
--    perifericos_devolucao / formatado_devolucao: null enquanto o vínculo
--    está aberto, e também quando ele foi encerrado por transferência
--    (não houve conferência) ou antes desta migration.
-- ---------------------------------------------------------
alter table public.vinculos
  add column perifericos_entrega   text[] not null default '{}',
  add column perifericos_devolucao text[],
  add column formatado_entrega     boolean,
  add column formatado_devolucao   boolean;

alter table public.vinculos
  add constraint perifericos_entrega_validos
    check (perifericos_entrega <@ array['carregador', 'headset', 'mouse', 'suporte_notebook', 'chip']),
  add constraint perifericos_devolucao_validos
    check (perifericos_devolucao is null
           or perifericos_devolucao <@ array['carregador', 'headset', 'mouse', 'suporte_notebook', 'chip']),
  add constraint devolucao_so_com_vinculo_encerrado
    check (data_fim is not null
           or (perifericos_devolucao is null and formatado_devolucao is null));

comment on column public.vinculos.perifericos_entrega is
  'Periféricos entregues com o dispositivo (vazio = nenhum).';
comment on column public.vinculos.perifericos_devolucao is
  'Periféricos devolvidos. Null enquanto aberto, em transferências e em vínculos anteriores à migration 010.';
comment on column public.vinculos.formatado_entrega is
  'Dispositivo entregue formatado. Null para monitor e vínculos antigos.';
comment on column public.vinculos.formatado_devolucao is
  'Dispositivo formatado na devolução. Null enquanto aberto, em transferências e para monitor.';

-- ---------------------------------------------------------
-- 2. Validação por tipo (uso interno das funções abaixo)
--    Devolve a lista sem repetição e em ordem alfabética; recusa item que
--    não vale para o tipo e "formatado" em monitor.
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
  v_permitidos text[] := case p_tipo
    when 'notebook' then array['carregador', 'headset', 'mouse', 'suporte_notebook']
    when 'telefone' then array['carregador', 'chip']
    else array[]::text[]
  end;
  v_invalidos text[];
  v_lista     text[];
begin
  if p_tipo = 'monitor' and p_formatado is not null then
    raise exception 'Monitor não tem a opção "formatado"';
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

-- Só as funções security definer (executadas pelo dono) usam esta.
revoke execute on function public.normalizar_perifericos(public.tipo_dispositivo, text[], boolean)
  from public, anon, authenticated;

-- ---------------------------------------------------------
-- 3. vincular_dispositivo
-- ---------------------------------------------------------
drop function if exists public.vincular_dispositivo(uuid, uuid, text, text);

create function public.vincular_dispositivo(
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

-- ---------------------------------------------------------
-- 4. devolver_dispositivo
-- ---------------------------------------------------------
drop function if exists public.devolver_dispositivo(uuid, text, public.status_dispositivo);

create function public.devolver_dispositivo(
  p_dispositivo_id          uuid,
  p_observacao              text    default null,
  p_novo_status             public.status_dispositivo default 'disponivel',
  p_perifericos_devolvidos  text[]  default '{}',
  p_formatado               boolean default null
) returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid         uuid := auth.uid();
  v_tipo        public.tipo_dispositivo;
  v_perifericos text[];
begin
  if v_uid is null then
    raise exception 'Não autenticado' using errcode = '42501';
  end if;
  if p_novo_status = 'em_uso' then
    raise exception 'Status inválido para devolução';
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
   where dispositivo_id = p_dispositivo_id and data_fim is null;
  if not found then raise exception 'Dispositivo não possui vínculo aberto'; end if;

  update public.dispositivos set status = p_novo_status where id = p_dispositivo_id;
end $$;

-- ---------------------------------------------------------
-- 5. Permissões de execução: só usuários autenticados
-- ---------------------------------------------------------
revoke execute on function public.vincular_dispositivo(uuid, uuid, text, text, text[], boolean)
  from public, anon;
grant  execute on function public.vincular_dispositivo(uuid, uuid, text, text, text[], boolean)
  to authenticated;

revoke execute on function public.devolver_dispositivo(uuid, text, public.status_dispositivo, text[], boolean)
  from public, anon;
grant  execute on function public.devolver_dispositivo(uuid, text, public.status_dispositivo, text[], boolean)
  to authenticated;

-- PostgREST: recarrega o cache de funções (assinaturas novas).
notify pgrst, 'reload schema';

commit;

-- ---------------------------------------------------------
-- Conferência (opcional, rode depois):
-- ---------------------------------------------------------
-- Uma versão de cada função, security definer, search_path vazio:
--   select p.oid::regprocedure, p.prosecdef, p.proconfig
--     from pg_proc p
--    where p.pronamespace = 'public'::regnamespace
--      and p.proname in ('vincular_dispositivo', 'devolver_dispositivo', 'normalizar_perifericos');
--
-- Quem pode executar (esperado: authenticated nas duas primeiras; ninguém além
-- do dono em normalizar_perifericos):
--   select p.proname, a.grantee::regrole
--     from pg_proc p, aclexplode(p.proacl) a
--    where p.pronamespace = 'public'::regnamespace
--      and p.proname in ('vincular_dispositivo', 'devolver_dispositivo', 'normalizar_perifericos');
