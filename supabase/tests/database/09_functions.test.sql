-- The database's own functions, as the site's roles see them.
--
-- kc_transfer_games(game_ids, email) moves games to the account with that email. The site no longer
-- calls it (its GM-portal button was removed on 25 Sept 2026). No account moves a game it doesn't
-- run, and signed-out visitors can't call it.
-- handle_new_user() is the sign-up trigger that gives each new account a profile. It runs only as a
-- trigger.
begin;
\ir ../lib/world.psql
select plan(6);

-- ── nobody moves a game they don't run ───────────────────────────────────────────────────────

select pg_temp.kc_as('p1');
select isnt(pg_temp.kc_outcome($$select public.kc_transfer_games(array[pg_temp.kc_game('A')::text], 'p2@example.test')$$),
  'ok:1', 'a player can''t move their game to another account');

select pg_temp.kc_as('gm2');
select isnt(pg_temp.kc_outcome($$select public.kc_transfer_games(array[pg_temp.kc_game('A')::text], 'p3@example.test')$$),
  'ok:1', 'another GM can''t move the game to another account');

select pg_temp.kc_as('anon');
select throws_ok($$select public.kc_transfer_games(array[pg_temp.kc_game('A')::text], 'gm2@example.test')$$,
  null, null, 'a signed-out visitor can''t call the transfer');

select pg_temp.kc_as('postgres');
select is((select gm_user_id from public.games where id = pg_temp.kc_game('A')), pg_temp.kc_uid('gm'),
  'after all that, the game still has its own GM');

-- ── the sign-up trigger ──────────────────────────────────────────────────────────────────────

select pg_temp.kc_as('postgres');
select is((select name from public.profiles where id = pg_temp.kc_uid('p1')), 'Ada Thorn',
  'signing up gives the account a profile with its chosen name');

select pg_temp.kc_as('p1');
select throws_ok($$select public.handle_new_user()$$,
  null, null, 'the sign-up trigger can''t be called directly');

select * from finish();
rollback;
