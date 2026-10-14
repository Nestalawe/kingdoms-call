-- The Overlord as Master GM, and handing a game to another GM (plan step P0-32e, ruling R-097).
--
-- What the game needs:
--   each GM still runs their own game, and still can't read or change another GM's.
-- Also checked: the Overlord does every GM action on any game (start it, run a turn, concede a realm, tidy a
-- dispatch, delete it), but adds no realm for an account and creates no game; nobody changes a game's GM by
-- editing it; reassign_game hands a game to a Game Master, only when the Overlord asks; once a GM's games are
-- handed over, they can be revoked.
begin;
\ir ../lib/world.psql
select plan(47);

-- The Overlord is stranger (in no game). p3 has an open offer. gm and gm2 are Game Masters (world.psql).
select pg_temp.kc_as('postgres');
select is(public.kc_set_overlord('stranger@example.test', false), 'Overlord set', 'stranger is the Overlord');
insert into public.game_masters (user_id, offered_at, offered_by, accepted_at)
  values (pg_temp.kc_uid('p3'), now(), pg_temp.kc_uid('stranger'), null);

-- ── what the game needs: each GM runs their own game, and only theirs ────────────────────────

select pg_temp.kc_as('gm');
select is(pg_temp.kc_writes($$update public.games set game_state = '{"world":"turn 4"}', turn = 4
          where id = pg_temp.kc_game('A') and turn = 3$$), 1,
  'the GM still saves their game');
select is(pg_temp.kc_count($$select id from public.game_players where game_id = pg_temp.kc_game('A')$$), 4,
  'the GM still reads every realm of their game');

select pg_temp.kc_as('gm2');
select is(pg_temp.kc_count($$select id from public.game_players where game_id = pg_temp.kc_game('A')$$), 0,
  'another GM reads no realm of the game');
select is(pg_temp.kc_writes($$update public.games set game_state = '{"world":"seized"}' where id = pg_temp.kc_game('A')$$), 0,
  'another GM can''t save the game');
select is(pg_temp.kc_writes($$update public.game_players set orders = null where game_id = pg_temp.kc_game('A')$$), 0,
  'another GM can''t change its realms');
select is(pg_temp.kc_writes($$insert into public.game_players (game_id, user_id, player_index, display_name, turn_report)
          values (pg_temp.kc_game('S'), null, 1, 'Ironhold', '{"isBot":true}')$$), 0,
  'another GM can''t add a bot realm to it');
select is(pg_temp.kc_writes($$delete from public.game_players where game_id = pg_temp.kc_game('A')$$), 0,
  'another GM can''t remove its realms');
select is(pg_temp.kc_writes($$insert into public.turn_logs (game_id, player_index, turn, entries)
          values (pg_temp.kc_game('A'), -1, 3, '[]')$$), 0,
  'another GM can''t write its turn log');
select is(pg_temp.kc_writes($$delete from public.game_messages where game_id = pg_temp.kc_game('A')::text$$), 0,
  'another GM can''t delete its dispatches');
select is(pg_temp.kc_writes($$delete from public.games where id = pg_temp.kc_game('A')$$), 0,
  'another GM can''t delete the game');
select is((select count(*)::int from public.get_game_slots(array[pg_temp.kc_game('A')])), 0,
  'another GM gets none of its slots');

-- ── the Overlord, Master GM of every game ────────────────────────────────────────────────────

select pg_temp.kc_as('stranger');
-- reading
select is(pg_temp.kc_count($$select id from public.game_players where game_id = pg_temp.kc_game('A')$$), 4,
  'the Overlord reads every realm of a game they don''t run');
select is((select count(*)::int from public.get_game_slots(array[pg_temp.kc_game('A'), pg_temp.kc_game('B')])), 5,
  'the Overlord gets the slots of every game asked for');
select is(pg_temp.kc_count($$select id from public.game_messages where game_id = pg_temp.kc_game('A')::text$$), 3,
  'the Overlord reads every dispatch, private ones too');
