-- Revoked GMs keep nothing (plan step P0-32i, ruling R-097): every GM write rule needs "the game's GM while still a
-- Game Master, or the Overlord". gm_revoke insists a GM's unfinished games are handed over first, so this only stops a
-- revoked GM changing or deleting their finished games and what goes with them.
--
-- What the game needs:
--   a current Game Master still runs their games: saves, adds and changes realms, removes one, writes the turn log,
--   tidies dispatches, writes statistics and Hall of Fame records, deletes a game;
--   players still join a game and send their orders;
--   the Overlord still does all of it on any game.
-- Also checked: a revoked GM can't change, archive or delete their finished game, its realms, turn log, dispatches,
-- statistics or Hall of Fame record (nor a record of a game since deleted), but still reads their game.
begin;
\ir ../lib/world.psql
select plan(38);

create function pg_temp.kc_g(k text) returns uuid language sql immutable as $$
  select (case k when 'C2' then '00000000-0000-4000-b000-0000000000c2'
                 when 'gone' then '00000000-0000-4000-b000-0000000000d0' end)::uuid $$;

-- The Overlord is stranger. gm also ran Cinder Hold (complete, no record yet). A record names gm for a game since
-- deleted. Ashen Reach (C, complete) gets a turn log, a dispatch and statistics.
select pg_temp.kc_as('postgres');
select is(public.kc_set_overlord('stranger@example.test', false), 'Overlord set', 'stranger is the Overlord');
insert into public.games (id, name, gm_user_id, status, turn) values (pg_temp.kc_g('C2'), 'Cinder Hold', pg_temp.kc_uid('gm'), 'complete', 7);
insert into public.game_records (game_id, game_name, gm_user_id, winner_realm)
  values (pg_temp.kc_g('gone')::text, 'Lost Vale', pg_temp.kc_uid('gm'), 'Emberfast');
insert into public.turn_logs (game_id, player_index, turn, entries) values (pg_temp.kc_game('C'), -1, 8, '[{"text":"the last log"}]');
insert into public.turn_events (game_id, turn, player_index, realm, orders)
  values (pg_temp.kc_game('C')::text, 8, 0, 'Thornmere', '{"orders":"p1 turn 8"}');
insert into public.game_messages (game_id, turn, from_index, from_user_id, to_indexes, scope, body)
  values (pg_temp.kc_game('C')::text, 9, 0, pg_temp.kc_uid('p1'), '{}', 'public', 'Good game, all.');

-- gm is revoked: the Overlord hands their unfinished games to gm2 first, as gm_revoke insists.
select pg_temp.kc_as('stranger');
select public.reassign_game(pg_temp.kc_game(k), pg_temp.kc_uid('gm2')) from unnest(array['A','S','P']) k;
select lives_ok($$select public.gm_revoke(pg_temp.kc_uid('gm'))$$, 'gm is revoked once their unfinished games are handed over');

-- ── a revoked GM keeps nothing ───────────────────────────────────────────────────────────────

select pg_temp.kc_as('gm');
select is(pg_temp.kc_writes($$update public.games set game_state = '{"archived":true}' where id = pg_temp.kc_game('C')$$), 0,
  'a revoked GM can''t change or archive their finished game');
select is(pg_temp.kc_writes($$delete from public.games where id = pg_temp.kc_game('C')$$), 0, 'nor delete it');
select is(pg_temp.kc_writes($$insert into public.game_players (game_id, user_id, player_index, display_name, turn_report)
          values (pg_temp.kc_game('C'), null, 2, 'Ironhold', '{"isBot":true}')$$), 0, 'nor add a realm to it');
select is(pg_temp.kc_writes($$update public.game_players set turn_report = '{"report":"rewritten"}' where game_id = pg_temp.kc_game('C')$$), 0,
  'nor change its realms');
select is(pg_temp.kc_writes($$delete from public.game_players where game_id = pg_temp.kc_game('C')$$), 0, 'nor remove them');
select is(pg_temp.kc_writes($$insert into public.turn_logs (game_id, player_index, turn, entries) values (pg_temp.kc_game('C'), -1, 9, '[]')$$), 0,
  'nor write its turn log');
select is(pg_temp.kc_writes($$update public.turn_logs set entries = '[]' where game_id = pg_temp.kc_game('C')$$), 0, 'nor change it');
select is(pg_temp.kc_writes($$delete from public.turn_logs where game_id = pg_temp.kc_game('C')$$), 0, 'nor delete it');
select is(pg_temp.kc_writes($$delete from public.game_messages where game_id = pg_temp.kc_game('C')::text$$), 0, 'nor delete its dispatches');
select is(pg_temp.kc_writes($$insert into public.turn_events (game_id, turn, player_index, realm, orders)
          values (pg_temp.kc_game('C')::text, 9, 0, 'Thornmere', '{}')$$), 0, 'nor write its statistics');
select is(pg_temp.kc_writes($$update public.turn_events set realm = 'Renamed' where game_id = pg_temp.kc_game('C')::text$$), 0, 'nor change them');
select is(pg_temp.kc_writes($$delete from public.turn_events where game_id = pg_temp.kc_game('C')::text$$), 0, 'nor delete them');
select is(pg_temp.kc_writes($$insert into public.game_results (game_id, game_name, player_index, realm, rank, winner)
          values (pg_temp.kc_g('C2')::text, 'Cinder Hold', 0, 'Emberfast', 1, true)$$), 0, 'nor write its results');
