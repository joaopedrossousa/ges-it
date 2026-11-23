-- =========================================================
-- GesIT — 029 Resumo do Telegram: jobs do pg_cron recriados, registro de
-- cada execução e "Enviado Financeiro" de volta em Hoje e Próximos 5 dias
-- =========================================================
-- Problema: de 19/11 a 23/11 os jobs 'avisos-financeiros-diarios' (11:00
-- UTC) e 'avisos-financeiros-tarde' (17:00 UTC) terminaram "succeeded" /
-- "1 row", mas não houve nenhuma linha 'resumo_financeiro' no
-- avisos_telegram_log nem mensagem no Telegram. Rodando
-- select public.avisos_financeiros_diarios(); no SQL Editor, a mensagem
-- chega. O "1 row" do pg_cron só diz que o SELECT devolveu uma linha
-- (qualquer valor, inclusive 0), e os NOTICE da função não aparecem no
-- cron.job_run_details: a execução agendada não deixava rastro.
--
-- O que a 029 faz:
-- 1. avisos_execucoes: uma linha por execução do resumo (agendada ou
--    manual), com o resultado (enviado, envio_parcial, falha_envio,
--    nada_a_avisar, ja_enviado), o turno, a data de Palmas, o usuário da
--    sessão (session_user = username do job), o application_name
--    ('pg_cron' nos jobs) e as contagens por grupo em detalhe. É isso que
--    mostra se o disparo das 08:00/14:00 rodou e por que não enviou.
--    Somente leitura para o app (sem grants para anon/authenticated).
-- 2. enviar_telegram (023), mesma assinatura: um erro inesperado (ex.:
--    leitura do Vault ou o insert do log) era engolido pelo último
--    "exception when others" SEM deixar linha no log. Agora grava a linha
--    com erro = 'Falha inesperada: ...' (token mascarado) e continua sem
--    propagar o erro.
-- 3. avisos_financeiros_diarios (026), mesma assinatura (sem parâmetros):
--    - Regra nova: "Vencem hoje" e "Vencem nos próximos 5 dias" INCLUEM os
--      lançamentos "Enviado Financeiro" (como lembrete, marcados na linha
--      com "· Enviado Financeiro"). Só "Vencidas" continua sem eles.
--      Contagens e totais consideram o que entra em cada grupo.
--    - Grava a execução em avisos_execucoes em todos os caminhos.
--    - Resto igual à 026: dois turnos (antes das 12:00 de Palmas = manhã),
--      um envio por turno, divisão acima de ~3.500 caracteres, nada
--      enviado sem pendência, security definer, search_path vazio.
--    - Dono explícito postgres (a vw_lancamentos é security_invoker: dentro
--      da função vale o RLS do dono, que precisa enxergar os lançamentos).
-- 4. pg_cron: remove os dois jobs pelo nome E qualquer outro job cujo
--    command chame avisos_financeiros_diarios (cópias antigas, de outro
--    banco/usuário ou com outro command) e recria os dois, com o command
--    qualificado, no banco atual e com o usuário de quem roda a migration
--    (postgres no SQL Editor).
--
-- Tudo em uma transação: se algo falhar, nada é aplicado.
begin;

-- ---------------------------------------------------------
-- 1. Registro das execuções
-- ---------------------------------------------------------
create table public.avisos_execucoes (
  id              bigint generated always as identity primary key,
  rotina          text not null
    constraint avisos_execucoes_rotina_valida check (char_length(rotina) between 1 and 50),
  executado_em    timestamptz not null default now(),
  -- Turno e data de Palmas usados na execução.
  turno           text,
  data_referencia date,
  resultado       text not null
    constraint avisos_execucoes_resultado_valido check (resultado in (
      'enviado', 'envio_parcial', 'falha_envio', 'nada_a_avisar', 'ja_enviado')),
  -- Mensagens entregues ao pg_net (request_id não nulo).
  enviadas        integer not null default 0,
  -- session_user: quem chamou (username do job no pg_cron).
  usuario_sessao  text not null,
  -- current_user dentro da função (security definer = dono da função).
  usuario_efetivo text not null,
  -- application_name da sessão ('pg_cron' nos jobs).
  aplicacao       text,
  detalhe         jsonb not null default '{}'::jsonb
);

