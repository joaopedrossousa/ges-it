-- =========================================================
-- 013: CPF e e-mail dos colaboradores opcionais
--
-- - colaboradores.cpf e colaboradores.email passam a aceitar null.
--   As constraints unique e os checks de formato continuam: o unique
--   do Postgres não compara nulls (vários sem CPF/e-mail convivem) e
--   um check com null passa. Texto vazio continua barrado pelo check
--   (a app grava null, nunca '').
-- - registrar_auditoria: a máscara do CPF tratava só valor preenchido.
--   Com CPF null, '***.' || null vira null e jsonb_set(…, null) zera
--   o JSON inteiro. Agora null fica null no log.
-- =========================================================

-- ---------------------------------------------------------
-- 1. Colunas opcionais
-- ---------------------------------------------------------
alter table public.colaboradores alter column cpf   drop not null;
alter table public.colaboradores alter column email drop not null;

-- ---------------------------------------------------------
-- 2. Auditoria: máscara do CPF que aceita null
--    (create or replace mantém os grants/revokes e as triggers)
-- ---------------------------------------------------------
create or replace function public.registrar_auditoria() returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_novo   jsonb := to_jsonb(new) - 'updated_at';
  v_antigo jsonb;
  v_antes  jsonb := '{}';
  v_depois jsonb := '{}';
  v_campos text[] := '{}';
  v_chave  text;
begin
  if tg_op = 'INSERT' then
    v_depois := jsonb_strip_nulls(v_novo - 'id' - 'created_at');
    select coalesce(array_agg(k order by k), '{}') into v_campos
      from jsonb_object_keys(v_depois) as k;
  else
    v_antigo := to_jsonb(old) - 'updated_at';
    for v_chave in select jsonb_object_keys(v_novo) loop
      if v_novo -> v_chave is distinct from v_antigo -> v_chave then
        v_antes  := v_antes  || jsonb_build_object(v_chave, v_antigo -> v_chave);
        v_depois := v_depois || jsonb_build_object(v_chave, v_novo -> v_chave);
        v_campos := v_campos || v_chave;
      end if;
    end loop;
    if cardinality(v_campos) = 0 then
      return null; -- nada mudou de fato
    end if;
  end if;

  -- CPF nunca vai inteiro para o log: ***.456.789-** (null continua null)
  if tg_table_name = 'colaboradores' then
    if v_antes ? 'cpf' then
      v_antes := jsonb_set(v_antes, '{cpf}', public.mascarar_cpf_auditoria(v_antes ->> 'cpf'));
    end if;
    if v_depois ? 'cpf' then
      v_depois := jsonb_set(v_depois, '{cpf}', public.mascarar_cpf_auditoria(v_depois ->> 'cpf'));
    end if;
  end if;

  insert into public.auditoria
    (tabela, registro_id, acao, alterado_por, antes, depois, campos_alterados)
  values
    (tg_table_name,
     new.id,
     case when tg_op = 'INSERT' then 'insercao' else 'alteracao' end,
     auth.uid(),
     case when tg_op = 'INSERT' then null else v_antes end,
     v_depois,
     v_campos);

  return null; -- trigger AFTER: o retorno é ignorado
end $$;

-- Máscara usada pela trigger. Sempre devolve jsonb não nulo
-- ('null'::jsonb para CPF vazio), para o jsonb_set nunca receber null.
-- Criada depois da trigger no arquivo, mas o plpgsql só resolve na execução.
create or replace function public.mascarar_cpf_auditoria(p_cpf text) returns jsonb
language sql
immutable
set search_path = ''
as $$
  select case
    when p_cpf is null or p_cpf = '' then 'null'::jsonb
    else to_jsonb('***.' || substr(p_cpf, 4, 3) || '.' || substr(p_cpf, 7, 3) || '-**')
  end
$$;

revoke execute on function public.mascarar_cpf_auditoria(text) from public, anon, authenticated;
revoke execute on function public.registrar_auditoria() from public, anon, authenticated;

-- ---------------------------------------------------------
-- Conferências (rode depois; todas devem bater)
-- ---------------------------------------------------------
-- 1) Colunas anuláveis (esperado: YES nas duas linhas)
-- select column_name, is_nullable from information_schema.columns
--  where table_schema = 'public' and table_name = 'colaboradores'
--    and column_name in ('cpf', 'email');
--
-- 2) Unique e checks continuam lá (esperado: 2 unique + 2 check com cpf/email)
-- select conname, contype, pg_get_constraintdef(oid) from pg_constraint
--  where conrelid = 'public.colaboradores'::regclass and contype in ('u', 'c');
--
-- 3) Máscara (esperado: "***.456.789-**" e null)
-- select public.mascarar_cpf_auditoria('12345678909'), public.mascarar_cpf_auditoria(null);
