-- game_records: the Hall of Fame, one row per finished game.
--
-- What the game needs:
--   everyone, signed in or not, reads the Hall of Fame;
--   the game's GM writes its record, edits its name, note and date, hides it, and removes it, also after
--   deleting the game (the record keeps its GM);
--   the Overlord edits and removes any record, and corrects a player's name on the board with
--   rename_player (P0-22, rulings D-09 and D-11): the name only, never blank.
-- Also checked: players, other GMs and signed-out visitors can't write it; nobody but the Overlord renames a
-- player.
begin;
\ir ../lib/world.psql
select plan(24);

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

select pg_temp.kc_as('postgres');
insert into public.game_records (game_id, game_name, gm_user_id) values
  ('00000000-0000-4000-b000-0000000000d1', 'Lost Vale', pg_temp.kc_uid('gm'));   -- its game was deleted
select pg_temp.kc_as('gm');
select is(pg_temp.kc_writes($$update public.game_records set note = 'Remembered'
          where game_id = '00000000-0000-4000-b000-0000000000d1'$$), 1,
  'the GM still edits their record after deleting the game');

-- ── other GMs, accounts that run no game, and visitors, can't write it ───────────────────────

select pg_temp.kc_as('gm2');
select is(pg_temp.kc_writes($$update public.game_records set note = 'Defaced'
          where game_id = pg_temp.kc_game('C')::text$$), 0,
  'another GM can''t edit the game''s record');
select is(pg_temp.kc_writes($$delete from public.game_records where game_id = pg_temp.kc_game('C')::text$$), 0,
  'another GM can''t remove the game''s record');
select is(pg_temp.kc_writes($$insert into public.game_records (game_id, game_name)
          values (pg_temp.kc_game('A')::text, 'Not mine')$$), 0,
  'another GM can''t write a record for a game they don''t run');
select is(pg_temp.kc_writes($$insert into public.game_records (game_id, game_name, gm_user_id)
          values (pg_temp.kc_game('A')::text, 'Not mine', auth.uid())$$), 0,
  'not even in their own name');
select is(pg_temp.kc_writes($$update public.game_records set note = 'Defaced'
          where game_id = '00000000-0000-4000-b000-0000000000d1'$$), 0,
  'nor edit another GM''s record of a deleted game');

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

-- ── the Overlord (stranger, in no game) ─────────────────────────────────────────────────────

select pg_temp.kc_as('postgres');
select is(public.kc_set_overlord('stranger@example.test', false), 'Overlord set', 'stranger is the Overlord');
select pg_temp.kc_as('stranger');
select is(pg_temp.kc_writes($$update public.game_records set hidden = true
          where game_id = pg_temp.kc_game('C')::text$$), 1,
  'the Overlord hides any game''s record');
select is(pg_temp.kc_writes($$delete from public.game_records where game_id = '00000000-0000-4000-b000-0000000000d1'$$), 1,
  'and removes one');
select lives_ok($$select public.rename_player(pg_temp.kc_uid('p1'), '  Ada of the Ford  ')$$,
  'the Overlord renames a player');
select pg_temp.kc_as('postgres');
select is((select name from public.profiles where id = pg_temp.kc_uid('p1')), 'Ada of the Ford',
  'the new name is saved, trimmed');
select is((select email from public.profiles where id = pg_temp.kc_uid('p1')), 'p1@example.test',
  'and nothing else changes');
select pg_temp.kc_as('stranger');
select throws_ok($$select public.rename_player(pg_temp.kc_uid('p1'), '   ')$$, 'P0001', null,
  'a blank name is refused');

select pg_temp.kc_as('gm');
select throws_ok($$select public.rename_player(pg_temp.kc_uid('p1'), 'Renamed')$$, 'P0001', null,
  'a GM can''t rename a player');
select pg_temp.kc_as('anon');
select throws_ok($$select public.rename_player(pg_temp.kc_uid('p1'), 'Renamed')$$, '42501', null,
  'a signed-out visitor can''t call rename_player');

select * from finish();
rollback;
