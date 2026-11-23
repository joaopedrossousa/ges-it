-- =========================================================
-- GesIT — 030 Avisos no Telegram (T3): acompanhamento dos cards urgentes
-- =========================================================
-- Tudo no Supabase, sem código no app. Envio por public.enviar_telegram
-- (023: escapa o HTML, grava em avisos_telegram_log e nunca propaga erro).
--
-- 1. Comentário novo em card urgente (tipo 'comentario_urgente',
--    referencia = id da atividade), quando a atividade está com
--    urgente = true e não concluída (arquivada = false):
--      💬 Atualização de status do card: {título}
--      Coluna: {coluna} · Responsável: {nome ou sem responsável}
--      {autor}: "{texto, cortado em 300 caracteres com …}"
--      📎 N imagem(ns)                    (só se houver imagens)
--      {app_url}/atividades?atividade=<id> (só se app_url existir no Vault)
--    Sem texto (comentário só com imagens), a linha do texto sai e o autor
--    vai na linha das imagens: "{autor}: 📎 N imagem(ns)", para o aviso
--    nunca ficar sem quem comentou.
--
--    Contagem das imagens: adicionar_comentario (022) insere o comentário e
--    só DEPOIS grava as imagens (kanban_gravar_anexos_comentario), na mesma
--    transação. Uma trigger AFTER INSERT comum rodaria entre as duas coisas
--    e contaria 0. Por isso é uma CONSTRAINT TRIGGER DEFERRABLE INITIALLY
--    DEFERRED: continua sendo AFTER INSERT em kanban_comentarios, mas roda
--    no fim da transação (no COMMIT), quando as imagens já estão gravadas,
--    e conta nesse momento. Vantagens sobre mexer em adicionar_comentario:
--    não recria aquela função (regras e mensagens da 022 intactas) e vale
--    para qualquer caminho de insert. urgente/arquivada e o próprio
--    comentário (não removido) também são lidos no COMMIT. O pg_net só
--    envia depois do COMMIT; se a transação desfizer, nada sai.
--
--    Não avisa: edição (editar_comentario faz UPDATE) e remoção (UPDATE de
--    removido): a trigger é só de INSERT. Migração de dados antiga (022:
--    descrição → primeiro comentário, com created_at da atividade): já
--    rodou e não dispara triggers criadas depois; além disso, a trigger
--    ignora inserts com created_at de mais de 5 minutos antes do início da
--    transação (cargas retroativas).
--
-- 2. Card urgente concluído (tipo 'urgente_concluido', referencia = id da
--    atividade): arquivada false → true com urgente = true.
--      ✅ Card urgente concluído: {título}
--      Concluído por: {nome}
--    O nome é o de concluida_por (028, gravado por arquivar_atividade);
--    sem ele, o usuário da sessão; sem os dois, "—". Reabrir (arquivada
--    true → false) e desmarcar urgente continuam sem aviso. O
--    preenchimento da 028 não mudou arquivada: não dispara.
--
-- Nomes por public.nome_curto_usuario (027: nome de exibição → nome do
-- Supabase → e-mail antes do @ com iniciais maiúsculas).
--
-- Segurança: funções security definer, search_path vazio e execute
-- revogado de public/anon/authenticated. Tudo dentro de "exception when
-- others": comentar ou concluir nunca falha por causa do Telegram.
--
-- Tudo em uma transação: se algo falhar, nada é aplicado.
begin;

-- ---------------------------------------------------------
-- 1. Comentário em card urgente
-- ---------------------------------------------------------
create or replace function public.avisar_comentario_urgente() returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  c_limite_texto constant integer := 300;
  v_titulo      text;
  v_coluna      text;
  v_responsavel uuid;
  v_urgente     boolean;
  v_arquivada   boolean;
  v_removido    boolean;
  v_texto       text;
  v_autor       text;
  v_imagens     integer;
  v_rotulo_img  text;
  v_url         text;
  v_mensagem    text;
