-- =========================================================
-- GesIT — 020 Imagens do item (estado no cadastro, entrega,
--             transferência e devolução)
-- =========================================================
-- - dispositivo_imagens: imagem de um dispositivo, com o momento em que foi
--   registrada e, na entrega/transferência/devolução, o vínculo.
--   Nunca é apagada: "remover" marca removida = true (com quem e quando).
-- - Bucket privado "imagens-dispositivos": JPG, PNG ou WebP até 10 MB, em
--   {dispositivo_id}/{timestamp}-{aleatorio}.{ext} (mesmo padrão da 019).
--   O navegador envia (já comprimido) e depois chama a função.
-- - Escrita só por funções security definer (search_path vazio):
--     adicionar_imagens_dispositivo  grava uma ou mais imagens já no bucket
--     remover_imagem_dispositivo     marca como removida
-- - Auditoria (012): a tabela entra no log (inserção e remoção).
--
-- Tudo em uma transação: se algo falhar, nada é aplicado.
-- (Enum NOVO pode ser usado na mesma transação.)
begin;

-- ---------------------------------------------------------
-- 1. Momento (rótulos em português ficam na aplicação)
-- ---------------------------------------------------------
create type public.momento_imagem as enum (
  'cadastro',       -- Cadastro (ou edição) do dispositivo
  'entrega',        -- Entrega ao usuário (vínculo novo)
  'transferencia',  -- Transferência (vínculo novo que encerrou outro)
  'devolucao',      -- Devolução (vínculo encerrado)
  'outro'           -- Outro
);

-- ---------------------------------------------------------
-- 2. Tabela
-- ---------------------------------------------------------
create table public.dispositivo_imagens (
  id             uuid primary key default gen_random_uuid(),
  dispositivo_id uuid not null references public.dispositivos(id),
  vinculo_id     uuid references public.vinculos(id),
  momento        public.momento_imagem not null default 'cadastro',
  legenda        text
    constraint dispositivo_imagens_legenda_valida
      check (legenda = btrim(legenda) and char_length(legenda) between 1 and 200),
  -- {dispositivo_id}/{timestamp}-{aleatorio}.{ext} no bucket "imagens-dispositivos"
  -- (a pasta do próprio dispositivo é conferida em adicionar_imagens_dispositivo).
  path           text not null
    constraint dispositivo_imagens_path_unico unique
    constraint dispositivo_imagens_path_valido
      check (path ~ '^[0-9a-f-]{36}/[0-9]+-[a-z0-9]{8}\.(jpg|png|webp)$'),
  criado_por     uuid references auth.users(id) default auth.uid(),
  created_at     timestamptz not null default now(),
  removida       boolean not null default false,
  removida_por   uuid references auth.users(id),
  removida_em    timestamptz,
  -- Entrega, transferência e devolução sempre ligadas ao vínculo;
  -- cadastro nunca (é do item, não de um uso). "Outro": tanto faz.
  constraint dispositivo_imagens_vinculo_por_momento
    check (case momento
             when 'cadastro' then vinculo_id is null
             when 'outro'    then true
             else vinculo_id is not null
           end),
  constraint dispositivo_imagens_remocao_coerente
    check (removida = (removida_em is not null))
);

comment on table public.dispositivo_imagens is
  'Imagens do estado do item. Escrita só por adicionar_imagens_dispositivo e remover_imagem_dispositivo; remover = marcar removida.';

create index idx_dispositivo_imagens_dispositivo
  on public.dispositivo_imagens (dispositivo_id, created_at);
create index idx_dispositivo_imagens_vinculo
  on public.dispositivo_imagens (vinculo_id) where vinculo_id is not null;

-- ---------------------------------------------------------
-- 3. RLS: só leitura para authenticated; sem escrita direta
-- ---------------------------------------------------------
alter table public.dispositivo_imagens enable row level security;

create policy ti_select on public.dispositivo_imagens for select to authenticated using (true);

revoke all on public.dispositivo_imagens from anon;
revoke insert, update, delete, truncate on public.dispositivo_imagens from authenticated;

