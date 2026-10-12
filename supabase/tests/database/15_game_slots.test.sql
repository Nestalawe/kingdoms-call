-- Realm slots as the player portal sees other realms (plan step P0-20, Unit B expand). Nothing on the site
-- uses these yet.
--
-- What the game needs:
--   is_game_member(game) and is_game_gm(game) say whether the caller holds a realm in, or runs, that game
--   (for the access rules of P0-21 onwards; signed-in accounts only);
--   get_game_slots(games) gives, for each game the caller may see, every slot's number, whether it's a bot,
--   and whether its orders are in (the "N of M realms have sent orders" tally, open games' player counts, the
--   join form's next free number, the Dispatches roster), plus each realm's alignment while the game is in
--   setup (the join form's Divine/Undead check). A member or the game's GM sees their game; any signed-in
--   account sees a public game in setup, and an invited one a private game in setup.
-- Also checked: it never gives orders, reports, names or accounts; nobody sees a running game they're not
-- in; alignments aren't given once a game is running; signed-out visitors can't call any of it; and a game
-- never has two realms with the same number.
begin;
\ir ../lib/world.psql
select plan(24);

-- A realm that has joined Open Vale (public, setup) and one in Hidden Glen (private, setup).
select pg_temp.kc_as('postgres');
insert into public.game_players (game_id, user_id, player_index, display_name, turn_report) values
  (pg_temp.kc_game('S'), pg_temp.kc_uid('p3'), 0, 'Morrowhold', '{"playerSetup":{"alignment":"Divine","race":"Elven"}}'),
  (pg_temp.kc_game('P'), pg_temp.kc_uid('p2'), 0, 'Glenmoor',   '{"playerSetup":{"alignment":"Undead"}}');

-- Another private game in setup, written the way the portals write it: settings and reports as JSON text
-- inside jsonb. One report's text isn't valid JSON.
insert into public.games (id, name, gm_user_id, status, turn, max_players, game_state) values
  ('00000000-0000-4000-b000-0000000000e1', 'Ember Hollow', pg_temp.kc_uid('gm2'), 'setup', 0, 4,
   to_jsonb(json_build_object('visibility', 'private', 'invited', json_build_array(pg_temp.kc_uid('invitee')))::text));
insert into public.game_players (game_id, user_id, player_index, display_name, turn_report) values
  ('00000000-0000-4000-b000-0000000000e1', pg_temp.kc_uid('p4'), 0, 'Emberfall', to_jsonb('{"playerSetup":{"alignment":"Divine"}}'::text)),
  ('00000000-0000-4000-b000-0000000000e1', pg_temp.kc_uid('p1'), 1, 'Ashmere',   to_jsonb('{not json'::text));

-- ── the helpers ──────────────────────────────────────────────────────────────────────────────

select pg_temp.kc_as('p1');
select is(public.is_game_member(pg_temp.kc_game('A')), true,  'a player is a member of their game');
select is(public.is_game_member(pg_temp.kc_game('B')), false, 'but not of another game');
select is(public.is_game_gm(pg_temp.kc_game('A')),     false, 'and a player isn''t its GM');
select pg_temp.kc_as('gm');
select is(public.is_game_gm(pg_temp.kc_game('A')),     true,  'the GM runs their game');
select is(public.is_game_gm(pg_temp.kc_game('B')),     false, 'but not another GM''s');

-- ── what the game needs ──────────────────────────────────────────────────────────────────────

select pg_temp.kc_as('p1');
select results_eq($$select player_index, is_bot, orders_submitted from public.get_game_slots(array[pg_temp.kc_game('A')])
                    order by player_index$$,
  $$values (0, false, true), (1, false, false), (2, true, false), (3, false, false)$$,
  'a player sees every slot of their game: its number, bot or not, orders in or not');
select is((select count(*)::int from public.get_game_slots(array[pg_temp.kc_game('A')]) where alignment is not null), 0,
  'but no realm''s alignment once the game is running');

select pg_temp.kc_as('gm');
select is((select count(*)::int from public.get_game_slots(array[pg_temp.kc_game('A'), pg_temp.kc_game('S')])), 5,
  'the GM sees every slot of their games');

select pg_temp.kc_as('stranger');
select results_eq($$select game_id, player_index, is_bot, alignment from public.get_game_slots(array[pg_temp.kc_game('S')])$$,
  $$values (pg_temp.kc_game('S'), 0, false, 'Divine'::text)$$,
  'any signed-in account sees an open public game''s slots, with the alignments taken (the join form)');

select pg_temp.kc_as('invitee');
select is((select alignment from public.get_game_slots(array[pg_temp.kc_game('P')])), 'Undead',
  'an invited account sees the private game''s slots');

select pg_temp.kc_as('p1');
select is((select count(*)::int from public.get_game_slots(array[pg_temp.kc_game('A'), pg_temp.kc_game('B'), pg_temp.kc_game('S')])), 5,
  'several games at once: only the ones the caller may see');

-- ── what it never gives ──────────────────────────────────────────────────────────────────────

select pg_temp.kc_as('postgres');
select is(pg_get_function_result('public.get_game_slots(uuid[])'::regprocedure),
  'TABLE(game_id uuid, player_index integer, is_bot boolean, orders_submitted boolean, alignment text)',
  'it gives only the game, number, bot, orders-in and alignment: no orders, reports, names or accounts');

select pg_temp.kc_as('p3');
select is((select count(*)::int from public.get_game_slots(array[pg_temp.kc_game('A')])), 0,
  'a player in another game sees none of a running game''s slots');
select pg_temp.kc_as('stranger');
select is((select count(*)::int from public.get_game_slots(array[pg_temp.kc_game('A'), pg_temp.kc_game('C')])), 0,
  'an account in no game sees no running or finished game''s slots');
select is((select count(*)::int from public.get_game_slots(array[pg_temp.kc_game('P')])), 0,
  'nor a private game in setup it isn''t invited to');

select is((select count(*)::int from public.get_game_slots(array['00000000-0000-4000-b000-0000000000e1'::uuid])), 0,
  'a private game stored as text is still private');
select pg_temp.kc_as('invitee');
select results_eq($$select player_index, alignment from public.get_game_slots(array['00000000-0000-4000-b000-0000000000e1'::uuid])$$,
  $$values (0, 'Divine'::text), (1, null::text)$$,
  'reports stored as text are read; one that isn''t valid JSON gives no alignment, and no error');
select pg_temp.kc_as('p4');
select is((select count(*)::int from public.get_game_slots(array['00000000-0000-4000-b000-0000000000e1'::uuid])), 2,
  'a member sees it');

select pg_temp.kc_as('anon');
select throws_ok($$select * from public.get_game_slots(array[pg_temp.kc_game('S')])$$, '42501', null,
  'a signed-out visitor can''t call get_game_slots');
select throws_ok($$select public.is_game_member(pg_temp.kc_game('A'))$$, '42501', null,
  'nor is_game_member');
select throws_ok($$select public.is_game_gm(pg_temp.kc_game('A'))$$, '42501', null,
  'nor is_game_gm');

-- ── one realm per number ─────────────────────────────────────────────────────────────────────

select pg_temp.kc_as('gm');
select throws_ok($$insert into public.game_players (game_id, user_id, player_index, display_name)
                   values (pg_temp.kc_game('A'), null, 2, 'Second Grimfast')$$, '23505', null,
  'a game can''t have two realms with the same number (the GM adding a bot)');
select pg_temp.kc_as('stranger');
select throws_ok($$insert into public.game_players (game_id, user_id, player_index, display_name)
                   values (pg_temp.kc_game('S'), auth.uid(), 0, 'Ashby Hold')$$, '23505', null,
  'nor a player joining with a number that''s taken');
select is(pg_temp.kc_writes($$insert into public.game_players (game_id, user_id, player_index, display_name)
          values (pg_temp.kc_game('S'), auth.uid(), 1, 'Ashby Hold')$$), 1,
  'a free number still joins');

select * from finish();
rollback;
