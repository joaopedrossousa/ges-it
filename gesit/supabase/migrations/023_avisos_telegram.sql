-- =========================================================
-- GesIT — 023 Avisos no Telegram (T1): envio e aviso de atividade urgente
-- =========================================================
-- Tudo no Supabase, sem código no app:
-- - pg_net (HTTP assíncrono: o pedido só sai depois do COMMIT; se a
--   transação desfizer, nada é enviado) e pg_cron (para avisos agendados,
--   próximas entregas).
-- - avisos_telegram_log: cada tentativa de envio (request_id do pg_net ou
--   o erro). A resposta do Telegram fica em net._http_response (id =
--   request_id), guardada pelo pg_net por 6 horas.
-- - enviar_telegram(tipo, referencia, texto): lê o token e o chat id do
--   Vault (telegram_bot_token, telegram_chat_id), escapa o texto para o
--   HTML do Telegram e envia. NUNCA propaga erro: registra no log e devolve
--   null (marcar uma atividade como urgente não pode falhar por causa do
--   Telegram). O token não vai para o log nem para mensagens de erro.
-- - Trigger em kanban_atividades: urgente false → true manda o aviso.
--   Desmarcar não avisa.
-- - enviar_telegram_teste(): só para o SQL Editor.
--
-- Os segredos ficam só no Vault (criados pelo painel): nada de token ou
-- chat id neste arquivo.
--
-- Assinatura conferida na documentação do pg_net:
--   net.http_post(url text, body jsonb default '{}', params jsonb default '{}',
--                 headers jsonb default '{"Content-Type": "application/json"}',
--                 timeout_milliseconds int default 2000) returns bigint
--
-- Tudo em uma transação: se algo falhar, nada é aplicado.
begin;

-- ---------------------------------------------------------
-- 1. Extensões
--    pg_net no schema "extensions" (recomendação do Supabase; ele cria o
--    schema "net" sozinho). pg_cron define o próprio schema ("cron").
--    Se o Supabase recusar, ative as duas em Database > Extensions.
-- ---------------------------------------------------------
create extension if not exists pg_net with schema extensions;
create extension if not exists pg_cron;

-- ---------------------------------------------------------
-- 2. Log dos envios
-- ---------------------------------------------------------
create table public.avisos_telegram_log (
  id          bigint generated always as identity primary key,
  tipo        text not null
    constraint avisos_telegram_log_tipo_valido check (char_length(tipo) between 1 and 50),
  -- Ex.: id da atividade (texto: cada tipo de aviso aponta para uma tabela).
  referencia  text,
  mensagem    text not null,
  -- id do pedido no pg_net (= net._http_response.id); nulo se não enviou.
  request_id  bigint,
  criado_em   timestamptz not null default now(),
  erro        text
);

comment on table public.avisos_telegram_log is
  'Avisos enviados ao Telegram (enviar_telegram). Resposta em net._http_response (id = request_id, guardada por 6 h).';

create index idx_avisos_telegram_log_criado on public.avisos_telegram_log (criado_em desc);

alter table public.avisos_telegram_log enable row level security;

create policy ti_select on public.avisos_telegram_log for select to authenticated using (true);

revoke all on public.avisos_telegram_log from anon;
revoke insert, update, delete, truncate on public.avisos_telegram_log from authenticated;

-- ---------------------------------------------------------
-- 3. enviar_telegram
-- ---------------------------------------------------------
create or replace function public.enviar_telegram(
  p_tipo       text,
  p_referencia text,
  p_texto      text
) returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_token   text;
  v_chat    text;
  v_texto   text;
  v_req     bigint;
  v_erro    text;
begin
  -- Escapa para o parse_mode HTML do Telegram (& primeiro).
  v_texto := replace(replace(replace(coalesce(p_texto, ''), '&', '&amp;'), '<', '&lt;'), '>', '&gt;');

  select max(decrypted_secret) filter (where name = 'telegram_bot_token'),
         max(decrypted_secret) filter (where name = 'telegram_chat_id')
    into v_token, v_chat
    from vault.decrypted_secrets
   where name in ('telegram_bot_token', 'telegram_chat_id');

  if coalesce(btrim(v_token), '') = '' or coalesce(btrim(v_chat), '') = '' then
    v_erro := 'Segredo ausente no Vault: '
      || concat_ws(', ',
           case when coalesce(btrim(v_token), '') = '' then 'telegram_bot_token' end,
           case when coalesce(btrim(v_chat), '') = '' then 'telegram_chat_id' end);
  elsif v_texto = '' then
    v_erro := 'Mensagem vazia';
  else
    begin
      v_req := net.http_post(
        url := 'https://api.telegram.org/bot' || btrim(v_token) || '/sendMessage',
        body := jsonb_build_object(
          'chat_id', btrim(v_chat),
          'text', v_texto,
          'parse_mode', 'HTML',
          'disable_web_page_preview', true
        ),
        headers := '{"Content-Type": "application/json"}'::jsonb,
        timeout_milliseconds := 5000
      );
    exception when others then
      -- Nunca deixa o token aparecer no log.
      v_erro := replace(sqlerrm, btrim(v_token), '***');
    end;
  end if;

  insert into public.avisos_telegram_log (tipo, referencia, mensagem, request_id, erro)
  values (coalesce(nullif(btrim(p_tipo), ''), 'desconhecido'), p_referencia,
          coalesce(p_texto, ''), v_req, v_erro);

  return v_req;
