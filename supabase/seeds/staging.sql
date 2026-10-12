-- Staging's made-up games (P0-33). Never loaded locally or in CI: supabase/seed.sql is the local seed.
--
-- .github/workflows/staging.yml runs this on the staging database each time a pull request goes on it: after
-- the database is rebuilt from main's migrations and the test accounts are signed up (main's copy of this
-- file), and again after the pull request's own migrations (its copy). So it must be idempotent: a second
-- run changes nothing. A pull request that adds a table adds its made-up rows here.
--
-- The test accounts (.github/scripts/staging-seed.js, TEST_ACCOUNTS) sign up through the site's own sign-up,
-- so their profiles come from the sign-up trigger. Their password is the staging environment's
-- STAGING_TEST_PASSWORD secret. Rows below find them by email; a missing account skips its rows.
--
-- The rows have the shape the portals write: game_state and turn_report are JSON text stored in jsonb (the
-- portals send JSON.stringify(...)), meta is buildGameMeta's object.
--
-- Everything is inside one DO block: the CLI runs the file as a single statement (`supabase db query --file`).
DO $seed$
BEGIN

-- 1. "Staging test: Two Realms": the test GM's game, 3 realms on the smallest 3-player map, one of them a bot.
--    Test players 1 and 2 have joined, so the GM can run Turn 0 straight away.
INSERT INTO public.games (id, name, gm_user_id, status, turn, max_players, max_turns, game_state, meta)
SELECT '00000000-0000-4000-8000-00000000a001', 'Staging test: Two Realms', u.id, 'setup', 0, 3, 0,
  to_jsonb('{"mapSize":"p3","maxTurns":0,"maxPlayers":3,"botCount":1,"allBot":false,"seaPct":35,"botDiplomacy":"normal","safeStart":false,"botDifficulty":"hard","turnMode":{"mode":"manual","time":"20:00","everyDays":1,"nextDeadlineAt":null,"turnRanAt":null}}'::text),
  '{"v":1,"turnMode":{"mode":"manual","time":"20:00","everyDays":1,"nextDeadlineAt":null,"turnRanAt":null},"mapSize":"p3","maxPlayers":3,"botCount":1,"allBot":false,"botDifficulty":"hard","botDiplomacy":"normal","safeStart":false,"seaPct":35}'::jsonb
FROM auth.users u WHERE u.email = 'gm@kingdoms-call.test'
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.game_players (id, game_id, user_id, player_index, display_name, orders_submitted, turn_report)
SELECT p.id::uuid, '00000000-0000-4000-8000-00000000a001', u.id, p.idx, p.realm, false,
  to_jsonb(json_build_object('playerSetup', json_build_object('kingName', p.king, 'kingdomName', p.realm,
    'race', p.race, 'alignment', p.alignment, 'temper', p.temper, 'skills', p.skills::json),
    'status', 'joined', 'waitingForTurn0', true)::text)
FROM (VALUES
  ('00000000-0000-4000-8000-00000000b001', 0, 'player1@kingdoms-call.test', 'Aldric the Test', 'Testmark',   'Human',   'Good',    'Brave',    '{"melee":2,"tactical":2}'),
  ('00000000-0000-4000-8000-00000000b002', 1, 'player2@kingdoms-call.test', 'Brannoc Proof',   'Trialholme', 'Dwarven', 'Neutral', 'Cautious', '{"archery":2,"march":1,"sage":1}')
) AS p(id, idx, email, king, realm, race, alignment, temper, skills)
JOIN auth.users u ON u.email = p.email
WHERE EXISTS (SELECT 1 FROM public.games g WHERE g.id = '00000000-0000-4000-8000-00000000a001')
ON CONFLICT DO NOTHING;

-- 2. "Staging test: Open Game": the test GM's game with nobody in it yet, for trying a join (test player 3).
INSERT INTO public.games (id, name, gm_user_id, status, turn, max_players, max_turns, game_state, meta)
SELECT '00000000-0000-4000-8000-00000000a002', 'Staging test: Open Game', u.id, 'setup', 0, 4, 0,
  to_jsonb('{"mapSize":"p4","maxTurns":0,"maxPlayers":4,"botCount":0,"allBot":false,"seaPct":35,"botDiplomacy":"normal","safeStart":false,"botDifficulty":"hard","turnMode":{"mode":"manual","time":"20:00","everyDays":1,"nextDeadlineAt":null,"turnRanAt":null}}'::text),
  '{"v":1,"turnMode":{"mode":"manual","time":"20:00","everyDays":1,"nextDeadlineAt":null,"turnRanAt":null},"mapSize":"p4","maxPlayers":4,"botCount":0,"allBot":false,"botDifficulty":"hard","botDiplomacy":"normal","safeStart":false,"seaPct":35}'::jsonb
FROM auth.users u WHERE u.email = 'gm@kingdoms-call.test'
ON CONFLICT (id) DO NOTHING;

-- 3. The test Overlord (P0-32a): overlord@kingdoms-call.test, which is in no game. On the live database the
--    Overlord is set by .github/workflows/overlord.yml instead.
IF EXISTS (SELECT 1 FROM auth.users WHERE email = 'overlord@kingdoms-call.test') THEN
  PERFORM public.kc_set_overlord('overlord@kingdoms-call.test', true);
END IF;

-- 4. Game Masters (P0-32b): the test GM is one (as everyone who ran a game became one when it went live), and
--    test player 3 has an open offer from the test Overlord, to accept or decline (P0-32c adds the banner).
INSERT INTO public.game_masters (user_id, offered_at, offered_by, accepted_at)
SELECT u.id, now(), NULL, now() FROM auth.users u WHERE u.email = 'gm@kingdoms-call.test'
ON CONFLICT (user_id) DO NOTHING;
INSERT INTO public.game_masters (user_id, offered_at, offered_by, accepted_at)
SELECT u.id, now(), (SELECT id FROM auth.users WHERE email = 'overlord@kingdoms-call.test'), NULL
FROM auth.users u WHERE u.email = 'player3@kingdoms-call.test'
ON CONFLICT (user_id) DO NOTHING;

