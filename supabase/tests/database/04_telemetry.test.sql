-- turn_events and game_results: the statistics the GM portal records each turn and at game over.
-- Their game_id is text with no foreign key.
--
-- What the game needs:
--   the GM writes, reads and deletes the statistics of their own games (runTurn's telemetry, the
--   Stats tab, the Hall of Fame builder, deleteGame);
--   the Overlord reads and clears every game's statistics (P0-22, ruling D-09), deleted games' included.
-- Also checked: players, other GMs and signed-out visitors neither read nor write them; once a game is
-- deleted, its leftover statistics are the Overlord's to clear.
begin;
\ir ../lib/world.psql
select plan(23);

-- ── what the game needs ──────────────────────────────────────────────────────────────────────

select pg_temp.kc_as('gm');
select is(pg_temp.kc_writes($$insert into public.turn_events (game_id, turn, player_index, realm)
          values (pg_temp.kc_game('A')::text, 3, 0, 'Thornmere')$$), 1,
  'the GM records a turn of their own game');
select is(pg_temp.kc_writes($$update public.turn_events set realm = realm
          where game_id = pg_temp.kc_game('A')::text$$), 2,
  'the GM re-records turns of their own game (the upsert)');
select is(pg_temp.kc_count($$select orders from public.turn_events
          where game_id = pg_temp.kc_game('A')::text$$), 2,
  'the GM reads their own game''s recorded turns');
select is(pg_temp.kc_writes($$insert into public.game_results (game_id, player_index, realm)
          values (pg_temp.kc_game('A')::text, 0, 'Thornmere')$$), 1,
  'the GM records the results of their own game');
select is(pg_temp.kc_count($$select rank from public.game_results
          where game_id = pg_temp.kc_game('C')::text$$), 1,
  'the GM reads their own game''s results');
select is(pg_temp.kc_writes($$delete from public.turn_events where game_id = pg_temp.kc_game('A')::text$$), 2,
  'the GM deletes their own game''s recorded turns');
select is(pg_temp.kc_writes($$delete from public.game_results where game_id = pg_temp.kc_game('C')::text$$), 1,
  'the GM deletes their own game''s results');

-- ── nobody else reads or writes them (P0-22) ─────────────────────────────────────────────────

select pg_temp.kc_as('postgres');
insert into public.turn_events (game_id, turn, player_index, realm) values
  ('00000000-0000-4000-b000-0000000000d1', 4, 0, 'Lost Realm');      -- a deleted game: no games row
insert into public.game_results (game_id, player_index, realm) values
  ('00000000-0000-4000-b000-0000000000d1', 0, 'Lost Realm');

select pg_temp.kc_as('p1');
select is(pg_temp.kc_count($$select orders from public.turn_events
          where game_id = pg_temp.kc_game('A')::text$$), 0,
  'a player can''t read the recorded turns of their game');
select is(pg_temp.kc_count($$select rank from public.game_results$$), 0,
  'a player can''t read the results rows');
select is(pg_temp.kc_writes($$insert into public.turn_events (game_id, turn, player_index)
          values (pg_temp.kc_game('A')::text, 3, 1)$$), 0,
  'a player can''t record a turn');
select is(pg_temp.kc_writes($$delete from public.turn_events where game_id = pg_temp.kc_game('A')::text$$), 0,
  'a player can''t delete recorded turns');

select pg_temp.kc_as('gm2');
select is(pg_temp.kc_count($$select orders from public.turn_events
          where game_id = pg_temp.kc_game('A')::text$$), 0,
  'another GM can''t read the game''s recorded turns');
select is(pg_temp.kc_writes($$delete from public.turn_events where game_id = pg_temp.kc_game('A')::text$$), 0,
  'another GM can''t delete the game''s recorded turns');
select is(pg_temp.kc_writes($$delete from public.game_results where game_id = pg_temp.kc_game('C')::text$$), 0,
  'another GM can''t delete the game''s results');

select pg_temp.kc_as('stranger');
select is(pg_temp.kc_writes($$insert into public.game_results (game_id, player_index)
          values (pg_temp.kc_game('A')::text, 1)$$), 0,
  'an account in no game can''t record results');

select pg_temp.kc_as('gm');
select is(pg_temp.kc_count($$select id from public.turn_events where game_id = '00000000-0000-4000-b000-0000000000d1'$$), 0,
  'a deleted game''s leftover statistics aren''t any GM''s');

-- ── the Overlord (stranger, in no game) ─────────────────────────────────────────────────────

select pg_temp.kc_as('postgres');
select is(public.kc_set_overlord('stranger@example.test', false), 'Overlord set', 'stranger is the Overlord');
select pg_temp.kc_as('stranger');
select is(pg_temp.kc_count($$select orders from public.turn_events
          where game_id in (pg_temp.kc_game('A')::text, '00000000-0000-4000-b000-0000000000d1')$$), 3,
  'the Overlord reads any game''s recorded turns, a deleted game''s included');
select is(pg_temp.kc_count($$select rank from public.game_results where game_id = pg_temp.kc_game('C')::text$$), 1,
  'and any game''s results');
select is(pg_temp.kc_writes($$delete from public.game_results where game_id = '00000000-0000-4000-b000-0000000000d1'$$), 1,
  'and clears a deleted game''s leftovers');

-- ── signed-out visitors get nothing ──────────────────────────────────────────────────────────

select pg_temp.kc_as('anon');
select is(pg_temp.kc_count($$select id from public.turn_events$$), 0,
  'a signed-out visitor can''t read recorded turns');
select is(pg_temp.kc_count($$select id from public.game_results$$), 0,
  'a signed-out visitor can''t read results');
select is(pg_temp.kc_writes($$insert into public.turn_events (game_id, turn, player_index)
          values (pg_temp.kc_game('A')::text, 3, 1)$$), 0,
  'a signed-out visitor can''t record a turn');

select * from finish();
rollback;
