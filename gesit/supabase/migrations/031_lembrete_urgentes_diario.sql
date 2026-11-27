-- =========================================================
-- GesIT — 031 Avisos no Telegram: lembrete diário dos cards urgentes
-- =========================================================
-- Tudo no Supabase, sem código no app. Envio por public.enviar_telegram
-- (023/029: escapa o HTML, grava em avisos_telegram_log e nunca propaga
-- erro) e registro de cada execução em public.avisos_execucoes (029).
--
-- public.lembrete_urgentes_diario(), em dois turnos (manhã antes das 12:00
-- de Palmas, tarde a partir das 12:00), lista os cards com urgente = true e
-- não concluídos (arquivada = false), do mais antigo como urgente
-- (urgente_em) para o mais novo:
--
--   🚨 GesIT — Cards urgentes em aberto (DD/MM/AAAA, manhã) — N cards
--
--   • {título}
--   Coluna: {coluna} · Responsável: {nome ou sem responsável}
--   Urgente há X dias | Urgente desde hoje · {prazo}
--   {app_url}/atividades?atividade=<id>        (só se app_url existir)
--
--   Prazo (só quando houver): "vence hoje", "vencido há X dias" ou
--   "prazo DD/MM/AAAA". Dias contados nas datas de Palmas.
--   Responsável por public.nome_curto_usuario (027: nome de exibição →
--   nome do Supabase → e-mail antes do @ com iniciais maiúsculas).
--
-- HTML: o texto vai cru para enviar_telegram, que já escapa & < > (escapar
-- aqui também faria o Telegram mostrar "&amp;lt;").
--
-- Acima de ~3.500 caracteres, divide em várias mensagens, em ordem, sem
-- quebrar o bloco de um card (as seguintes começam com "(continuação)").
-- Sem cards urgentes em aberto: não envia (resultado 'nada_a_avisar').
--
-- Idempotência por turno, independente do resumo financeiro: tipo próprio
-- 'lembrete_urgentes' no avisos_telegram_log, referencia
-- 'AAAA-MM-DD manha|tarde n/N'; se já houver no log um desses de hoje
-- (data de Palmas), do mesmo turno, com request_id, não envia de novo
-- ('ja_enviado'). Toda execução vai para avisos_execucoes (rotina
-- 'lembrete_urgentes').
--
-- pg_cron: 'lembrete-urgentes-manha' (0 11 * * *) e
-- 'lembrete-urgentes-tarde' (0 17 * * *) = 08:00 e 14:00 de Palmas (UTC−3).
-- Remove antes os jobs de mesmo nome e qualquer outro cujo command chame a
-- função, então a migration pode ser rodada de novo.
--
-- Segurança: security definer, search_path vazio, dono postgres (o RLS das
-- tabelas do Kanban vale para o dono dentro da função) e execute revogado
-- de public/anon/authenticated. Não muda nenhuma migration anterior.
--
-- Tudo em uma transação: se algo falhar, nada é aplicado.
begin;

-- ---------------------------------------------------------
-- 1. Lembrete dos cards urgentes
-- ---------------------------------------------------------
create or replace function public.lembrete_urgentes_diario()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
-- Devolve quantas mensagens foram entregues ao pg_net (0 = nada a avisar,
-- já enviado neste turno ou falha; o motivo fica em avisos_execucoes).
declare
  c_limite  constant integer := 3500;
  c_tipo    constant text := 'lembrete_urgentes';
  v_agora   timestamp := now() at time zone 'America/Araguaina';
  v_hoje    date := (now() at time zone 'America/Araguaina')::date;
  v_turno   text;
  v_rotulo  text;
  v_url     text;
  v_qtd     integer;
  v_blocos  text[] := '{}';
  v_partes  text[] := '{}';
  v_atual   text := '';
  v_bloco   text;
  v_item    record;
  v_dias    integer;
  v_prazo   text;
  v_enviadas integer := 0;
  v_req     bigint;
  v_reqs    bigint[] := '{}';
  v_resultado text;
  v_detalhe jsonb := '{}'::jsonb;
  i         integer;
