-- game_players: a realm's slot (who plays it, their orders, their latest report).
--
-- What the game needs:
--   a player reads their own slot in full, and saves, submits and revises their own orders;
--   a signed-in account joins an open game (or a private one it's invited to) as itself;
--   the GM reads every slot of their own game, writes the reports, clears orders, adds bot realms and
--   removes a realm.
-- Also checked: nobody changes another realm's slot or puts another account into a game, and only
-- the game's GM adds or removes realms.
begin;
\ir ../lib/world.psql
select plan(16);

-- ── what the game needs ──────────────────────────────────────────────────────────────────────

select pg_temp.kc_as('p1');
select is(pg_temp.kc_count($$select orders, turn_report from public.game_players
          where game_id = pg_temp.kc_game('A') and user_id = auth.uid()$$), 1,
  'a player reads their own slot, orders and report');
select is(pg_temp.kc_writes($$update public.game_players set orders = '{"orders":"draft"}', orders_submitted = false
          where game_id = pg_temp.kc_game('A') and user_id = auth.uid()$$), 1,
  'a player saves a draft of their orders');
select is(pg_temp.kc_writes($$update public.game_players
          set orders = '{"orders":"final"}', orders_submitted = true, last_submitted_at = now()
          where game_id = pg_temp.kc_game('A') and user_id = auth.uid()$$), 1,
  'a player submits their orders');

select pg_temp.kc_as('stranger');
select is(pg_temp.kc_writes($$insert into public.game_players (game_id, user_id, player_index, display_name, turn_report)
          values (pg_temp.kc_game('S'), auth.uid(), 0, 'Ashby Hold', '{"status":"joined"}')$$), 1,
  'a signed-in account joins an open public game as itself');

select pg_temp.kc_as('invitee');
select is(pg_temp.kc_writes($$insert into public.game_players (game_id, user_id, player_index, display_name)
          values (pg_temp.kc_game('P'), auth.uid(), 0, 'Lunehall')$$), 1,
  'an invited account joins the private game');

select pg_temp.kc_as('gm');
select is(pg_temp.kc_count($$select orders, turn_report from public.game_players
          where game_id = pg_temp.kc_game('A')$$), 4,
  'the GM reads every slot of their own game');
select is(pg_temp.kc_writes($$update public.game_players
          set turn_report = '{"report":"turn 4"}', orders = null, orders_submitted = false
          where game_id = pg_temp.kc_game('A')$$), 4,
  'the GM writes every realm''s report and clears the orders');
select is(pg_temp.kc_writes($$insert into public.game_players (game_id, user_id, player_index, display_name, turn_report)
          values (pg_temp.kc_game('S'), null, 1, 'Ironhold', '{"isBot":true}')$$), 1,
  'the GM adds a bot realm to their own game');
select is(pg_temp.kc_writes($$delete from public.game_players
          where game_id = pg_temp.kc_game('A') and player_index = 3$$), 1,
  'the GM removes a realm from their own game');

-- ── nobody changes another realm's slot ──────────────────────────────────────────────────────

select pg_temp.kc_as('p2');
select is(pg_temp.kc_writes($$update public.game_players set orders = '{"orders":"forged"}'
          where game_id = pg_temp.kc_game('A') and player_index = 0$$), 0,
  'a rival can''t write another realm''s orders');
select is(pg_temp.kc_writes($$insert into public.game_players (game_id, user_id, player_index, display_name)
          values (pg_temp.kc_game('S'), pg_temp.kc_uid('p3'), 1, 'Pressed')$$), 0,
  'a player can''t put another account into a game');
select is(pg_temp.kc_writes($$delete from public.game_players where game_id = pg_temp.kc_game('A')$$), 0,
  'a player can''t remove any realm, their own included');

select pg_temp.kc_as('gm2');
select is(pg_temp.kc_writes($$update public.game_players set turn_report = '{}'
          where game_id = pg_temp.kc_game('A')$$), 0,
  'another GM can''t write the game''s slots');
select is(pg_temp.kc_writes($$insert into public.game_players (game_id, user_id, player_index, display_name)
          values (pg_temp.kc_game('A'), null, 5, 'Interloper')$$), 0,
  'another GM can''t add a realm to the game');
select is(pg_temp.kc_writes($$delete from public.game_players where game_id = pg_temp.kc_game('A')$$), 0,
  'another GM can''t remove the game''s realms');

select pg_temp.kc_as('anon');
select is(pg_temp.kc_writes($$insert into public.game_players (game_id, user_id, player_index, display_name)
          values (pg_temp.kc_game('S'), null, 1, 'Nobody')$$), 0,
  'a signed-out visitor can''t join a game');

select * from finish();
rollback;
