-- =========================================================
-- GesIT — 028 Atividades concluídas (data e autor da conclusão)
-- =========================================================
-- Na interface, atividade "arquivada" passa a se chamar "concluída". O banco
-- não muda de nome: a coluna arquivada e as funções arquivar_atividade e
-- restaurar_atividade continuam (mesmas assinaturas). Colunas do quadro
-- continuam "arquivadas" (nada muda em kanban_colunas).
--
-- - kanban_atividades.concluida_em / concluida_por: gravadas por
--   arquivar_atividade (now() e auth.uid()) e limpas por restaurar_atividade.
--   Check: concluida_em preenchida se e só se arquivada; concluida_por só
--   com arquivada (pode ser nula: conclusões antigas sem autor).
-- - Preenchimento das já arquivadas: data e autor da última linha da
--   auditoria em que arquivada virou true; sem registro, updated_at e autor
--   nulo. As triggers de updated_at e de auditoria ficam desligadas só nesse
--   update (não é uma mudança feita por alguém; não deve ir para o log nem
--   mexer em updated_at).
-- - Índice para a tela Concluídas (ordem pela conclusão mais recente).
--
-- Tudo em uma transação: se algo falhar, nada é aplicado.
begin;

-- ---------------------------------------------------------
-- 1. Colunas
-- ---------------------------------------------------------
alter table public.kanban_atividades
  add column concluida_em  timestamptz,
  add column concluida_por uuid references auth.users (id) on delete set null;

comment on column public.kanban_atividades.concluida_em is
  'Quando foi concluída (arquivada = true). Nula enquanto aberta.';
comment on column public.kanban_atividades.concluida_por is
  'Quem concluiu. Nula enquanto aberta ou em conclusões antigas sem registro na auditoria.';

-- ---------------------------------------------------------
-- 2. Preenche as já concluídas (arquivadas)
-- ---------------------------------------------------------
alter table public.kanban_atividades disable trigger trg_kanban_atividades_upd;
alter table public.kanban_atividades disable trigger trg_auditoria;

update public.kanban_atividades a
   set concluida_em  = coalesce(log.alterado_em, a.updated_at),
       concluida_por = log.alterado_por
  from public.kanban_atividades a2
  left join lateral (
    select l.alterado_em, l.alterado_por
      from public.auditoria l
     where l.tabela = 'kanban_atividades'
       and l.registro_id = a2.id
       and 'arquivada' = any (l.campos_alterados)
       and (l.depois ->> 'arquivada')::boolean
     order by l.alterado_em desc, l.id desc
     limit 1
  ) log on true
 where a2.id = a.id
   and a.arquivada;

alter table public.kanban_atividades enable trigger trg_kanban_atividades_upd;
alter table public.kanban_atividades enable trigger trg_auditoria;

alter table public.kanban_atividades
  add constraint kanban_atividades_conclusao_valida
  check (arquivada = (concluida_em is not null)
         and (arquivada or concluida_por is null));

create index idx_kanban_atividades_concluidas
  on public.kanban_atividades (concluida_em desc) where arquivada;

-- ---------------------------------------------------------
-- 3. Funções (mesmas assinaturas e regras da 017; só gravam/limpam a conclusão)
-- ---------------------------------------------------------
create or replace function public.arquivar_atividade(p_atividade uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_coluna    uuid;
  v_arquivada boolean;
begin
  perform pg_advisory_xact_lock(hashtext('gesit_kanban'));

  select coluna_id, arquivada into v_coluna, v_arquivada
    from public.kanban_atividades where id = p_atividade;
  if not found then
    raise exception 'Atividade não encontrada. Atualize a página.';
  end if;
  if v_arquivada then
    return;
  end if;

  update public.kanban_atividades
     set arquivada = true,
         concluida_em = now(),
         concluida_por = auth.uid()
   where id = p_atividade;
  perform public.kanban_reindexar_atividades(v_coluna);
end $$;

create or replace function public.restaurar_atividade(p_atividade uuid, p_coluna uuid default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_coluna    uuid;
  v_arquivada boolean;
  v_destino   uuid;
begin
  perform pg_advisory_xact_lock(hashtext('gesit_kanban'));

  select coluna_id, arquivada into v_coluna, v_arquivada
    from public.kanban_atividades where id = p_atividade;
  if not found then
    raise exception 'Atividade não encontrada. Atualize a página.';
  end if;
  if not v_arquivada then
    return;
  end if;

  v_destino := coalesce(p_coluna, v_coluna);
  if not exists (select 1 from public.kanban_colunas where id = v_destino and not arquivada) then
    raise exception 'A coluna escolhida está arquivada. Reabra a atividade em outra coluna.';
  end if;

  update public.kanban_atividades
     set arquivada = false,
         concluida_em = null,
         concluida_por = null,
         coluna_id = v_destino,
         posicao = (select count(*) from public.kanban_atividades
                     where coluna_id = v_destino and not arquivada)
   where id = p_atividade;
end $$;

-- create or replace mantém os grants da 017 (execute só para authenticated).

commit;

-- ---------------------------------------------------------
-- Conferências (opcional, rode depois)
-- ---------------------------------------------------------
-- 1) Nenhuma concluída sem data (esperado: 0)
-- select count(*) from public.kanban_atividades where arquivada and concluida_em is null;
--
-- 2) Origem do preenchimento: com autor (veio da auditoria) x sem autor (updated_at)
-- select count(*) filter (where concluida_por is not null) as da_auditoria,
--        count(*) filter (where concluida_por is null)     as sem_autor
--   from public.kanban_atividades where arquivada;
--
-- 3) Nenhuma linha nova na auditoria pelo preenchimento (esperado: 0)
-- select count(*) from public.auditoria
--  where tabela = 'kanban_atividades' and 'concluida_em' = any (campos_alterados);