begin
  v_turno := case when extract(hour from v_agora) < 12 then 'manha' else 'tarde' end;
  v_rotulo := case when v_turno = 'manha' then 'manhã' else 'tarde' end;

  select count(*) into v_qtd
    from public.kanban_atividades a
   where a.urgente and not a.arquivada;

  v_detalhe := jsonb_build_object(
    'hora_palmas', to_char(v_agora, 'YYYY-MM-DD HH24:MI:SS'),
    'urgentes_em_aberto', v_qtd
  );

  -- Idempotência por turno: já entregue hoje (data de Palmas) neste turno?
  if exists (
    select 1 from public.avisos_telegram_log
     where tipo = c_tipo
       and request_id is not null
       and (criado_em at time zone 'America/Araguaina')::date = v_hoje
       and split_part(coalesce(referencia, ''), ' ', 2) = v_turno
  ) then
    v_resultado := 'ja_enviado';
  elsif v_qtd = 0 then
    v_resultado := 'nada_a_avisar';
  else
    select nullif(rtrim(btrim(decrypted_secret), '/'), '') into v_url
      from vault.decrypted_secrets where name = 'app_url'
     limit 1;

    for v_item in
      select a.id, a.titulo, a.prazo, a.responsavel_id, k.nome as coluna,
             (a.urgente_em at time zone 'America/Araguaina')::date as urgente_desde
        from public.kanban_atividades a
        left join public.kanban_colunas k on k.id = a.coluna_id
       where a.urgente and not a.arquivada
       order by a.urgente_em, a.created_at, a.id
    loop
      v_dias := greatest(v_hoje - coalesce(v_item.urgente_desde, v_hoje), 0);

      v_prazo := case
        when v_item.prazo is null then null
        when v_item.prazo = v_hoje then 'vence hoje'
        when v_item.prazo < v_hoje then
          'vencido há ' || (v_hoje - v_item.prazo)
          || case when v_hoje - v_item.prazo = 1 then ' dia' else ' dias' end
        else 'prazo ' || to_char(v_item.prazo, 'DD/MM/YYYY')
      end;

      -- concat_ws pula os nulos: linhas e trechos opcionais somem.
      v_bloco := concat_ws(E'\n',
        '• ' || coalesce(nullif(btrim(v_item.titulo), ''), '(sem título)'),
        'Coluna: ' || coalesce(v_item.coluna, '—')
          || ' · Responsável: '
          || coalesce(public.nome_curto_usuario(v_item.responsavel_id), 'sem responsável'),
        concat_ws(' · ',
          case
            when v_dias = 0 then 'Urgente desde hoje'
            when v_dias = 1 then 'Urgente há 1 dia'
            else 'Urgente há ' || v_dias || ' dias'
          end,
          v_prazo),
        case when v_url is not null then v_url || '/atividades?atividade=' || v_item.id end
      );
      v_blocos := v_blocos || v_bloco;
    end loop;

    v_qtd := cardinality(v_blocos);
    v_atual := '🚨 GesIT — Cards urgentes em aberto ('
      || to_char(v_hoje, 'DD/MM/YYYY') || ', ' || v_rotulo || ') — '
      || v_qtd || case when v_qtd = 1 then ' card' else ' cards' end;

    -- Divide em partes de até ~3.500 caracteres, sem quebrar um card.
    foreach v_bloco in array v_blocos loop
      if char_length(v_atual) + 2 + char_length(v_bloco) > c_limite then
        v_partes := v_partes || v_atual;
        v_atual := '(continuação)';
      end if;
      v_atual := v_atual || E'\n\n' || v_bloco;
    end loop;
    v_partes := v_partes || v_atual;

    for i in 1 .. cardinality(v_partes) loop
      v_req := public.enviar_telegram(
        c_tipo,
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
      'com_link', v_url is not null,
      'request_ids', to_jsonb(v_reqs)
    );
  end if;

  -- O registro nunca derruba o envio.
  begin
    insert into public.avisos_execucoes
      (rotina, turno, data_referencia, resultado, enviadas,
       usuario_sessao, usuario_efetivo, aplicacao, detalhe)
    values
      (c_tipo, v_turno, v_hoje, v_resultado, v_enviadas,
       session_user::text, current_user::text,
       nullif(current_setting('application_name', true), ''), v_detalhe);
  exception when others then
    raise warning 'Falha ao registrar a execução do lembrete de urgentes: %', sqlerrm;
  end;

  raise notice 'Lembrete de urgentes de % (%): % — % mensagem(ns) entregue(s) ao pg_net.',
    to_char(v_hoje, 'DD/MM/YYYY'), v_rotulo, v_resultado, v_enviadas;
  return v_enviadas;
end $$;

comment on function public.lembrete_urgentes_diario() is
  'Lembrete no Telegram dos cards urgentes não concluídos, em dois turnos (jobs lembrete-urgentes-manha às 08:00 e lembrete-urgentes-tarde às 14:00 de Palmas). Um envio por turno (tipo lembrete_urgentes); cada execução vai para avisos_execucoes.';

alter function public.lembrete_urgentes_diario() owner to postgres;

revoke execute on function public.lembrete_urgentes_diario() from public, anon, authenticated;