begin
  begin
    -- Carga retroativa (created_at antigo): não é um comentário novo.
    if new.created_at < now() - interval '5 minutes' then
      return null;
    end if;

    -- Lido no COMMIT (trigger adiada): o estado final da transação.
    select c.removido, c.texto into v_removido, v_texto
      from public.kanban_comentarios c
     where c.id = new.id;
    if not found or v_removido then
      return null;
    end if;

    select a.titulo, a.responsavel_id, a.urgente, a.arquivada, k.nome
      into v_titulo, v_responsavel, v_urgente, v_arquivada, v_coluna
      from public.kanban_atividades a
      left join public.kanban_colunas k on k.id = a.coluna_id
     where a.id = new.atividade_id;
    if not found or v_urgente is not true or v_arquivada then
      return null;
    end if;

    select count(*) into v_imagens
      from public.kanban_comentario_anexos x
     where x.comentario_id = new.id and not x.removido;

    v_autor := coalesce(public.nome_curto_usuario(new.autor_id), '—');

    v_texto := nullif(btrim(v_texto), '');
    if char_length(v_texto) > c_limite_texto then
      v_texto := rtrim(left(v_texto, c_limite_texto)) || '…';
    end if;

    v_rotulo_img := case
      when v_imagens = 0 then null
      when v_imagens = 1 then '📎 1 imagem'
      else '📎 ' || v_imagens || ' imagens'
    end;

    select nullif(rtrim(btrim(decrypted_secret), '/'), '') into v_url
      from vault.decrypted_secrets where name = 'app_url'
     limit 1;

    -- concat_ws pula os nulos: linhas opcionais somem sem deixar linha vazia.
    v_mensagem := concat_ws(E'\n',
      '💬 Atualização de status do card: ' || v_titulo,
      'Coluna: ' || coalesce(v_coluna, '—')
        || ' · Responsável: ' || coalesce(public.nome_curto_usuario(v_responsavel), 'sem responsável'),
      case when v_texto is not null then v_autor || ': "' || v_texto || '"' end,
      case
        when v_rotulo_img is null then null
        when v_texto is null then v_autor || ': ' || v_rotulo_img
        else v_rotulo_img
      end,
      case when v_url is not null then v_url || '/atividades?atividade=' || new.atividade_id end
    );

    -- Só imagens que sumiram (comentário sem texto e sem imagem ativa): nada a dizer.
    if v_texto is null and v_rotulo_img is null then
      return null;
    end if;

    perform public.enviar_telegram('comentario_urgente', new.atividade_id::text, v_mensagem);
  exception when others then
    null; -- o aviso nunca impede comentar
  end;
  return null; -- trigger AFTER: o retorno é ignorado
end $$;

revoke execute on function public.avisar_comentario_urgente() from public, anon, authenticated;

-- AFTER INSERT adiada para o COMMIT (ver cabeçalho: contagem das imagens).
create constraint trigger trg_kanban_comentarios_aviso_urgente
  after insert on public.kanban_comentarios
  deferrable initially deferred
  for each row
  execute function public.avisar_comentario_urgente();

-- ---------------------------------------------------------
-- 2. Card urgente concluído
-- ---------------------------------------------------------
create or replace function public.avisar_urgente_concluido() returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  begin
    perform public.enviar_telegram(
      'urgente_concluido',
      new.id::text,
      concat_ws(E'\n',
        '✅ Card urgente concluído: ' || new.titulo,
        'Concluído por: ' || coalesce(
          public.nome_curto_usuario(coalesce(new.concluida_por, auth.uid())), '—')
      )
    );
  exception when others then
    null; -- o aviso nunca impede concluir
  end;
  return null; -- trigger AFTER: o retorno é ignorado
end $$;

revoke execute on function public.avisar_urgente_concluido() from public, anon, authenticated;

create trigger trg_kanban_atividades_aviso_urgente_concluido
  after update of arquivada on public.kanban_atividades
  for each row
  when (old.arquivada is false and new.arquivada is true and new.urgente is true)
  execute function public.avisar_urgente_concluido();

commit;

-- ---------------------------------------------------------
-- Conferências (rode depois, no SQL Editor)
-- ---------------------------------------------------------
-- 1) Triggers (esperado: as duas, enabled 'O'; a de comentário com
--    tgdeferrable e tginitdeferred = true)
-- select tgname, tgrelid::regclass, tgenabled, tgdeferrable, tginitdeferred
--   from pg_trigger
--  where tgname in ('trg_kanban_comentarios_aviso_urgente',
--                   'trg_kanban_atividades_aviso_urgente_concluido');
--
-- 2) Funções sem execute para o app (esperado: anon e authenticated false;
--    security_definer true; proconfig {search_path=""})
-- select p.proname,
--        has_function_privilege('anon', p.oid, 'execute') as anon,
--        has_function_privilege('authenticated', p.oid, 'execute') as authenticated,
--        p.prosecdef as security_definer, p.proconfig
--   from pg_proc p
--  where p.oid in ('public.avisar_comentario_urgente()'::regprocedure,
--                  'public.avisar_urgente_concluido()'::regprocedure);
--
-- 3) Últimos avisos e a resposta do Telegram (status 200 = entregue)
-- select l.id, l.tipo, l.referencia, l.criado_em at time zone 'America/Araguaina' as em_palmas,
--        l.mensagem, l.request_id, l.erro, r.status_code, r.error_msg
--   from public.avisos_telegram_log l
--   left join net._http_response r on r.id = l.request_id
--  where l.tipo in ('comentario_urgente', 'urgente_concluido')
--  order by l.id desc
--  limit 10;
