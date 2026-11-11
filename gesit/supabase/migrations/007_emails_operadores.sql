-- =========================================================
-- GesIT — 007 E-mail de quem fez cada operação (relatórios)
-- =========================================================
-- vinculos.criado_por / encerrado_por guardam o id de auth.users, que o
-- PostgREST não expõe. Esta função devolve o e-mail desses usuários para o
-- relatório de movimentações, sem service_role no código.
--
-- Restrições:
--   - security definer (lê auth.users), com search_path vazio;
--   - só responde por usuários que de fato operaram algum vínculo;
--   - execução só para usuários logados (authenticated).
--
-- Tudo em uma transação: se algo falhar, nada é aplicado.
begin;

create or replace function public.emails_operadores(p_ids uuid[])
returns table (id uuid, email text)
language sql
stable
security definer
set search_path = ''
as $$
  select u.id, u.email::text
    from auth.users u
   where u.id = any (p_ids)
     and exists (
       select 1 from public.vinculos v
        where v.criado_por = u.id or v.encerrado_por = u.id
     );
$$;

revoke execute on function public.emails_operadores(uuid[]) from public, anon;
grant execute on function public.emails_operadores(uuid[]) to authenticated;

commit;
