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

END
$seed$;
