-- games: who can see and change a game.
--
-- What the game needs:
--   the GM creates, reads, saves (the conditional turn save), archives and deletes their own games;
--   a player reads the games they're in (name, turn, status, meta: My Games and the report screen);
--   any signed-in account lists open public games, and an invited one sees a private game in setup, whether its
--   settings are saved as text (as the portals write them) or as an object;
--   the Overlord sees every game.
-- Also checked: a running or finished game is seen only by its GM, its players and the Overlord, and a private game
-- in setup only by its GM and the accounts it invites (P2-16, ruling D-10).
-- Also checked: nobody but the game's GM changes or deletes it, a game is created only in its creator's
-- own name, and a game is never handed to another account by editing it.
begin;
\ir ../lib/world.psql
select plan(29);

-- ── what the game needs ──────────────────────────────────────────────────────────────────────

select pg_temp.kc_as('gm');
select is(pg_temp.kc_writes($$insert into public.games (name, gm_user_id, status, turn)
          values ('Saltmarsh', auth.uid(), 'setup', 0)$$), 1,
  'the GM creates a game as its GM');
select is(pg_temp.kc_count($$select game_state from public.games
          where id = pg_temp.kc_game('A') and game_state is not null$$), 1,
  'the GM reads their own game''s world');
select is(pg_temp.kc_writes($$update public.games set game_state = '{"world":"turn 4"}', turn = 4
          where id = pg_temp.kc_game('A') and turn = 3$$), 1,
  'the GM saves their own game (the conditional turn save)');
select is(pg_temp.kc_writes($$update public.games set game_state = '{"archived":true}', meta = '{"archived":true}'
          where id = pg_temp.kc_game('C')$$), 1,
  'the GM archives their own game');
select is(pg_temp.kc_writes($$delete from public.games where id = pg_temp.kc_game('S')$$), 1,
  'the GM deletes their own game');

select pg_temp.kc_as('p1');
select is(pg_temp.kc_count($$select id, name, turn, status, meta from public.games
          where id in (pg_temp.kc_game('A'), pg_temp.kc_game('C'))$$), 2,
  'a player reads the games they''re in, running or finished');

select pg_temp.kc_as('stranger');
select is(pg_temp.kc_count($$select id, name, max_players from public.games
          where id = pg_temp.kc_game('S')$$), 1,
  'any signed-in account sees an open public game');

select pg_temp.kc_as('invitee');
select is(pg_temp.kc_count($$select id, name from public.games where id = pg_temp.kc_game('P')$$), 1,
  'an invited account sees the private game it''s invited to');

-- ── nobody else changes a game ───────────────────────────────────────────────────────────────

select pg_temp.kc_as('p1');
select is(pg_temp.kc_writes($$update public.games set turn = 99 where id = pg_temp.kc_game('A')$$), 0,
  'a player can''t change their game');
select is(pg_temp.kc_writes($$update public.games set gm_user_id = auth.uid() where id = pg_temp.kc_game('A')$$), 0,
  'a player can''t make themselves GM of their game');

select pg_temp.kc_as('gm2');
select is(pg_temp.kc_writes($$update public.games set name = 'Renamed' where id = pg_temp.kc_game('A')$$), 0,
  'another GM can''t change the game');

select pg_temp.kc_as('stranger');
select is(pg_temp.kc_writes($$update public.games set status = 'complete'$$), 0,
  'an account in no game can''t change any game');
select is(pg_temp.kc_writes($$insert into public.games (name, gm_user_id) values ('Forged', pg_temp.kc_uid('gm'))$$), 0,
  'an account can''t create a game in another account''s name');

select pg_temp.kc_as('anon');
select is(pg_temp.kc_count($$select id from public.games$$), 0,
  'a signed-out visitor sees no game');
select is(pg_temp.kc_writes($$update public.games set status = 'complete'$$), 0,
  'a signed-out visitor can''t change any game');
select is(pg_temp.kc_writes($$insert into public.games (name) values ('Nobody''s game')$$), 0,
  'a signed-out visitor can''t create a game');

select pg_temp.kc_as('gm');
select is(pg_temp.kc_writes($$update public.games set gm_user_id = pg_temp.kc_uid('gm2') where id = pg_temp.kc_game('A')$$), 0,
  'the GM can''t hand their game to another account by editing it');

-- ── nobody else deletes a game ───────────────────────────────────────────────────────────────

select pg_temp.kc_as('p2');
select is(pg_temp.kc_writes($$delete from public.games where id = pg_temp.kc_game('A')$$), 0,
  'a player can''t delete their game');

select pg_temp.kc_as('gm2');
select is(pg_temp.kc_writes($$delete from public.games where id = pg_temp.kc_game('A')$$), 0,
  'another GM can''t delete the game');

select pg_temp.kc_as('anon');
select is(pg_temp.kc_writes($$delete from public.games$$), 0,
  'a signed-out visitor can''t delete a game');

-- ── who sees a game ──────────────────────────────────────────────────────────────────────────

select pg_temp.kc_as('p3');
select is(pg_temp.kc_count($$select id from public.games where id = pg_temp.kc_game('A')$$), 0,
  'a player in another game doesn''t see a running game');

select pg_temp.kc_as('gm2');
select is(pg_temp.kc_count($$select id from public.games where id = pg_temp.kc_game('A')$$), 0,
  'another GM doesn''t see a running game');

select pg_temp.kc_as('stranger');
select is(pg_temp.kc_count($$select id from public.games where status <> 'setup'$$), 0,
  'an account in no game sees no running or finished game');
select is(pg_temp.kc_count($$select id from public.games where id = pg_temp.kc_game('P')$$), 0,
  'an account that isn''t invited doesn''t see a private game in setup');

-- the portals save a game's settings as JSON text
select pg_temp.kc_as('postgres');
update public.games set game_state = to_jsonb(game_state::text) where id in (pg_temp.kc_game('S'), pg_temp.kc_game('P'));

select pg_temp.kc_as('invitee');
select is(pg_temp.kc_count($$select id from public.games where id = pg_temp.kc_game('P')$$), 1,
  'an invited account sees the private game, its settings saved as text');

select pg_temp.kc_as('stranger');
select is(pg_temp.kc_count($$select id from public.games where id = pg_temp.kc_game('P')$$), 0,
  'an account that isn''t invited doesn''t see it');
select is(pg_temp.kc_count($$select id from public.games where id = pg_temp.kc_game('S')$$), 1,
  'any signed-in account sees an open public game, its settings saved as text');

select pg_temp.kc_as('postgres');
select is(public.kc_set_overlord('stranger@example.test', false), 'Overlord set', 'stranger is the Overlord');
select pg_temp.kc_as('stranger');
select is(pg_temp.kc_count($$select id from public.games$$), 5,
  'the Overlord sees every game');

select * from finish();
rollback;
