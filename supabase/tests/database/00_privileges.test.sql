-- Privileges: what each API role may do at all, before any access rule is asked.
--
-- What the game needs:
--   a signed-out visitor reads the Hall of Fame (game_records) and asks for the database's version
--   (kc_db_version(), P0-34: every page asks before its first read), and nothing else; every other page
--   signs in before its first query;
--   a signed-in account reads and writes through the access rules (select, insert, update, delete);
--   sign-up gives a new account its profile; the trigger's function runs as the trigger only, so nobody
--   needs to call it (a trigger's function isn't checked for EXECUTE when it fires; the test runner can't
--   act as the auth service's role, so sign-up itself is checked against the local auth service and on
--   staging).
-- Checked over every table, sequence and function in public, so a new one that keeps Supabase's default
-- grants fails here until its migration revokes them (supabase/README.md).
begin;
\ir ../lib/world.psql
select plan(7);

select pg_temp.kc_as('postgres');

select is((select string_agg(c.relname || ' ' || p, ', ' order by c.relname, p)
           from pg_class c
           cross join unnest(array['SELECT','INSERT','UPDATE','DELETE','TRUNCATE','REFERENCES','TRIGGER','MAINTAIN']) p
           where c.relnamespace = 'public'::regnamespace and c.relkind in ('r','p','v','m','f')
             and has_table_privilege('anon', c.oid, p)
             and not (c.relname = 'game_records' and p = 'SELECT')), null,
  'signed-out visitors hold no table privilege except reading the Hall of Fame');

select is((select string_agg(c.relname || ' ' || p, ', ' order by c.relname, p)
           from pg_class c
           cross join unnest(array['TRUNCATE','REFERENCES','TRIGGER','MAINTAIN']) p
           where c.relnamespace = 'public'::regnamespace and c.relkind in ('r','p','v','m','f')
             and has_table_privilege('authenticated', c.oid, p)), null,
  'signed-in accounts hold no table privilege beyond select, insert, update and delete');

select is((select count(*)::int from pg_class c where c.relnamespace = 'public'::regnamespace
            and c.relkind = 'r' and has_table_privilege('authenticated', c.oid, 'TRUNCATE')), 0,
  'signed-in accounts can''t truncate any table');
select is((select count(*)::int from pg_class c where c.relnamespace = 'public'::regnamespace
            and c.relkind = 'r' and has_table_privilege('anon', c.oid, 'TRUNCATE')), 0,
  'signed-out visitors can''t truncate any table');

select is((select string_agg(c.relname || ' ' || p, ', ' order by c.relname, p)
           from pg_class c cross join unnest(array['USAGE','SELECT','UPDATE']) p
           where c.relnamespace = 'public'::regnamespace and c.relkind = 'S'
             and has_sequence_privilege('anon', c.oid, p)), null,
  'signed-out visitors can''t use any sequence');

select is((select string_agg(f.oid::regprocedure::text, ', ' order by 1)
           from pg_proc f where f.pronamespace = 'public'::regnamespace
             and has_function_privilege('anon', f.oid, 'EXECUTE')
             and f.oid <> 'public.kc_db_version()'::regprocedure), null,
  'signed-out visitors can''t call any function except asking for the database''s version');

select is((select string_agg(r, ', ' order by r) from unnest(array['anon','authenticated']) r
           where has_function_privilege(r, 'public.handle_new_user()', 'EXECUTE')), null,
  'nobody calls the sign-up trigger''s function directly');

select * from finish();
rollback;
