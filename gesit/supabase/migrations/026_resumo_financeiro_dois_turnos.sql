-- =========================================================
-- GesIT — 026 Resumo do Telegram em dois turnos (08:00 e 14:00 de Palmas)
-- =========================================================
-- public.avisos_financeiros_diarios() continua sem parâmetros (mesma
-- assinatura, sem sobrecarga) e passa a deduzir o turno pelo horário de
-- America/Araguaina: antes das 12:00 = manhã; a partir das 12:00 = tarde.
--
-- - Um envio por turno: não envia de novo se já houver no log um
--   'resumo_financeiro' entregue ao pg_net (request_id) com a data de hoje
--   (Palmas) e o mesmo turno. Manhã e tarde são independentes.
-- - O turno vai na referencia do log: 'AAAA-MM-DD manha n/N' ou
--   'AAAA-MM-DD tarde n/N'. Linhas antigas (024/025: 'AAAA-MM-DD n/N', sem
--   turno) contam como manhã.
-- - Título: "📋 GesIT — Resumo das contas de DD/MM/AAAA (manhã)" ou "(tarde)".
-- - Resto igual à 025: sem "Enviado ao Financeiro", três grupos, divisão
--   acima de ~3.500 caracteres, nada enviado sem pendência, security
--   definer, search_path vazio, execute revogado.
-- - pg_cron: 'avisos-financeiros-diarios' às 11:00 UTC (08:00 de Palmas) e
--   'avisos-financeiros-tarde' às 17:00 UTC (14:00 de Palmas), as duas
--   chamando a mesma função. Recriadas se já existirem.
--
-- Tudo em uma transação: se algo falhar, nada é aplicado.
begin;

-- Turno de uma referencia do log: 'tarde' só quando gravada assim; o resto
-- (inclusive as antigas, sem turno) é 'manha'. Uso interno.
create or replace function public.turno_resumo_financeiro(p_referencia text)
returns text
language sql
immutable
set search_path = ''
as $$
  select case when split_part(coalesce(p_referencia, ''), ' ', 2) = 'tarde' then 'tarde' else 'manha' end;
$$;

revoke execute on function public.turno_resumo_financeiro(text) from public, anon, authenticated;

create or replace function public.avisos_financeiros_diarios()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
-- Resumo das contas no Telegram (tipo 'resumo_financeiro' no log), em dois
-- turnos: manhã (antes das 12:00 de Palmas) e tarde (a partir das 12:00).
-- Grupos, nesta ordem, pela situacao_vencimento da vw_lancamentos ("hoje"
-- de Palmas, calculado na view):
--   Vencidas         'vencido'  (há X dias; total)
--   Vencem hoje      'hoje'     (total)
--   Próximos 5 dias  'proximo'  (em X dias; total)
-- Entram as pendentes (nem pagas nem canceladas), EXCETO as "Enviado ao
-- Financeiro" (025). Nada em nenhum grupo = não envia. Acima de ~3.500
-- caracteres, divide em várias mensagens, em ordem.
-- Um envio por turno: se já houver no log um 'resumo_financeiro' de hoje,
-- do mesmo turno, com request_id, não envia de novo. Referencia:
-- 'AAAA-MM-DD manha|tarde n/N' (antigas, sem turno, contam como manhã).
-- Devolve quantas mensagens foram entregues ao pg_net (0 = nada a avisar
-- ou já enviado neste turno; o motivo sai em NOTICE).
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
  i         integer;