-- ---------------------------------------------------------
-- 4. Auditoria: inserção e remoção entram no log
-- ---------------------------------------------------------
alter table public.auditoria drop constraint auditoria_tabela_valida;
alter table public.auditoria add constraint auditoria_tabela_valida
  check (tabela in ('lojas', 'colaboradores', 'dispositivos', 'vinculos', 'servicos',
                    'servicos_financeiros', 'lancamentos',
                    'kanban_colunas', 'kanban_categorias', 'kanban_atividades',
                    'dispositivo_imagens'));

create trigger trg_auditoria after insert or update on public.dispositivo_imagens
  for each row execute function public.registrar_auditoria();

-- ---------------------------------------------------------
-- 5. adicionar_imagens_dispositivo
--    p_imagens: [{"path": "<dispositivo_id>/<ts>-<aleatorio>.jpg", "legenda": "Tela trincada"}, ...]
--    Até 20 por chamada. Devolve os ids na ordem recebida.
-- ---------------------------------------------------------
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

  if not exists (select 1 from public.dispositivos where id = p_dispositivo_id) then
    raise exception 'Dispositivo não encontrado';
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

revoke execute on function public.adicionar_imagens_dispositivo(uuid, public.momento_imagem, jsonb, uuid)
  from public, anon;
grant  execute on function public.adicionar_imagens_dispositivo(uuid, public.momento_imagem, jsonb, uuid)
  to authenticated;

-- ---------------------------------------------------------
-- 6. remover_imagem_dispositivo (enviada por engano)
--    O arquivo continua no bucket; a imagem some das galerias e a remoção
--    fica no log (trigger da 012).
-- ---------------------------------------------------------
create or replace function public.remover_imagem_dispositivo(p_imagem_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid      uuid := auth.uid();
  v_removida boolean;
begin
  if v_uid is null then
    raise exception 'Não autenticado' using errcode = '42501';
  end if;

  select removida into v_removida
    from public.dispositivo_imagens
   where id = p_imagem_id
     for update;
  if not found then raise exception 'Imagem não encontrada'; end if;
  if v_removida then raise exception 'Esta imagem já foi removida'; end if;

  update public.dispositivo_imagens
     set removida = true,
         removida_por = v_uid,
         removida_em = now()
   where id = p_imagem_id;
end $$;

revoke execute on function public.remover_imagem_dispositivo(uuid) from public, anon;
grant  execute on function public.remover_imagem_dispositivo(uuid) to authenticated;

-- ---------------------------------------------------------
-- 7. Storage: bucket privado "imagens-dispositivos" (JPG, PNG ou WebP, 10 MB)
--    Só na pasta de um dispositivo existente. Sem update/delete.
-- ---------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('imagens-dispositivos', 'imagens-dispositivos', false, 10485760,
        array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

create policy imagens_dispositivos_select on storage.objects for select to authenticated
  using (bucket_id = 'imagens-dispositivos');

create policy imagens_dispositivos_insert on storage.objects for insert to authenticated
  with check (
    bucket_id = 'imagens-dispositivos'
    and name ~ '^[0-9a-f-]{36}/[0-9]+-[a-z0-9]{8}\.(jpg|png|webp)$'
    and exists (
      select 1 from public.dispositivos d
       where d.id::text = (storage.foldername(name))[1]
    )
  );

notify pgrst, 'reload schema';

commit;

-- ---------------------------------------------------------
-- Conferências (opcionais, rode depois)
-- ---------------------------------------------------------
-- 1) Funções security definer com search_path vazio
-- select p.oid::regprocedure, p.prosecdef, p.proconfig
--   from pg_proc p
--  where p.pronamespace = 'public'::regnamespace
--    and p.proname in ('adicionar_imagens_dispositivo', 'remover_imagem_dispositivo');
--
-- 2) Sem escrita direta (esperado: nenhuma linha)
-- select grantee, privilege_type from information_schema.role_table_grants
--  where table_schema = 'public' and table_name = 'dispositivo_imagens'
--    and grantee in ('anon', 'authenticated')
--    and privilege_type in ('INSERT', 'UPDATE', 'DELETE', 'TRUNCATE');
--
-- 3) Trigger de auditoria (esperado: 1 linha)
-- select trigger_name from information_schema.triggers
--  where event_object_table = 'dispositivo_imagens' and trigger_name = 'trg_auditoria'
--  group by 1;
--
-- 4) Bucket
-- select id, public, file_size_limit, allowed_mime_types
--   from storage.buckets where id = 'imagens-dispositivos';
