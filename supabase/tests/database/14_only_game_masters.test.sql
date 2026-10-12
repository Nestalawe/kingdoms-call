-- Only Game Masters create games; the Overlord neither creates games nor plays (plan step P0-32d, decision D-13).
--
-- What the game needs:
--   a Game Master creates a game as its GM, and still runs the games they have (save, add a bot realm);
--   any account that isn't the Overlord still joins an open game as itself.
-- Also checked: an account that isn't a Game Master can't create a game, nor can one whose offer is still open;
-- the Overlord can't create a game, join one, or take a realm by editing a slot.
begin;
\ir ../lib/world.psql
select plan(12);

-- The Overlord is stranger (in no game). p3 has an open offer. gm and gm2 are Game Masters (world.psql).
select pg_temp.kc_as('postgres');
select is(public.kc_set_overlord('stranger@example.test', false), 'Overlord set', 'stranger is the Overlord');
insert into public.game_masters (user_id, offered_at, offered_by, accepted_at)
  values (pg_temp.kc_uid('p3'), now(), pg_temp.kc_uid('stranger'), null);

-- ── what the game needs ──────────────────────────────────────────────────────────────────────

select pg_temp.kc_as('gm');
select is(pg_temp.kc_writes($$insert into public.games (name, gm_user_id, status, turn)
          values ('Saltmarsh', auth.uid(), 'setup', 0)$$), 1,
  'a Game Master creates a game as its GM');
select is(pg_temp.kc_writes($$update public.games set game_state = '{"world":"turn 4"}', turn = 4
          where id = pg_temp.kc_game('A') and turn = 3$$), 1,
  'a Game Master still saves their running game');
select is(pg_temp.kc_writes($$insert into public.game_players (game_id, user_id, player_index, display_name, turn_report)
          values (pg_temp.kc_game('S'), null, 1, 'Ironhold', '{"isBot":true}')$$), 1,
  'a Game Master still adds a bot realm to their game');

select pg_temp.kc_as('invitee');
select is(pg_temp.kc_writes($$insert into public.game_players (game_id, user_id, player_index, display_name)
          values (pg_temp.kc_game('P'), auth.uid(), 0, 'Lunehall')$$), 1,
  'an account that isn''t the Overlord still joins a game as itself');

-- ── only Game Masters create games ───────────────────────────────────────────────────────────

select pg_temp.kc_as('p1');
select is(pg_temp.kc_writes($$insert into public.games (name, gm_user_id, status, turn)
          values ('Thornfield', auth.uid(), 'setup', 0)$$), 0,
  'a player who isn''t a Game Master can''t create a game');

select pg_temp.kc_as('p3');
select is(pg_temp.kc_writes($$insert into public.games (name, gm_user_id, status, turn)
          values ('Morrow Fen', auth.uid(), 'setup', 0)$$), 0,
  'an account whose offer is still open can''t create a game');

-- ── the Overlord neither creates games nor plays ─────────────────────────────────────────────

select pg_temp.kc_as('stranger');
select is(pg_temp.kc_writes($$insert into public.games (name, gm_user_id, status, turn)
          values ('High Seat', auth.uid(), 'setup', 0)$$), 0,
  'the Overlord can''t create a game');
select is(pg_temp.kc_writes($$insert into public.game_players (game_id, user_id, player_index, display_name)
          values (pg_temp.kc_game('S'), auth.uid(), 0, 'Ashby Hold')$$), 0,
  'the Overlord can''t join a game');

-- Even made a Game Master by hand (the functions refuse it), the Overlord still can't create one.
select pg_temp.kc_as('postgres');
insert into public.game_masters (user_id, offered_at, offered_by, accepted_at)
  values (pg_temp.kc_uid('stranger'), now(), null, now());
select pg_temp.kc_as('stranger');
select is(pg_temp.kc_writes($$insert into public.games (name, gm_user_id, status, turn)
          values ('High Seat', auth.uid(), 'setup', 0)$$), 0,
  'the Overlord can''t create a game even with a Game Master row');

-- A slot the Overlord could reach by editing (as the game's GM, staged by hand) can't be made theirs.
select pg_temp.kc_as('postgres');
update public.games set gm_user_id = pg_temp.kc_uid('stranger') where id = pg_temp.kc_game('S');
insert into public.game_players (game_id, user_id, player_index, display_name)
  values (pg_temp.kc_game('S'), null, 2, 'Emptyhold');
select pg_temp.kc_as('stranger');
select is(pg_temp.kc_writes($$update public.game_players set user_id = auth.uid()
          where game_id = pg_temp.kc_game('S') and player_index = 2$$), 0,
  'the Overlord can''t take a realm by editing a slot');
select is(pg_temp.kc_writes($$insert into public.game_players (game_id, user_id, player_index, display_name)
          values (pg_temp.kc_game('S'), null, 3, 'Botmarch')$$), 1,
  'but a bot realm (no account) can still be added there');

select * from finish();
rollback;
