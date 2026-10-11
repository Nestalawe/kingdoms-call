-- The database's version, kc_db_version() (plan step P0-34): the newest migration applied. Every page that
-- uses the database asks for it before its first read (signed out too: the Hall of Fame), and stops if the
-- database is older than the page needs.
begin;
\ir ../lib/world.psql
select plan(5);

select pg_temp.kc_as('postgres');
insert into supabase_migrations.schema_migrations (version, name) values ('29991231235959', 'newest_for_this_test');

select pg_temp.kc_as('anon');
select lives_ok($$select public.kc_db_version()$$, 'a signed-out visitor can ask for the database version');
select is(public.kc_db_version(), '29991231235959', 'a signed-out visitor gets the newest migration applied');

select pg_temp.kc_as('p1');
select is(public.kc_db_version(), '29991231235959', 'a signed-in player gets the newest migration applied');

select pg_temp.kc_as('postgres');
select is((select provolatile from pg_proc where oid = 'public.kc_db_version()'::regprocedure), 's',
  'it only reads (stable)');
select is((select string_agg(r, ', ' order by r) from unnest(array['anon','authenticated']) r
           where not has_function_privilege(r, 'public.kc_db_version()', 'EXECUTE')), null,
  'both of the site''s roles can call it');

select * from finish();
rollback;