comment on table public.avisos_execucoes is
  'Cada execução das rotinas agendadas do Telegram (resumo_financeiro, lembrete_urgentes), pelo pg_cron ou manual: resultado, turno, quem chamou e contagens. Diagnóstico dos jobs.';

-- ---------------------------------------------------------
-- 2. pg_cron: remove os jobs do lembrete (pelo nome ou pelo command) e
--    recria os dois turnos
-- ---------------------------------------------------------
select cron.unschedule(jobid)
  from cron.job
 where jobname in ('lembrete-urgentes-manha', 'lembrete-urgentes-tarde')
    or command ilike '%lembrete_urgentes_diario%';

select cron.schedule(
  'lembrete-urgentes-manha',
  '0 11 * * *', -- 08:00 em Palmas (UTC−3)
  $cron$select public.lembrete_urgentes_diario();$cron$
);

select cron.schedule(
  'lembrete-urgentes-tarde',
  '0 17 * * *', -- 14:00 em Palmas (UTC−3)
  $cron$select public.lembrete_urgentes_diario();$cron$
);

commit;

-- ---------------------------------------------------------
-- Conferências (rode depois, no SQL Editor)
-- ---------------------------------------------------------
-- 1) Jobs (esperado: 2 linhas, "0 11 * * *" e "0 17 * * *", command
--    "select public.lembrete_urgentes_diario();", active = true)
-- select jobid, jobname, schedule, command, database, username, active
--   from cron.job
--  where jobname in ('lembrete-urgentes-manha', 'lembrete-urgentes-tarde')
--     or command ilike '%lembrete_urgentes_diario%'
--  order by jobname;
--
-- 2) Função sem execute para o app (esperado: anon e authenticated false;
--    security_definer true; proconfig {search_path=""}; dono postgres)
-- select p.proname, p.proowner::regrole as dono,
--        has_function_privilege('anon', p.oid, 'execute') as anon,
--        has_function_privilege('authenticated', p.oid, 'execute') as authenticated,
--        p.prosecdef as security_definer, p.proconfig
--   from pg_proc p
--  where p.oid = 'public.lembrete_urgentes_diario()'::regprocedure;
--
-- 3) Simulação SEM enviar (o raise exception no fim desfaz tudo: log,
--    pedido ao pg_net e avisos_execucoes). Mostra resultado e mensagens.
-- do $$
-- declare
--   v_enviadas integer;
--   v_ultimo   bigint := (select coalesce(max(id), 0) from public.avisos_telegram_log);
--   v_exec     record;
--   v_msg      record;
-- begin
--   v_enviadas := public.lembrete_urgentes_diario();
--   select resultado, turno, detalhe into v_exec
--     from public.avisos_execucoes
--    where rotina = 'lembrete_urgentes'
--    order by id desc limit 1;
--   raise notice 'Resultado: % (turno %) · %', v_exec.resultado, v_exec.turno, v_exec.detalhe;
--   for v_msg in
--     select referencia, mensagem, erro from public.avisos_telegram_log
--      where tipo = 'lembrete_urgentes' and id > v_ultimo
--      order by id
--   loop
--     raise notice E'--- % (%)\n%', v_msg.referencia, coalesce(v_msg.erro, 'ok'), v_msg.mensagem;
--   end loop;
--   raise exception 'Simulação: % mensagem(ns) seriam enviadas. Nada foi enviado nem gravado.', v_enviadas;
-- end $$;
--
-- 4) Execuções do lembrete (aplicacao 'pg_cron' = disparo agendado)
-- select id, executado_em at time zone 'America/Araguaina' as em_palmas,
--        turno, resultado, enviadas, usuario_sessao, usuario_efetivo,
--        aplicacao, detalhe
--   from public.avisos_execucoes
--  where rotina = 'lembrete_urgentes'
--  order by id desc
--  limit 20;
--
-- 5) Log de hoje com a resposta do Telegram (status 200 = entregue)
-- select l.id, l.referencia, l.criado_em at time zone 'America/Araguaina' as em_palmas,
--        l.request_id, l.erro, r.status_code, r.error_msg
--   from public.avisos_telegram_log l
--   left join net._http_response r on r.id = l.request_id
--  where l.tipo = 'lembrete_urgentes'
--    and (l.criado_em at time zone 'America/Araguaina')::date
--        = (now() at time zone 'America/Araguaina')::date
--  order by l.id desc;
--
-- 6) Execuções no pg_cron
-- select j.jobname, d.start_time at time zone 'America/Araguaina' as em_palmas,
--        d.status, d.return_message, d.username, d.database
--   from cron.job_run_details d
--   join cron.job j on j.jobid = d.jobid
--  where j.jobname in ('lembrete-urgentes-manha', 'lembrete-urgentes-tarde')
--  order by d.start_time desc
--  limit 10;