-- 5. "Staging test: The Old War": a finished game of the test GM's, with its Hall of Fame entry, results and a
--    few recorded turns (P0-22: the Hall of Fame's controls, the Stats tab). Test players 1 and 2 played it.
INSERT INTO public.games (id, name, gm_user_id, status, turn, max_players, max_turns, game_state, meta)
SELECT '00000000-0000-4000-8000-00000000a003', 'Staging test: The Old War', u.id, 'complete', 9, 2, 8,
  to_jsonb('{"mapSize":"p2","maxTurns":8,"maxPlayers":2,"botCount":0,"allBot":false,"seaPct":35}'::text),
  '{"v":1,"turnMode":{"mode":"manual"},"mapSize":"p2","maxPlayers":2,"botCount":0,"allBot":false,"seaPct":35}'::jsonb
FROM auth.users u WHERE u.email = 'gm@kingdoms-call.test'
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.game_players (id, game_id, user_id, player_index, display_name, orders_submitted, turn_report)
SELECT p.id::uuid, '00000000-0000-4000-8000-00000000a003', u.id, p.idx, p.realm, false,
  to_jsonb(json_build_object('playerSetup', json_build_object('kingdomName', p.realm, 'race', p.race, 'alignment', p.al))::text)
FROM (VALUES
  ('00000000-0000-4000-8000-00000000b011', 0, 'player1@kingdoms-call.test', 'Testmark',   'Human',   'Good'),
  ('00000000-0000-4000-8000-00000000b012', 1, 'player2@kingdoms-call.test', 'Trialholme', 'Dwarven', 'Neutral')
) AS p(id, idx, email, realm, race, al)
JOIN auth.users u ON u.email = p.email
WHERE EXISTS (SELECT 1 FROM public.games g WHERE g.id = '00000000-0000-4000-8000-00000000a003')
ON CONFLICT DO NOTHING;

INSERT INTO public.game_records (game_id, game_name, gm_user_id, started_at, finished_at, turns, winner_realm,
  winner_is_bot, victory, setup, standings, records, totals, build)
SELECT '00000000-0000-4000-8000-00000000a003', 'Staging test: The Old War', g.gm_user_id,
  now() - interval '20 days', now() - interval '2 days', 8, 'Testmark', false, 'reckoning',
  '{"humans":2,"bots":0,"realms":2,"diplomacy":"normal","mapSize":"p2","seaPct":35}'::jsonb,
  jsonb_build_array(
    jsonb_build_object('rank',1,'realm','Testmark','uid',(SELECT id FROM auth.users WHERE email='player1@kingdoms-call.test'),
      'bot',false,'winner',true,'race','Human','al','Good','score',140,'prov',9,'gold',320,'str',210,'titles','[]'::jsonb),
    jsonb_build_object('rank',2,'realm','Trialholme','uid',(SELECT id FROM auth.users WHERE email='player2@kingdoms-call.test'),
      'bot',false,'winner',false,'race','Dwarven','al','Neutral','score',95,'prov',6,'gold',180,'str',150,'titles','[]'::jsonb)),
  '{}'::jsonb, '{"battles":6,"casualties":11,"captures":4,"lairs":2,"spells":3}'::jsonb, 'staging-seed lb2'
FROM public.games g WHERE g.id = '00000000-0000-4000-8000-00000000a003'
ON CONFLICT (game_id) DO NOTHING;

INSERT INTO public.game_results (game_id, game_name, player_index, realm, race, alignment, rank, score, winner, turns)
SELECT '00000000-0000-4000-8000-00000000a003', 'Staging test: The Old War', r.idx, r.realm, r.race, r.al, r.rank, r.score, r.win, 8
FROM (VALUES (0, 'Testmark', 'Human', 'Good', 1, 140, true), (1, 'Trialholme', 'Dwarven', 'Neutral', 2, 95, false))
  AS r(idx, realm, race, al, rank, score, win)
WHERE EXISTS (SELECT 1 FROM public.games g WHERE g.id = '00000000-0000-4000-8000-00000000a003')
  AND NOT EXISTS (SELECT 1 FROM public.game_results x WHERE x.game_id = '00000000-0000-4000-8000-00000000a003');

INSERT INTO public.turn_events (game_id, turn, player_index, realm, race, alignment, orders, outcomes)
SELECT '00000000-0000-4000-8000-00000000a003', t.turn, t.idx, t.realm, t.race, t.al, '{}'::jsonb, '{}'::jsonb
FROM (VALUES (7, 0, 'Testmark', 'Human', 'Good'), (7, 1, 'Trialholme', 'Dwarven', 'Neutral'),
             (8, 0, 'Testmark', 'Human', 'Good'), (8, 1, 'Trialholme', 'Dwarven', 'Neutral'))
  AS t(turn, idx, realm, race, al)
WHERE EXISTS (SELECT 1 FROM public.games g WHERE g.id = '00000000-0000-4000-8000-00000000a003')
ON CONFLICT DO NOTHING;

-- 6. Statistics left behind by a deleted game (no games row), for the Stats tab's "Forget deleted games' data".
INSERT INTO public.turn_events (game_id, turn, player_index, realm)
VALUES ('00000000-0000-4000-8000-00000000a0d1', 3, 0, 'A Lost Realm')
ON CONFLICT DO NOTHING;

END
$seed$;
