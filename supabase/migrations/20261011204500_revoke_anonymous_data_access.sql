-- All application reads/writes require a Supabase Auth session.  Auth signup
-- itself is handled by Supabase Auth and does not need anonymous table grants.
begin;
do $$
declare
  item record;
begin
  for item in
    select schemaname, tablename
    from pg_tables
    where schemaname = 'public'
  loop
    execute format('revoke all on table %I.%I from anon', item.schemaname, item.tablename);
  end loop;
end $$;
commit;
