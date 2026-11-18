-- =========================================================
-- GesIT — 024 Avisos no Telegram (T2): resumo diário das contas
-- =========================================================
-- - avisos_financeiros_diarios(): monta UM resumo com três grupos, nesta
--   ordem, a partir da vw_lancamentos (mesma regra do módulo financeiro e
--   da tela Início; "hoje" sempre em America/Araguaina, calculado na view):
--     Vencidas            situacao_vencimento = 'vencido'  (há X dias, total)
--     Vencem hoje         situacao_vencimento = 'hoje'     (total)
--     Próximos 5 dias     situacao_vencimento = 'proximo'  (1 a 5 dias: em X dias, total)
--   Pendente = não pago e não cancelado (a view já separa pago/cancelado;
--   "enviado ao financeiro" e as demais situações entram).
--   Cada linha: Prestador de Serviço (fornecedor), descrição (se houver),
--   filial, valor em R$ e vencimento. Sem ID de aprovação nem observação.
--   Nada em nenhum grupo = não envia. Acima de ~3.500 caracteres, divide em
--   várias mensagens, em ordem (limite do Telegram: 4.096).
-- - Envio por public.enviar_telegram (023): tipo 'resumo_financeiro',
--   referencia 'AAAA-MM-DD n/N'.
-- - Idempotência: se já houver no log um 'resumo_financeiro' de hoje
--   (data de Palmas) com request_id (ou seja, entregue ao pg_net), não envia
--   de novo. Tentativa que falhou antes do envio (ex.: segredo ausente) não
--   conta: rodar de novo tenta outra vez.
-- - pg_cron: job 'avisos-financeiros-diarios' todo dia às 08:00 de Palmas
--   (11:00 UTC; Palmas é UTC−3 o ano todo). Recriado se já existir.
--
-- Tudo em uma transação: se algo falhar, nada é aplicado.
begin;

-- ---------------------------------------------------------
-- 1. Formatação (uso interno)
-- ---------------------------------------------------------
-- 1234.5 → "R$ 1.234,50" (independe do locale do servidor).
create or replace function public.formatar_reais(p_valor numeric)
returns text
language sql
immutable
set search_path = ''
as $$
  select 'R$ ' || translate(to_char(coalesce(p_valor, 0), 'FM999,999,999,990.00'), ',.', '.,');
$$;

revoke execute on function public.formatar_reais(numeric) from public, anon, authenticated;

-- ---------------------------------------------------------
-- 2. Resumo diário
--    Devolve quantas mensagens foram entregues ao pg_net (0 = nada a
--    avisar ou já enviado hoje). O motivo sai em NOTICE no SQL Editor.
-- ---------------------------------------------------------
create or replace function public.avisos_financeiros_diarios()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  c_limite constant integer := 3500;
  v_hoje    date := (now() at time zone 'America/Araguaina')::date;
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
  i         integer;
begin
  -- Idempotência: já entregue hoje (data de Palmas)?
  if exists (
    select 1 from public.avisos_telegram_log
     where tipo = 'resumo_financeiro'
       and request_id is not null
       and (criado_em at time zone 'America/Araguaina')::date = v_hoje
  ) then
    raise notice 'Resumo financeiro de % já enviado; nada a fazer.', to_char(v_hoje, 'DD/MM/YYYY');
    return 0;
  end if;

  v_linhas := v_linhas || ('📋 GesIT — Resumo das contas de ' || to_char(v_hoje, 'DD/MM/YYYY'));

  for v_grupo in
    select *
      from (values
        (1, 'vencido', '🔴 Vencidas'),
        (2, 'hoje',    '🟠 Vencem hoje'),
        (3, 'proximo', '🟡 Vencem nos próximos 5 dias')
      ) as g(ordem, situacao, titulo)
     order by ordem
  loop
    select count(*), coalesce(sum(valor), 0)
      into v_qtd, v_total
      from public.vw_lancamentos
     where situacao_vencimento = v_grupo.situacao;

    v_linhas := v_linhas || ''::text;
    if v_qtd = 0 then
      v_linhas := v_linhas || (v_grupo.titulo || ': nenhuma.');
      continue;
    end if;
    v_algum := true;
    v_linhas := v_linhas
      || (v_grupo.titulo || ' (' || v_qtd || ') — total ' || public.formatar_reais(v_total));

    for v_item in
      select fornecedor, descricao, loja_nome, valor, vencimento, dias_para_vencer
        from public.vw_lancamentos
       where situacao_vencimento = v_grupo.situacao
       order by vencimento, fornecedor, id
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
           end;
      v_linhas := v_linhas || v_linha;
    end loop;
  end loop;

  if not v_algum then
    raise notice 'Nenhuma conta vencida, vencendo hoje ou nos próximos 5 dias; nada enviado.';
    return 0;
  end if;

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
      to_char(v_hoje, 'YYYY-MM-DD') || ' ' || i || '/' || cardinality(v_partes),
      v_partes[i]
    );
    if v_req is not null then
      v_enviadas := v_enviadas + 1;
    end if;
  end loop;

  raise notice 'Resumo financeiro: % de % mensagem(ns) entregue(s) ao pg_net.',
    v_enviadas, cardinality(v_partes);
  return v_enviadas;
end $$;

revoke execute on function public.avisos_financeiros_diarios() from public, anon, authenticated;

-- ---------------------------------------------------------
-- 3. Agendamento: todo dia às 08:00 de Palmas (11:00 UTC)
--    Remove o job de mesmo nome antes de criar (migration idempotente).
-- ---------------------------------------------------------
select cron.unschedule(jobid)
  from cron.job
 where jobname = 'avisos-financeiros-diarios';

select cron.schedule(
  'avisos-financeiros-diarios',
  '0 11 * * *',
  $cron$select public.avisos_financeiros_diarios();$cron$
);

commit;

-- ---------------------------------------------------------
-- Conferências (rode depois, no SQL Editor)
-- ---------------------------------------------------------
-- 1) Job agendado (esperado: 1 linha, schedule "0 11 * * *", active = true)
-- select jobid, jobname, schedule, command, active from cron.job
--  where jobname = 'avisos-financeiros-diarios';
--
-- 2) Teste manual (devolve quantas mensagens foram enviadas; o motivo de um
--    0 aparece nas mensagens/NOTICE do SQL Editor)
-- select public.avisos_financeiros_diarios();
--
-- 3) Log e resposta do Telegram
-- select l.id, l.referencia, l.criado_em, l.request_id, l.erro,
--        r.status_code, r.error_msg
--   from public.avisos_telegram_log l
--   left join net._http_response r on r.id = l.request_id
--  where l.tipo = 'resumo_financeiro'
--  order by l.id desc
--  limit 10;
--
-- 4) Execuções do agendamento
-- select d.start_time, d.end_time, d.status, d.return_message
--   from cron.job_run_details d
--   join cron.job j on j.jobid = d.jobid
--  where j.jobname = 'avisos-financeiros-diarios'
--  order by d.start_time desc
--  limit 10;
--
-- 5) Pausar / retomar
-- select cron.unschedule('avisos-financeiros-diarios');               -- pausa (remove o job)
-- select cron.schedule('avisos-financeiros-diarios', '0 11 * * *',
--                      $$select public.avisos_financeiros_diarios();$$); -- retoma
