-- turn_logs: each realm's per-turn report snapshot, and the GM's full log (player_index -1).
--
-- What the game needs:
--   a player reads their own realm's snapshots (past turns in the Chronicle and on the map);
--   the GM writes the snapshots and the full log for their own game, reads them, and deletes them
--   with the game.
-- Also checked: nobody but the game's GM writes or deletes them.
begin;
\ir ../lib/world.psql
select plan(10);

-- ── what the game needs ──────────────────────────────────────────────────────────────────────

select pg_temp.kc_as('p1');
select is(pg_temp.kc_count($$select entries from public.turn_logs
          where game_id = pg_temp.kc_game('A') and player_index = 0$$), 1,
  'a player reads their own realm''s snapshot');

select pg_temp.kc_as('gm');
select is(pg_temp.kc_count($$select entries from public.turn_logs
          where game_id = pg_temp.kc_game('A') and player_index = -1$$), 1,
  'the GM reads their own game''s full log');
select is(pg_temp.kc_writes($$insert into public.turn_logs (game_id, player_index, turn, entries)
          values (pg_temp.kc_game('A'), 0, 3, '[]')$$), 1,
  'the GM writes a realm''s snapshot');
select is(pg_temp.kc_writes($$insert into public.turn_logs (game_id, player_index, turn, entries)
          values (pg_temp.kc_game('A'), -1, 3, '[]')$$), 1,
  'the GM writes the full log');
select is(pg_temp.kc_writes($$delete from public.turn_logs where game_id = pg_temp.kc_game('A')$$), 3,
  'the GM deletes their own game''s logs');

-- ── nobody else writes them ──────────────────────────────────────────────────────────────────

select pg_temp.kc_as('p1');
select is(pg_temp.kc_writes($$insert into public.turn_logs (game_id, player_index, turn, entries)
          values (pg_temp.kc_game('A'), 0, 3, '[]')$$), 0,
  'a player can''t write a snapshot');
select is(pg_temp.kc_writes($$update public.turn_logs set entries = '[{"text":"rewritten"}]'
          where game_id = pg_temp.kc_game('A') and player_index = 0$$), 0,
  'a player can''t rewrite their own snapshot');

select pg_temp.kc_as('gm2');
select is(pg_temp.kc_writes($$insert into public.turn_logs (game_id, player_index, turn, entries)
          values (pg_temp.kc_game('A'), -1, 3, '[]')$$), 0,
  'another GM can''t write the game''s logs');
select is(pg_temp.kc_writes($$delete from public.turn_logs where game_id = pg_temp.kc_game('A')$$), 0,
  'another GM can''t delete the game''s logs');

select pg_temp.kc_as('anon');
select is(pg_temp.kc_writes($$insert into public.turn_logs (game_id, player_index, turn, entries)
          values (pg_temp.kc_game('A'), 0, 3, '[]')$$), 0,
  'a signed-out visitor can''t write a log');

select * from finish();
rollback;
