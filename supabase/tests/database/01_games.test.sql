-- games: who can see and change a game.
--
-- What the game needs:
--   the GM creates, reads, saves (the conditional turn save), archives and deletes their own games;
--   a player reads the games they're in (name, turn, status, meta: My Games and the report screen);
--   any signed-in account lists open public games, and an invited one sees a private game in setup.
-- Also checked: nobody but the game's GM deletes it.
begin;
\ir ../lib/world.psql
select plan(11);

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

select * from finish();
rollback;