exception when others then
  -- Última barreira: nem a falha do log pode subir para quem chamou.
  return null;
end $$;

revoke execute on function public.enviar_telegram(text, text, text) from public, anon, authenticated;

-- ---------------------------------------------------------
-- 4. Aviso de atividade urgente (urgente: false → true)
-- ---------------------------------------------------------
-- Nome para o aviso: o do cadastro (full_name/name); sem ele, só a parte
-- antes do @ do e-mail (sem o domínio). Uso interno.
create or replace function public.nome_curto_usuario(p_id uuid)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
           nullif(btrim(coalesce(u.raw_user_meta_data ->> 'full_name',
                                 u.raw_user_meta_data ->> 'name')), ''),
           split_part(u.email::text, '@', 1))
    from auth.users u
   where u.id = p_id;
$$;

revoke execute on function public.nome_curto_usuario(uuid) from public, anon, authenticated;

create or replace function public.avisar_atividade_urgente() returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_coluna     text;
  v_url        text;
  v_prioridade text;
  v_mensagem   text;
begin
  begin
    select nome into v_coluna from public.kanban_colunas where id = new.coluna_id;
    select nullif(rtrim(btrim(decrypted_secret), '/'), '') into v_url
      from vault.decrypted_secrets where name = 'app_url'
     limit 1;

    v_prioridade := case new.prioridade::text
      when 'alta'  then 'Alta'
      when 'media' then 'Média'
      when 'baixa' then 'Baixa'
      else new.prioridade::text
    end;

    v_mensagem := concat_ws(E'\n',
      '🚨 Atividade urgente',
      new.titulo,
      'Coluna: ' || coalesce(v_coluna, '—'),
      'Prioridade: ' || v_prioridade,
      'Responsável: ' || coalesce(public.nome_curto_usuario(new.responsavel_id), 'sem responsável'),
      'Marcada por: ' || coalesce(public.nome_curto_usuario(new.urgente_por), '—'),
      case when v_url is not null then v_url || '/atividades?atividade=' || new.id end
    );

    perform public.enviar_telegram('urgente', new.id::text, v_mensagem);
  exception when others then
    null; -- o aviso nunca impede marcar como urgente
  end;
  return null; -- trigger AFTER: o retorno é ignorado
end $$;

revoke execute on function public.avisar_atividade_urgente() from public, anon, authenticated;

create trigger trg_kanban_atividades_aviso_urgente
  after update of urgente on public.kanban_atividades
  for each row
  when (old.urgente is false and new.urgente is true)
  execute function public.avisar_atividade_urgente();

-- ---------------------------------------------------------
-- 5. Teste (só pelo SQL Editor: ninguém do app pode executar)
-- ---------------------------------------------------------
create or replace function public.enviar_telegram_teste()
returns bigint
language sql
security definer
set search_path = ''
as $$
  select public.enviar_telegram('teste', null, 'Teste do GesIT: avisos funcionando');
$$;

revoke execute on function public.enviar_telegram_teste() from public, anon, authenticated;

commit;

-- ---------------------------------------------------------
-- Conferências (rode depois, no SQL Editor)
-- ---------------------------------------------------------
-- 1) Extensões (esperado: pg_net e pg_cron)
-- select extname, extversion from pg_extension where extname in ('pg_net', 'pg_cron');
--
-- 2) Segredos presentes (só os nomes; NUNCA selecione decrypted_secret aqui)
-- select name from vault.secrets
--  where name in ('telegram_bot_token', 'telegram_chat_id', 'app_url');
--
-- 3) Teste de envio
-- select public.enviar_telegram_teste();
--
-- 4) Log (o mais recente primeiro) e a resposta do Telegram (aguarde alguns
--    segundos depois do envio; status 200 e "ok":true = entregue)
-- select l.id, l.tipo, l.referencia, l.criado_em, l.request_id, l.erro,
--        r.status_code, r.timed_out, r.error_msg, r.content
--   from public.avisos_telegram_log l
--   left join net._http_response r on r.id = l.request_id
--  order by l.id desc
--  limit 10;
