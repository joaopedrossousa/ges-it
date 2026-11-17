-- =========================================================
-- GesIT — 021 Dispositivo baixado não recebe imagens novas
-- =========================================================
-- - adicionar_imagens_dispositivo (020) passa a recusar dispositivo baixado.
--   Mesma assinatura e corpo da 020; só muda a leitura do dispositivo, que
--   agora trava a linha (for share) e confere o status. A trava espera uma
--   baixa em andamento (baixar_dispositivo usa for update), então não há
--   imagem nova "entrando" junto com a baixa.
-- - Policy de upload do bucket "imagens-dispositivos": também recusa a
--   pasta de um dispositivo baixado (segunda barreira; evita arquivo órfão).
-- - As imagens que já existem continuam visíveis, e remover uma imagem
--   enviada por engano continua permitido (remover_imagem_dispositivo).
--
-- Tudo em uma transação: se algo falhar, nada é aplicado.
begin;

create or replace function public.adicionar_imagens_dispositivo(
  p_dispositivo_id uuid,
  p_momento        public.momento_imagem,
  p_imagens        jsonb,
  p_vinculo_id     uuid default null
) returns uuid[]
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid     uuid := auth.uid();
  v_status  public.status_dispositivo;
  v_imagens jsonb := coalesce(p_imagens, '[]'::jsonb);
  v_item    jsonb;
  v_path    text;
  v_legenda text;
  v_paths   text[] := '{}';
  v_ids     uuid[] := '{}';
  v_id      uuid;
begin
  if v_uid is null then
    raise exception 'Não autenticado' using errcode = '42501';
  end if;

  select status into v_status
    from public.dispositivos
   where id = p_dispositivo_id
     for share;
  if not found then raise exception 'Dispositivo não encontrado'; end if;
  if v_status = 'baixado' then
    raise exception 'Dispositivo baixado não aceita novas imagens';
  end if;

  if p_momento is null then
    raise exception 'Informe o momento da imagem';
  end if;

  -- Vínculo: obrigatório na entrega/transferência/devolução, proibido no
  -- cadastro, e sempre deste dispositivo.
  if p_momento in ('entrega', 'transferencia', 'devolucao') and p_vinculo_id is null then
    raise exception 'Imagens de entrega, transferência ou devolução precisam do vínculo';
  end if;
  if p_momento = 'cadastro' and p_vinculo_id is not null then
    raise exception 'Imagens do cadastro não são ligadas a um vínculo';
  end if;
  if p_vinculo_id is not null and not exists (
    select 1 from public.vinculos
     where id = p_vinculo_id and dispositivo_id = p_dispositivo_id
  ) then
    raise exception 'Vínculo não encontrado para este dispositivo';
  end if;
  if p_momento = 'devolucao' and exists (
    select 1 from public.vinculos where id = p_vinculo_id and data_fim is null
  ) then
    raise exception 'Imagens de devolução só depois de registrar a devolução';
  end if;

  if jsonb_typeof(v_imagens) <> 'array' or jsonb_array_length(v_imagens) = 0 then
    raise exception 'Envie ao menos uma imagem';
  end if;
  if jsonb_array_length(v_imagens) > 20 then
    raise exception 'Envie no máximo 20 imagens por vez';
  end if;

  for v_item in select * from jsonb_array_elements(v_imagens) loop
    v_path := v_item ->> 'path';
    v_legenda := nullif(btrim(coalesce(v_item ->> 'legenda', '')), '');

    if v_path is null
       or v_path !~ ('^' || p_dispositivo_id::text || '/[0-9]+-[a-z0-9]{8}\.(jpg|png|webp)$') then
      raise exception 'Arquivo de imagem inválido';
    end if;
    if v_path = any (v_paths) then
      raise exception 'Imagem repetida';
    end if;
    if char_length(v_legenda) > 200 then
      raise exception 'A legenda deve ter no máximo 200 caracteres';
    end if;
    if not exists (
      select 1 from storage.objects
       where bucket_id = 'imagens-dispositivos' and name = v_path
    ) then
      raise exception 'Arquivo de imagem não encontrado no Storage';
    end if;
    v_paths := v_paths || v_path;

    insert into public.dispositivo_imagens
      (dispositivo_id, vinculo_id, momento, legenda, path, criado_por)
    values
      (p_dispositivo_id, p_vinculo_id, p_momento, v_legenda, v_path, v_uid)
    returning id into v_id;
    v_ids := v_ids || v_id;
  end loop;

  return v_ids;
end $$;

-- Mesma assinatura: os grants da 020 continuam; reafirmados.
revoke execute on function public.adicionar_imagens_dispositivo(uuid, public.momento_imagem, jsonb, uuid)
  from public, anon;
grant  execute on function public.adicionar_imagens_dispositivo(uuid, public.momento_imagem, jsonb, uuid)
  to authenticated;

drop policy if exists imagens_dispositivos_insert on storage.objects;

create policy imagens_dispositivos_insert on storage.objects for insert to authenticated
  with check (
    bucket_id = 'imagens-dispositivos'
    and name ~ '^[0-9a-f-]{36}/[0-9]+-[a-z0-9]{8}\.(jpg|png|webp)$'
    and exists (
      select 1 from public.dispositivos d
       where d.id::text = (storage.foldername(name))[1]
         and d.status <> 'baixado'
    )
  );

commit;

-- ---------------------------------------------------------
-- Conferência (opcional, rode depois). A recusa em si só dá para testar pelo
-- app: no SQL Editor auth.uid() é nulo e a função para em "Não autenticado".
-- ---------------------------------------------------------
-- Policy de upload com a condição nova (esperado: "status <> 'baixado'" no texto):
-- select policyname, with_check from pg_policies
--  where schemaname = 'storage' and policyname = 'imagens_dispositivos_insert';
--
-- Corpo da função com a checagem nova (esperado: true):
-- select prosrc like '%não aceita novas imagens%' from pg_proc
--  where proname = 'adicionar_imagens_dispositivo';