comment on table public.avisos_execucoes is
  'Cada execução de avisos_financeiros_diarios (pg_cron ou manual): resultado, turno, quem chamou e contagens. Diagnóstico dos jobs do Telegram.';

create index idx_avisos_execucoes_executado on public.avisos_execucoes (executado_em desc);

alter table public.avisos_execucoes enable row level security;
revoke all on public.avisos_execucoes from public, anon, authenticated;

-- ---------------------------------------------------------
-- 2. enviar_telegram: falha inesperada também vai para o log
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
  -- Última barreira: o erro nunca sobe para quem chamou, mas fica no log
  -- (antes, esta saída não deixava rastro). O pedido ao pg_net desta
  -- chamada, se houve, foi desfeito junto: request_id fica nulo.
  begin
    insert into public.avisos_telegram_log (tipo, referencia, mensagem, request_id, erro)
    values (coalesce(nullif(btrim(p_tipo), ''), 'desconhecido'), p_referencia,
            coalesce(p_texto, ''), null,
            'Falha inesperada: '
              || case when coalesce(btrim(v_token), '') <> ''
                      then replace(sqlerrm, btrim(v_token), '***')
                      else sqlerrm end);
  exception when others then
    null;
  end;
  return null;
end $$;

revoke execute on function public.enviar_telegram(text, text, text) from public, anon, authenticated;

-- ---------------------------------------------------------
-- 3. Resumo das contas
-- ---------------------------------------------------------
create or replace function public.avisos_financeiros_diarios()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
-- Resumo das contas no Telegram (tipo 'resumo_financeiro' no log), em dois
-- turnos: manhã (antes das 12:00 de Palmas) e tarde (a partir das 12:00).
-- Grupos, nesta ordem, pela situacao_vencimento da vw_lancamentos ("hoje"
-- de Palmas, calculado na view), só pendentes (nem pagas nem canceladas):
--   Vencidas         'vencido'  (há X dias; total)  SEM "Enviado Financeiro"
--   Vencem hoje      'hoje'     (total)             COM "Enviado Financeiro"
--   Próximos 5 dias  'proximo'  (em X dias; total)  COM "Enviado Financeiro"
-- (regra da 029; as "Enviado Financeiro" saem marcadas na linha). Nada em
-- nenhum grupo = não envia. Acima de ~3.500 caracteres, divide em várias
-- mensagens, em ordem.
-- Um envio por turno: se já houver no log um 'resumo_financeiro' de hoje,
-- do mesmo turno, com request_id, não envia de novo. Referencia:
-- 'AAAA-MM-DD manha|tarde n/N' (antigas, sem turno, contam como manhã).
-- Toda execução vai para avisos_execucoes (resultado, turno, quem chamou).
-- Devolve quantas mensagens foram entregues ao pg_net.
declare
  c_limite constant integer := 3500;
  v_agora   timestamp := now() at time zone 'America/Araguaina';
  v_hoje    date := (now() at time zone 'America/Araguaina')::date;
  v_turno   text;
  v_rotulo  text;
  v_linhas  text[] := '{}';
  v_partes  text[] := '{}';
  v_atual   text := '';
  v_linha   text;
  v_grupo   record;
  v_item    record;
  v_qtd     integer;
  v_total   numeric;
  v_algum   boolean := false;
  v_enviadas integer := 0;
  v_req     bigint;
  v_reqs    bigint[] := '{}';
  v_resultado text;
  v_detalhe jsonb := '{}'::jsonb;
  i         integer;
