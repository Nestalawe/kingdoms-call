-- game_records: the Hall of Fame, one row per finished game.
--
-- What the game needs:
--   everyone, signed in or not, reads the Hall of Fame;
--   the game's GM writes its record, edits its name, note and date, hides it, and removes it.
-- Also checked: accounts that run no game, and signed-out visitors, can't write it.
begin;
\ir ../lib/world.psql
select plan(9);

-- ── what the game needs ──────────────────────────────────────────────────────────────────────

select pg_temp.kc_as('anon');
select is(pg_temp.kc_count($$select * from public.game_records$$), 1,
  'a signed-out visitor reads the Hall of Fame');

select pg_temp.kc_as('p3');
select is(pg_temp.kc_count($$select * from public.game_records$$), 1,
  'a signed-in account reads the Hall of Fame');

select pg_temp.kc_as('gm');
select is(pg_temp.kc_writes($$insert into public.game_records (game_id, game_name, gm_user_id)
          values (pg_temp.kc_game('A')::text, 'Marchwood', auth.uid())$$), 1,
  'the GM writes the record of their own game');
select is(pg_temp.kc_writes($$update public.game_records set note = 'A long winter', hidden = true
          where game_id = pg_temp.kc_game('C')::text$$), 1,
  'the GM edits and hides their own game''s record');
select is(pg_temp.kc_writes($$delete from public.game_records where game_id = pg_temp.kc_game('C')::text$$), 1,
  'the GM removes their own game''s record');

-- ── accounts that run no game, and visitors, can't write it ──────────────────────────────────

select pg_temp.kc_as('p1');
select is(pg_temp.kc_writes($$update public.game_records set winner_realm = 'Forged'
          where game_id = pg_temp.kc_game('C')::text$$), 0,
  'a player can''t edit a record, even of a game they won');
select is(pg_temp.kc_writes($$insert into public.game_records (game_id, game_name)
          values (pg_temp.kc_game('A')::text, 'Forged')$$), 0,
  'a player can''t write a record');

select pg_temp.kc_as('anon');
select is(pg_temp.kc_writes($$update public.game_records set hidden = true$$), 0,
  'a signed-out visitor can''t edit a record');
select is(pg_temp.kc_writes($$delete from public.game_records$$), 0,
  'a signed-out visitor can''t remove a record');

select * from finish();
rollback;