select is(pg_temp.kc_writes($$update public.game_results set rank = 2 where game_id = pg_temp.kc_game('C')::text$$), 0, 'nor change them');
select is(pg_temp.kc_writes($$delete from public.game_results where game_id = pg_temp.kc_game('C')::text$$), 0, 'nor delete them');
select is(pg_temp.kc_writes($$insert into public.game_records (game_id, game_name, gm_user_id, winner_realm)
          values (pg_temp.kc_g('C2')::text, 'Cinder Hold', auth.uid(), 'Emberfast')$$), 0, 'nor record it in the Hall of Fame');
select is(pg_temp.kc_writes($$update public.game_records set hidden = true where game_id = pg_temp.kc_game('C')::text$$), 0,
  'nor change its Hall of Fame record');
select is(pg_temp.kc_writes($$delete from public.game_records where game_id = pg_temp.kc_game('C')::text$$), 0, 'nor remove it');
select is(pg_temp.kc_writes($$update public.game_records set hidden = true where game_id = pg_temp.kc_g('gone')::text$$), 0,
  'nor change the record of a game since deleted');
select is(pg_temp.kc_count($$select id from public.games where id = pg_temp.kc_game('C')$$), 1, 'but they still read their game');

-- ── what the game needs: current Game Masters, players and the Overlord are unaffected ───────

select pg_temp.kc_as('gm2');
select is(pg_temp.kc_writes($$update public.games set game_state = '{"world":"turn 3"}', turn = 3 where id = pg_temp.kc_game('B') and turn = 2$$), 1,
  'a Game Master still saves their game');
select is(pg_temp.kc_writes($$update public.games set game_state = '{"world":"turn 4"}', turn = 4 where id = pg_temp.kc_game('A') and turn = 3$$), 1,
  'and the game handed to them');
select is(pg_temp.kc_writes($$insert into public.game_players (game_id, user_id, player_index, display_name, turn_report)
          values (pg_temp.kc_game('B'), null, 1, 'Ironhold', '{"isBot":true}')$$), 1, 'still adds a bot realm');
select is(pg_temp.kc_writes($$update public.game_players set orders = null, orders_submitted = false where game_id = pg_temp.kc_game('B')$$), 1,
  'still changes their game''s realms');
select is(pg_temp.kc_writes($$delete from public.game_players where game_id = pg_temp.kc_game('B') and player_index = 0$$), 1,
  'still removes a realm (concede)');
select is(pg_temp.kc_writes($$insert into public.turn_logs (game_id, player_index, turn, entries) values (pg_temp.kc_game('B'), -1, 2, '[]')$$), 1,
  'still writes the turn log');
select is(pg_temp.kc_writes($$delete from public.game_messages where game_id = pg_temp.kc_game('B')::text$$), 1, 'still tidies a dispatch');
select is(pg_temp.kc_writes($$insert into public.turn_events (game_id, turn, player_index, realm, orders)
          values (pg_temp.kc_game('B')::text, 2, 0, 'Morrowgate', '{}')$$), 1, 'still writes statistics');
select is(pg_temp.kc_writes($$insert into public.game_results (game_id, game_name, player_index, realm, rank, winner)
          values (pg_temp.kc_game('B')::text, 'Fenmoor', 0, 'Morrowgate', 1, true)$$), 1, 'still writes results');
select is(pg_temp.kc_writes($$insert into public.game_records (game_id, game_name, gm_user_id, winner_realm)
          values (pg_temp.kc_game('B')::text, 'Fenmoor', auth.uid(), 'Morrowgate')$$), 1, 'still records a game in the Hall of Fame');
select is(pg_temp.kc_writes($$delete from public.games where id = pg_temp.kc_game('B')$$), 1, 'still deletes their game');

select pg_temp.kc_as('p1');
select is(pg_temp.kc_writes($$update public.game_players set orders = '{"orders":"hold the ford"}', orders_submitted = true
          where game_id = pg_temp.kc_game('A') and user_id = auth.uid()$$), 1, 'a player still sends their orders');
select pg_temp.kc_as('invitee');
select is(pg_temp.kc_writes($$insert into public.game_players (game_id, user_id, player_index, display_name)
          values (pg_temp.kc_game('P'), auth.uid(), 0, 'Lunehall')$$), 1, 'an invited player still joins a game');

select pg_temp.kc_as('stranger');
select is(pg_temp.kc_writes($$update public.games set game_state = '{"archived":true}' where id = pg_temp.kc_game('C')$$), 1,
  'the Overlord still changes the revoked GM''s finished game');
select is(pg_temp.kc_writes($$delete from public.game_records where game_id = pg_temp.kc_game('C')::text$$), 1, 'and its Hall of Fame record');
select is(pg_temp.kc_writes($$delete from public.games where id = pg_temp.kc_game('C')$$), 1, 'and deletes it');

select * from finish();
rollback;