begin
  v_turno := case when extract(hour from v_agora) < 12 then 'manha' else 'tarde' end;
  v_rotulo := case when v_turno = 'manha' then 'manhã' else 'tarde' end;

  -- Quantos lançamentos a função enxerga (0 aqui = RLS/dono errado).
  v_detalhe := v_detalhe || jsonb_build_object(
    'hora_palmas', to_char(v_agora, 'YYYY-MM-DD HH24:MI:SS'),
    'lancamentos_visiveis', (select count(*) from public.vw_lancamentos)
  );

  -- Idempotência por turno: já entregue hoje (data de Palmas) neste turno?
  if exists (
    select 1 from public.avisos_telegram_log
     where tipo = 'resumo_financeiro'
       and request_id is not null
       and (criado_em at time zone 'America/Araguaina')::date = v_hoje
       and public.turno_resumo_financeiro(referencia) = v_turno
  ) then
    v_resultado := 'ja_enviado';
  else
    v_linhas := v_linhas
      || ('📋 GesIT — Resumo das contas de ' || to_char(v_hoje, 'DD/MM/YYYY') || ' (' || v_rotulo || ')');

    for v_grupo in
      select *
        from (values
          (1, 'vencido', '🔴 Vencidas'),
          (2, 'hoje',    '🟠 Vencem hoje'),
          (3, 'proximo', '🟡 Vencem nos próximos 5 dias')
        ) as g(ordem, situacao, titulo)
       order by ordem
    loop
      -- "Enviado Financeiro" fica fora só das Vencidas.
      select count(*), coalesce(sum(valor), 0)
        into v_qtd, v_total
        from public.vw_lancamentos l
       where l.situacao_vencimento = v_grupo.situacao
         and (v_grupo.situacao <> 'vencido' or l.situacao <> 'enviado_financeiro');

      v_detalhe := v_detalhe || jsonb_build_object(v_grupo.situacao, v_qtd);

      v_linhas := v_linhas || ''::text;
      if v_qtd = 0 then
        v_linhas := v_linhas || (v_grupo.titulo || ': nenhuma.');
        continue;
      end if;
      v_algum := true;
      v_linhas := v_linhas
        || (v_grupo.titulo || ' (' || v_qtd || ') — total ' || public.formatar_reais(v_total));

      for v_item in
        select l.fornecedor, l.descricao, l.loja_nome, l.valor, l.vencimento,
               l.dias_para_vencer, l.situacao
          from public.vw_lancamentos l
         where l.situacao_vencimento = v_grupo.situacao
           and (v_grupo.situacao <> 'vencido' or l.situacao <> 'enviado_financeiro')
         order by l.vencimento, l.fornecedor, l.id
      loop
        v_linha := '• ' || coalesce(v_item.fornecedor, '—')
          || coalesce(' — ' || nullif(btrim(v_item.descricao), ''), '')
          || ' · ' || coalesce(v_item.loja_nome, 'Geral')
          || ' · ' || public.formatar_reais(v_item.valor)
          || ' · venc. ' || to_char(v_item.vencimento, 'DD/MM/YYYY')
          || case
               when v_grupo.situacao = 'vencido' then
                 ' · há ' || abs(v_item.dias_para_vencer)
                 || case when abs(v_item.dias_para_vencer) = 1 then ' dia' else ' dias' end
               when v_grupo.situacao = 'proximo' then
                 ' · em ' || v_item.dias_para_vencer
                 || case when v_item.dias_para_vencer = 1 then ' dia' else ' dias' end
               else ''
             end
          || case when v_item.situacao = 'enviado_financeiro' then ' · Enviado Financeiro' else '' end;
        v_linhas := v_linhas || v_linha;
      end loop;
    end loop;

    if not v_algum then
      v_resultado := 'nada_a_avisar';
    else
      -- Divide em partes de até ~3.500 caracteres, sem quebrar linhas.
      foreach v_linha in array v_linhas loop
        if v_atual <> '' and char_length(v_atual) + 1 + char_length(v_linha) > c_limite then
          v_partes := v_partes || v_atual;
          v_atual := '(continuação)';
        end if;
        v_atual := case when v_atual = '' then v_linha else v_atual || E'\n' || v_linha end;
      end loop;
      v_partes := v_partes || v_atual;

      for i in 1 .. cardinality(v_partes) loop
        v_req := public.enviar_telegram(
          'resumo_financeiro',
          to_char(v_hoje, 'YYYY-MM-DD') || ' ' || v_turno || ' ' || i || '/' || cardinality(v_partes),
          v_partes[i]
        );
        v_reqs := v_reqs || v_req;
        if v_req is not null then
          v_enviadas := v_enviadas + 1;
        end if;
      end loop;

      v_resultado := case
        when v_enviadas = cardinality(v_partes) then 'enviado'
        when v_enviadas = 0 then 'falha_envio'
        else 'envio_parcial'
      end;
      v_detalhe := v_detalhe || jsonb_build_object(
        'partes', cardinality(v_partes),
        'request_ids', to_jsonb(v_reqs)
      );
    end if;
  end if;

  -- O registro nunca derruba o envio.
  begin
    insert into public.avisos_execucoes
      (rotina, turno, data_referencia, resultado, enviadas,
       usuario_sessao, usuario_efetivo, aplicacao, detalhe)
    values
      ('resumo_financeiro', v_turno, v_hoje, v_resultado, v_enviadas,
       session_user::text, current_user::text,
       nullif(current_setting('application_name', true), ''), v_detalhe);
  exception when others then
    raise warning 'Falha ao registrar a execução do resumo financeiro: %', sqlerrm;
  end;

  raise notice 'Resumo financeiro de % (%): % — % mensagem(ns) entregue(s) ao pg_net.',
    to_char(v_hoje, 'DD/MM/YYYY'), v_rotulo, v_resultado, v_enviadas;
  return v_enviadas;