-- starting a game (Turn 0): bot rows, the world, the reports, the first log
select is(pg_temp.kc_writes($$insert into public.game_players (game_id, user_id, player_index, display_name, turn_report)
          values (pg_temp.kc_game('S'), null, 1, 'Ironhold', '{"isBot":true}')$$), 1,
  'the Overlord adds a bot realm to a game in setup');
select is(pg_temp.kc_writes($$delete from public.game_players where game_id = pg_temp.kc_game('A') and user_id is null$$), 1,
  'the Overlord clears a game''s bot realms');
select is(pg_temp.kc_writes($$update public.games set status = 'active', turn = 1, game_state = '{"world":"new"}'
          where id = pg_temp.kc_game('S')$$), 1,
  'the Overlord starts a game');
select is(pg_temp.kc_writes($$insert into public.turn_logs (game_id, player_index, turn, entries)
          values (pg_temp.kc_game('B'), 0, 0, '[]')$$), 1,
  'the Overlord writes a game''s turn log');
-- running a turn
select is(pg_temp.kc_writes($$update public.games set turn = 3, game_state = '{"world":"turn 3"}'
          where id = pg_temp.kc_game('B') and turn = 2$$), 1,
  'the Overlord runs a turn in another GM''s game');
select is(pg_temp.kc_writes($$update public.game_players set turn_report = '{"report":"turn 3"}', orders = null,
          orders_submitted = false where game_id = pg_temp.kc_game('B')$$), 1,
  'and sends its realms their reports');
-- conceding a realm, tidying dispatches, clearing the log
select is(pg_temp.kc_writes($$delete from public.game_players where game_id = pg_temp.kc_game('B') and player_index = 0$$), 1,
  'the Overlord removes a realm (concede)');
select is(pg_temp.kc_writes($$delete from public.game_messages where game_id = pg_temp.kc_game('A')::text$$), 3,
  'the Overlord deletes a game''s dispatches, private ones too');
select is(pg_temp.kc_writes($$delete from public.turn_logs where game_id = pg_temp.kc_game('A')$$), 3,
  'the Overlord clears a game''s turn log');
-- what the Overlord still can't do
select is(pg_temp.kc_writes($$insert into public.game_players (game_id, user_id, player_index, display_name)
          values (pg_temp.kc_game('S'), pg_temp.kc_uid('p3'), 1, 'Morrowgate')$$), 0,
  'the Overlord adds no realm for an account');
select is(pg_temp.kc_writes($$insert into public.games (name, gm_user_id, status, turn)
          values ('High Seat', pg_temp.kc_uid('gm'), 'setup', 0)$$), 0,
  'the Overlord creates no game, even in a GM''s name');
select is(pg_temp.kc_writes($$update public.games set gm_user_id = pg_temp.kc_uid('p1') where id = pg_temp.kc_game('B')$$), 0,
  'the Overlord can''t change a game''s GM by editing it');
select is(pg_temp.kc_writes($$update public.games set gm_user_id = auth.uid() where id = pg_temp.kc_game('B')$$), 0,
  'nor make themselves its GM');
select pg_temp.kc_as('gm');
select is(pg_temp.kc_writes($$update public.games set gm_user_id = pg_temp.kc_uid('gm2') where id = pg_temp.kc_game('A')$$), 0,
  'nor can a GM give their game away by editing it');

-- ── handing a game over ──────────────────────────────────────────────────────────────────────

select pg_temp.kc_as('anon');
select throws_ok($$select public.reassign_game(pg_temp.kc_game('A'), pg_temp.kc_uid('gm2'))$$,
  '42501', null, 'a signed-out visitor can''t hand a game over');
select pg_temp.kc_as('gm');
select throws_ok($$select public.reassign_game(pg_temp.kc_game('A'), pg_temp.kc_uid('gm2'))$$,
  'P0001', 'Only the Overlord can hand a game over.', 'the game''s own GM can''t hand it over');
