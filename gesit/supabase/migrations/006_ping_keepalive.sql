begin;

create or replace function public.ping()
returns int
language sql
stable
security invoker
set search_path = ''
as $$ select count(*)::int from public.lojas $$;

revoke execute on function public.ping() from public;
grant execute on function public.ping() to anon, authenticated;

commit;