end $$;

comment on function public.avisos_financeiros_diarios() is
  'Resumo das contas no Telegram em dois turnos (jobs avisos-financeiros-diarios às 08:00 e avisos-financeiros-tarde às 14:00 de Palmas): vencidas (sem "Enviado Financeiro"), vencem hoje e próximos 5 dias (com "Enviado Financeiro"). Um envio por turno; cada execução vai para avisos_execucoes.';

alter function public.avisos_financeiros_diarios() owner to postgres;
alter function public.enviar_telegram(text, text, text) owner to postgres;

revoke execute on function public.avisos_financeiros_diarios() from public, anon, authenticated;

-- ---------------------------------------------------------
-- 4. pg_cron: remove os jobs do resumo (pelo nome ou pelo command) e
--    recria os dois turnos
-- ---------------------------------------------------------
select cron.unschedule(jobid)
  from cron.job
 where jobname in ('avisos-financeiros-diarios', 'avisos-financeiros-tarde')
    or command ilike '%avisos_financeiros_diarios%';

select cron.schedule(
  'avisos-financeiros-diarios',
  '0 11 * * *', -- 08:00 em Palmas (UTC−3)
  $cron$select public.avisos_financeiros_diarios();$cron$
);

select cron.schedule(
  'avisos-financeiros-tarde',
  '0 17 * * *', -- 14:00 em Palmas (UTC−3)
  $cron$select public.avisos_financeiros_diarios();$cron$
);

commit;

-- ---------------------------------------------------------
-- Conferências (rode depois, no SQL Editor)
-- ---------------------------------------------------------
-- 1) Jobs (esperado: 2 linhas, "0 11 * * *" e "0 17 * * *", command
--    "select public.avisos_financeiros_diarios();", database postgres,
--    username postgres, active = true)
-- select jobid, jobname, schedule, command, database, username, active
--   from cron.job
--  where command ilike '%avisos_financeiros_diarios%'
--     or jobname in ('avisos-financeiros-diarios', 'avisos-financeiros-tarde')
--  order by jobname;
--
-- 2) Execuções do resumo (aplicacao 'pg_cron' = disparo agendado)
-- select id, executado_em at time zone 'America/Araguaina' as em_palmas,
--        turno, resultado, enviadas, usuario_sessao, usuario_efetivo,
--        aplicacao, detalhe
--   from public.avisos_execucoes
--  order by id desc
--  limit 20;
--
-- 3) Log de hoje com a resposta do Telegram (status 200 = entregue)
-- select l.id, l.referencia, l.criado_em at time zone 'America/Araguaina' as em_palmas,
--        l.request_id, l.erro, r.status_code, r.error_msg
--   from public.avisos_telegram_log l
--   left join net._http_response r on r.id = l.request_id
--  where l.tipo = 'resumo_financeiro'
--    and (l.criado_em at time zone 'America/Araguaina')::date
--        = (now() at time zone 'America/Araguaina')::date
--  order by l.id desc;
--
-- 4) Execuções no pg_cron
-- select j.jobname, d.start_time at time zone 'America/Araguaina' as em_palmas,
--        d.status, d.return_message, d.username, d.database, d.command
--   from cron.job_run_details d
--   join cron.job j on j.jobid = d.jobid
--  where j.jobname in ('avisos-financeiros-diarios', 'avisos-financeiros-tarde')
--  order by d.start_time desc
--  limit 10;
