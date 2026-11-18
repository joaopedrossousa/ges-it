-- =========================================================
-- GesIT — 025 Resumo diário do Telegram sem "Enviado ao Financeiro"
-- =========================================================
-- Ajuste na regra de public.avisos_financeiros_diarios (024): lançamentos
-- com situacao = 'enviado_financeiro' NÃO entram no resumo, em nenhum dos
-- três grupos (Vencidas, Vencem hoje, Próximos 5 dias). As demais pendentes
-- continuam entrando (Solicitado ao Compras, Não pago). Contagens e totais
-- consideram só o que entra.
--
-- Só o aviso do Telegram muda: vw_lancamentos, a tela Início e o Painel
-- Financeiro continuam com a regra de antes.
--
-- Mesma assinatura (create or replace): o job do pg_cron
-- 'avisos-financeiros-diarios' (08:00 de Palmas) continua chamando esta
-- função, sem precisar ser recriado. Mantidos: fuso America/Araguaina,
-- divisão acima de ~3.500 caracteres, um envio por dia e a segurança.
--
-- Tudo em uma transação: se algo falhar, nada é aplicado.
begin;

create or replace function public.avisos_financeiros_diarios()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
-- Resumo diário das contas no Telegram (tipo 'resumo_financeiro' no log).
-- Grupos, nesta ordem, pela situacao_vencimento da vw_lancamentos ("hoje"
-- de Palmas, calculado na view):
--   Vencidas         'vencido'  (há X dias; total)
--   Vencem hoje      'hoje'     (total)
--   Próximos 5 dias  'proximo'  (em X dias; total)
-- Entram as pendentes (nem pagas nem canceladas), EXCETO as "Enviado ao
-- Financeiro" (situacao = 'enviado_financeiro'), que já estão com o
-- Financeiro e não precisam de cobrança da equipe (migration 025).
-- Nada em nenhum grupo = não envia. Acima de ~3.500 caracteres, divide em
-- várias mensagens, em ordem. Um envio por dia: se já houver no log um
-- 'resumo_financeiro' de hoje com request_id, não envia de novo.
-- Devolve quantas mensagens foram entregues ao pg_net (0 = nada a avisar
-- ou já enviado hoje; o motivo sai em NOTICE).
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
    raise notice 'Nenhuma conta vencida, vencendo hoje ou nos próximos 5 dias (fora as enviadas ao Financeiro); nada enviado.';
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

comment on function public.avisos_financeiros_diarios() is
  'Resumo diário das contas no Telegram (job avisos-financeiros-diarios, 08:00 de Palmas): vencidas, vencem hoje e próximos 5 dias, sem as "Enviado ao Financeiro" (025). Um envio por dia.';

-- Mesma assinatura: o revoke da 024 continua valendo; reafirmado.
revoke execute on function public.avisos_financeiros_diarios() from public, anon, authenticated;

commit;

-- ---------------------------------------------------------
-- Conferências (rode depois, no SQL Editor)
-- ---------------------------------------------------------
-- 1) Pendentes por grupo e situação (a view continua com as
--    "enviado_financeiro"; o resumo ignora essas linhas)
-- select situacao_vencimento, situacao, count(*), sum(valor)
--   from public.vw_lancamentos
--  where situacao_vencimento in ('vencido', 'hoje', 'proximo')
--  group by 1, 2 order by 1, 2;
--
-- 2) Repetir o teste no mesmo dia: apagar o resumo de hoje (data de Palmas)
--    do log e rodar de novo
-- delete from public.avisos_telegram_log
--  where tipo = 'resumo_financeiro'
--    and (criado_em at time zone 'America/Araguaina')::date
--        = (now() at time zone 'America/Araguaina')::date;
-- select public.avisos_financeiros_diarios();
--
-- 3) Job continua agendado (esperado: 1 linha, "0 11 * * *", active = true)
-- select jobname, schedule, active from cron.job
--  where jobname = 'avisos-financeiros-diarios';