begin
  v_turno := case when extract(hour from v_agora) < 12 then 'manha' else 'tarde' end;
  v_rotulo := case when v_turno = 'manha' then 'manhã' else 'tarde' end;

  -- Idempotência por turno: já entregue hoje (data de Palmas) neste turno?
  if exists (
    select 1 from public.avisos_telegram_log
     where tipo = 'resumo_financeiro'
       and request_id is not null
       and (criado_em at time zone 'America/Araguaina')::date = v_hoje
       and public.turno_resumo_financeiro(referencia) = v_turno
  ) then
    raise notice 'Resumo financeiro de % (%) já enviado; nada a fazer.',
      to_char(v_hoje, 'DD/MM/YYYY'), v_rotulo;
    return 0;
  end if;

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
    -- Contagem e total só do que entra no resumo (sem "Enviado ao Financeiro").
    select count(*), coalesce(sum(valor), 0)
      into v_qtd, v_total
      from public.vw_lancamentos
     where situacao_vencimento = v_grupo.situacao
       and situacao <> 'enviado_financeiro';

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
         and situacao <> 'enviado_financeiro'
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
    raise notice 'Nenhuma conta vencida, vencendo hoje ou nos próximos 5 dias (fora as enviadas ao Financeiro); nada enviado (%).', v_rotulo;
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
      to_char(v_hoje, 'YYYY-MM-DD') || ' ' || v_turno || ' ' || i || '/' || cardinality(v_partes),
      v_partes[i]
    );
    if v_req is not null then
      v_enviadas := v_enviadas + 1;
    end if;
  end loop;

  raise notice 'Resumo financeiro (%): % de % mensagem(ns) entregue(s) ao pg_net.',
    v_rotulo, v_enviadas, cardinality(v_partes);
  return v_enviadas;
end $$;

comment on function public.avisos_financeiros_diarios() is
  'Resumo das contas no Telegram em dois turnos (jobs avisos-financeiros-diarios às 08:00 e avisos-financeiros-tarde às 14:00 de Palmas): vencidas, vencem hoje e próximos 5 dias, sem as "Enviado ao Financeiro". Um envio por turno.';

-- Mesma assinatura: o revoke da 024 continua valendo; reafirmado.
revoke execute on function public.avisos_financeiros_diarios() from public, anon, authenticated;

-- ---------------------------------------------------------
-- pg_cron: os dois turnos (remove jobs de mesmo nome antes de criar)
-- ---------------------------------------------------------
select cron.unschedule(jobid)
  from cron.job
 where jobname in ('avisos-financeiros-diarios', 'avisos-financeiros-tarde');

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
-- 1) Jobs (esperado: 2 linhas, "0 11 * * *" e "0 17 * * *", active = true)
-- select jobid, jobname, schedule, command, active from cron.job
--  where jobname in ('avisos-financeiros-diarios', 'avisos-financeiros-tarde')
--  order by jobname;
--
-- 2) Execuções dos dois jobs
-- select j.jobname, d.start_time, d.end_time, d.status, d.return_message
--   from cron.job_run_details d
--   join cron.job j on j.jobid = d.jobid
--  where j.jobname in ('avisos-financeiros-diarios', 'avisos-financeiros-tarde')
--  order by d.start_time desc
--  limit 20;
--
-- 3) Log de hoje com o turno de cada envio
-- select l.id, l.referencia, public.turno_resumo_financeiro(l.referencia) as turno,
--        l.criado_em, l.request_id, l.erro, r.status_code
--   from public.avisos_telegram_log l
--   left join net._http_response r on r.id = l.request_id
--  where l.tipo = 'resumo_financeiro'
--    and (l.criado_em at time zone 'America/Araguaina')::date
--        = (now() at time zone 'America/Araguaina')::date
--  order by l.id desc;
--
-- 4) Repetir só um turno hoje: apague só as linhas desse turno (troque
--    'tarde' por 'manha' para o turno da manhã) e rode a função dentro do
--    horário do turno (antes ou depois das 12:00 de Palmas)
-- delete from public.avisos_telegram_log
--  where tipo = 'resumo_financeiro'
--    and (criado_em at time zone 'America/Araguaina')::date
--        = (now() at time zone 'America/Araguaina')::date
--    and public.turno_resumo_financeiro(referencia) = 'tarde';
-- select public.avisos_financeiros_diarios();
