-- The Overlord (plan step P0-32a, decision D-13): one separate account above all others. Nothing on the site
-- uses it yet; later steps' rules ask is_site_admin().
--
-- What the game needs:
--   at most one Overlord, held in site_admins, which no API role can read or change;
--   is_site_admin() is true only for that account, and only signed-in accounts may ask;
--   the Overlord is set only through kc_set_overlord(email, replace), which only the database itself may run
--   (the Overlord workflow, with Toby's approval; the staging seed), and which refuses an email with no
--   account, an account that runs or plays in any game, and replacing an Overlord without `replace`;
--   the Overlord's account can't be deleted while it holds the role.
begin;
\ir ../lib/world.psql
select plan(19);

-- ── nobody but the database touches site_admins or sets the Overlord ─────────────────────────────

select pg_temp.kc_as('postgres');
select is((select string_agg(r || ' ' || p, ', ' order by r, p)
           from unnest(array['anon','authenticated']) r
           cross join unnest(array['SELECT','INSERT','UPDATE','DELETE','TRUNCATE','REFERENCES','TRIGGER']) p
           where has_table_privilege(r, 'public.site_admins', p)), null,
  'no API role can read or change site_admins');
select is((select string_agg(r, ', ' order by r) from unnest(array['anon','authenticated']) r
           where has_function_privilege(r, 'public.kc_set_overlord(text,boolean)', 'EXECUTE')), null,
  'no API role can set the Overlord');
select ok(not has_function_privilege('anon', 'public.is_site_admin()', 'EXECUTE'),
  'a signed-out visitor can''t ask is_site_admin()');
select ok(has_function_privilege('authenticated', 'public.is_site_admin()', 'EXECUTE'),
  'a signed-in account can ask is_site_admin()');

-- ── no Overlord yet ─────────────────────────────────────────────────────────────────────────────

select pg_temp.kc_as('stranger');
select is(public.is_site_admin(), false, 'with no Overlord set, nobody is one');

-- ── kc_set_overlord refuses what the Overlord must never be ──────────────────────────────────────

select pg_temp.kc_as('postgres');
select throws_like($$select public.kc_set_overlord('nobody@example.test', false)$$,
  '%No account has that email%', 'an email with no account is refused');
select throws_like($$select public.kc_set_overlord('gm@example.test', false)$$,
  '%runs a game%', 'a Game Master of any game is refused');
select throws_like($$select public.kc_set_overlord('p3@example.test', false)$$,
  '%holds a realm%', 'a player with a realm in any game is refused');
select is((select count(*)::int from public.site_admins), 0, 'after the refusals, still no Overlord');

-- ── setting it ───────────────────────────────────────────────────────────────────────────────────

select is(public.kc_set_overlord('Stranger@Example.TEST', false), 'Overlord set',
  'an account in no game becomes the Overlord (the email''s case doesn''t matter)');
select is(public.kc_set_overlord('stranger@example.test', false), 'Overlord already set',
  'setting the same account again changes nothing');

select pg_temp.kc_as('stranger');
select is(public.is_site_admin(), true, 'the Overlord is one');
select pg_temp.kc_as('gm');
select is(public.is_site_admin(), false, 'a Game Master isn''t');
select pg_temp.kc_as('p1');
select is(public.is_site_admin(), false, 'a player isn''t');

-- ── one Overlord at most; replacing needs `replace` ──────────────────────────────────────────────

select pg_temp.kc_as('postgres');
select throws_like($$select public.kc_set_overlord('invitee@example.test', false)$$,
  '%already set%replace%', 'replacing the Overlord without replace is refused');
select throws_ok($$insert into public.site_admins (user_id) values (pg_temp.kc_uid('invitee'))$$,
  '23505', null, 'a second Overlord row is impossible');
select throws_ok($$delete from auth.users where id = pg_temp.kc_uid('stranger')$$,
  '23503', null, 'the Overlord''s account can''t be deleted while it holds the role');

select is(public.kc_set_overlord('invitee@example.test', true), 'Overlord set', 'with replace, the role is handed over');
select pg_temp.kc_as('stranger');
select is(public.is_site_admin(), false, 'after the hand-over, the previous Overlord no longer is one');

select * from finish();
rollback;
