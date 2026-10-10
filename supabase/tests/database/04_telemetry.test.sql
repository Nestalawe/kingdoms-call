-- turn_events and game_results: the statistics the GM portal records each turn and at game over.
-- Their game_id is text with no foreign key.
--
-- What the game needs:
--   the GM writes, reads and deletes the statistics of their own games (runTurn's telemetry, the
--   Stats tab, the Hall of Fame builder, deleteGame).
-- Also checked: signed-out visitors neither read nor write them.
begin;
\ir ../lib/world.psql
select plan(10);

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