select pg_temp.kc_as('p1');
select throws_ok($$select public.reassign_game(pg_temp.kc_game('A'), pg_temp.kc_uid('gm2'))$$,
  'P0001', 'Only the Overlord can hand a game over.', 'a player can''t hand a game over');

select pg_temp.kc_as('stranger');
select throws_ok($$select public.reassign_game(pg_temp.kc_game('A'), pg_temp.kc_uid('p1'))$$,
  'P0001', 'That account isn''t a Game Master.', 'a game goes only to a Game Master');
select throws_ok($$select public.reassign_game(pg_temp.kc_game('A'), pg_temp.kc_uid('p3'))$$,
  'P0001', 'That account isn''t a Game Master.', 'not to an account whose offer is still open');
select throws_ok($$select public.reassign_game(pg_temp.kc_game('A'), auth.uid())$$,
  'P0001', 'The Overlord doesn''t run games.', 'not to the Overlord');
select throws_ok($$select public.reassign_game('00000000-0000-4000-b000-0000000000ff', pg_temp.kc_uid('gm2'))$$,
  'P0001', 'No such game.', 'a game that doesn''t exist is refused');

select pg_temp.kc_as('postgres');
select is((select gm_user_id from public.games where id = pg_temp.kc_game('A')), pg_temp.kc_uid('gm'),
  'after the refusals, the game still has its own GM');
create temp table before_handover as select to_jsonb(g) - 'gm_user_id' as row from public.games g where id = pg_temp.kc_game('A');

select pg_temp.kc_as('stranger');
select lives_ok($$select public.reassign_game(pg_temp.kc_game('A'), pg_temp.kc_uid('gm2'))$$,
  'the Overlord hands a game to another Game Master');

select pg_temp.kc_as('postgres');
select is((select gm_user_id from public.games where id = pg_temp.kc_game('A')), pg_temp.kc_uid('gm2'),
  'the game has its new GM');
select is((select to_jsonb(g) - 'gm_user_id' from public.games g where id = pg_temp.kc_game('A')),
  (select row from before_handover), 'and nothing else about it changed');

select pg_temp.kc_as('gm');
select is(pg_temp.kc_writes($$update public.games set game_state = '{"world":"turn 4"}', turn = 4
          where id = pg_temp.kc_game('A') and turn = 3$$), 0,
  'the old GM can no longer save it');
select is(pg_temp.kc_count($$select id from public.game_players where game_id = pg_temp.kc_game('A')$$), 0,
  'nor read its realms');
select pg_temp.kc_as('gm2');
select is(pg_temp.kc_writes($$update public.games set game_state = '{"world":"turn 4"}', turn = 4
          where id = pg_temp.kc_game('A') and turn = 3$$), 1,
  'the new GM saves it');
select is(pg_temp.kc_count($$select id from public.game_players where game_id = pg_temp.kc_game('A')$$), 4,
  'and reads its realms');

-- ── revoking a GM once their games are handed over ───────────────────────────────────────────

select pg_temp.kc_as('stranger');
select throws_ok($$select public.gm_revoke(pg_temp.kc_uid('gm'))$$,
  'P0001', 'That Game Master runs an unfinished game: hand it over first.',
  'a GM with unfinished games can''t be revoked yet');
select public.reassign_game(pg_temp.kc_game('S'), pg_temp.kc_uid('gm2'));
select public.reassign_game(pg_temp.kc_game('P'), pg_temp.kc_uid('gm2'));
select lives_ok($$select public.gm_revoke(pg_temp.kc_uid('gm'))$$,
  'once every unfinished game is handed over, the GM is revoked');

-- ── deleting a game ──────────────────────────────────────────────────────────────────────────

select pg_temp.kc_as('stranger');
select is(pg_temp.kc_writes($$delete from public.games where id = pg_temp.kc_game('B')$$), 1,
  'the Overlord deletes another GM''s game');

select * from finish();
rollback;
