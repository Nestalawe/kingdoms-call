-- Saving a realm's orders through submit_orders (plan step P2-05; ruling R-184). The order form saves every draft,
-- hero order, Revise and Submit through it (#620).
--
-- What the game needs:
--   a player submits their realm's orders, saves a draft, saves the order of their heroes, and opens their orders
--   again to revise them (Revise), each for the game's current turn, while the game is running;
--   each call changes only the realm's orders, whether they're submitted and when they were submitted.
-- Also checked:
--   a realm's orders are saved only by its own player: a rival, the game's GM, another GM, an account in no game and
--   the Overlord (who holds no realm) change no realm's orders, and a signed-out visitor can't call it;
--   no orders in another game, a game in setup or a finished game, nor for another turn;
--   after the turn's deadline (a game in deadline mode, its next deadline passed) orders are refused, with a clear
--   message; drafts, the order of heroes and Revise follow the same rule until the maintainers rule (question 80);
--   a game in another mode, or with no deadline set, or with no turn mode saved, has no deadline;
--   the orders are kept as the order form sends them: one set of orders, as JSON text or as an object, naming the
--   turn they're for, at most 256 KB.
begin;
\ir ../lib/world.psql
select plan(53);

-- Orders as the order form sends them: JSON text inside jsonb, naming the turn they're for.
create function pg_temp.kc_orders(turn int, what text default 'march') returns jsonb language sql immutable as $$
  select to_jsonb(json_build_object('orders', json_build_object('7', json_build_array(what)),
                                    'encounterPlans', '{}'::json, 'heroOrder', '[]'::json, 'forTurn', turn)::text)
$$;
-- A realm's row as the tests read it back (as postgres, whatever the point of view).
create function pg_temp.kc_realm(game text, idx int) returns public.game_players language sql security definer as $$
  select * from public.game_players where game_id = pg_temp.kc_game(game) and player_index = idx
$$;
-- Stage game A's turn mode (as postgres, then back to the point of view given).
create function pg_temp.kc_turn_mode(mode jsonb, back text) returns void language plpgsql as $$
begin
  perform pg_temp.kc_as('postgres');
  update public.games set meta = case when mode is null then null else jsonb_build_object('turnMode', mode) end
    where id = pg_temp.kc_game('A');
  perform pg_temp.kc_as(back);
end $$;

-- p1 also holds a realm in Open Vale, in setup. stranger is the Overlord.
select pg_temp.kc_as('postgres');
insert into public.game_players (game_id, user_id, player_index, display_name)
  values (pg_temp.kc_game('S'), pg_temp.kc_uid('p1'), 0, 'Thornwatch');
select is(public.kc_set_overlord('stranger@example.test', false), 'Overlord set', 'stranger is the Overlord');

-- ── a player saves their own orders ──────────────────────────────────────────────────────────

select pg_temp.kc_as('p1');
select lives_ok($$select public.submit_orders(pg_temp.kc_game('A'), 3, pg_temp.kc_orders(3, 'draft'), false)$$,
  'a player saves a draft of their orders');
select is((pg_temp.kc_realm('A', 0)).orders, pg_temp.kc_orders(3, 'draft'), 'the draft is saved as sent');
select is((pg_temp.kc_realm('A', 0)).orders_submitted, false, 'and the orders aren''t submitted');
select is((pg_temp.kc_realm('A', 0)).last_submitted_at, null, 'nor stamped as submitted');

select lives_ok($$select public.submit_orders(pg_temp.kc_game('A'), 3, pg_temp.kc_orders(3, 'final'), true)$$,
  'a player submits their orders');
select is((pg_temp.kc_realm('A', 0)).orders, pg_temp.kc_orders(3, 'final'), 'the orders are saved as sent');
select is((pg_temp.kc_realm('A', 0)).orders_submitted, true, 'and submitted');
select is((pg_temp.kc_realm('A', 0)).last_submitted_at, now(), 'stamped with the time they were submitted');

select lives_ok($$select public.submit_orders(pg_temp.kc_game('A'), 3, pg_temp.kc_orders(3, 'reordered'), null)$$,
  'a player saves the order of their heroes');
select is((pg_temp.kc_realm('A', 0)).orders, pg_temp.kc_orders(3, 'reordered'), 'the orders are saved as sent');
select is((pg_temp.kc_realm('A', 0)).orders_submitted, true, 'and they stay submitted');

select lives_ok($$select public.submit_orders(pg_temp.kc_game('A'), 3, null, false)$$,
  'a player opens their orders again to revise them');
select is((pg_temp.kc_realm('A', 0)).orders_submitted, false, 'they''re no longer submitted');
select is((pg_temp.kc_realm('A', 0)).orders, pg_temp.kc_orders(3, 'reordered'), 'and the orders saved are kept');

select lives_ok($$select public.submit_orders(pg_temp.kc_game('A'), 3,
          '{"orders":{},"encounterPlans":{},"forTurn":3}'::jsonb, true)$$,
  'orders sent as an object are saved too');

select is(row((pg_temp.kc_realm('A', 0)).game_id, (pg_temp.kc_realm('A', 0)).user_id,
              (pg_temp.kc_realm('A', 0)).player_index, (pg_temp.kc_realm('A', 0)).display_name,
              (pg_temp.kc_realm('A', 0)).turn_report)::text,
  row(pg_temp.kc_game('A'), pg_temp.kc_uid('p1'), 0, 'Thornmere', '{"report":"p1 sees the ford"}'::jsonb)::text,
  'the call changes only the realm''s orders and whether they''re submitted');
select is((pg_temp.kc_realm('A', 1)).orders, '{"orders":"p2 fortifies"}'::jsonb, 'and no other realm changes');

-- ── nobody saves another realm's orders ──────────────────────────────────────────────────────

select pg_temp.kc_as('p2');
select lives_ok($$select public.submit_orders(pg_temp.kc_game('A'), 3, pg_temp.kc_orders(3, 'rival'), true)$$,
  'a rival saves orders');
select is((pg_temp.kc_realm('A', 1)).orders, pg_temp.kc_orders(3, 'rival'), 'for their own realm');
select is((pg_temp.kc_realm('A', 0)).orders, '{"orders":{},"encounterPlans":{},"forTurn":3}'::jsonb,
  'never for another realm');

select pg_temp.kc_as('gm');
select throws_ok($$select public.submit_orders(pg_temp.kc_game('A'), 3, pg_temp.kc_orders(3), true)$$,
  'P0001', 'You hold no realm in this game.', 'the game''s GM holds no realm, so saves no orders');
select pg_temp.kc_as('gm2');
select throws_ok($$select public.submit_orders(pg_temp.kc_game('A'), 3, pg_temp.kc_orders(3), true)$$,
  'P0001', 'You hold no realm in this game.', 'nor another GM');
select pg_temp.kc_as('invitee');
select throws_ok($$select public.submit_orders(pg_temp.kc_game('A'), 3, pg_temp.kc_orders(3), true)$$,
  'P0001', 'You hold no realm in this game.', 'nor an account in no game');
select pg_temp.kc_as('stranger');
select throws_ok($$select public.submit_orders(pg_temp.kc_game('A'), 3, pg_temp.kc_orders(3), true)$$,
  'P0001', 'You hold no realm in this game.', 'nor the Overlord, who holds no realm');
select pg_temp.kc_as('anon');
select throws_ok($$select public.submit_orders(pg_temp.kc_game('A'), 3, pg_temp.kc_orders(3), true)$$,
  '42501', null, 'a signed-out visitor can''t call it');
select pg_temp.kc_as('p3');
select throws_ok($$select public.submit_orders(pg_temp.kc_game('A'), 3, pg_temp.kc_orders(3), true)$$,
  'P0001', 'You hold no realm in this game.', 'a player in another game saves no orders in this one');
select is((pg_temp.kc_realm('A', 0)).orders, '{"orders":{},"encounterPlans":{},"forTurn":3}'::jsonb,
  'and the realm''s orders are as its player left them');

-- ── only in a running game, for its current turn ─────────────────────────────────────────────

select pg_temp.kc_as('p1');
select throws_ok($$select public.submit_orders(pg_temp.kc_game('B'), 2, pg_temp.kc_orders(2), true)$$,
  'P0001', 'You hold no realm in this game.', 'a player saves no orders in a game they don''t play');
select throws_ok($$select public.submit_orders(pg_temp.kc_game('S'), 0, pg_temp.kc_orders(0), true)$$,
  'P0001', 'This game isn''t running: orders are sent only while it is.', 'nor in a game in setup');
select throws_ok($$select public.submit_orders(pg_temp.kc_game('C'), 9, pg_temp.kc_orders(9), true)$$,
  'P0001', 'This game isn''t running: orders are sent only while it is.', 'nor in a finished game');
select throws_ok($$select public.submit_orders(pg_temp.kc_game('A'), 2, pg_temp.kc_orders(2), true)$$,
  'P0001', 'These orders are for turn 2, but the game is on turn 3: reload to see the current turn.',
  'nor for a past turn');
select throws_ok($$select public.submit_orders(pg_temp.kc_game('A'), 4, pg_temp.kc_orders(4), true)$$,
  'P0001', 'These orders are for turn 4, but the game is on turn 3: reload to see the current turn.',
  'nor for a turn to come');
select throws_ok($$select public.submit_orders(pg_temp.kc_game('A'), 2, null, false)$$,
  'P0001', 'These orders are for turn 2, but the game is on turn 3: reload to see the current turn.',
  'Revise too names the current turn');

-- ── the deadline ─────────────────────────────────────────────────────────────────────────────

select pg_temp.kc_turn_mode(jsonb_build_object('mode', 'deadline', 'time', '20:00', 'everyDays', 1,
  'nextDeadlineAt', to_char((now() + interval '1 hour') at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')), 'p1');
select lives_ok($$select public.submit_orders(pg_temp.kc_game('A'), 3, pg_temp.kc_orders(3, 'in time'), true)$$,
  'orders sent before the deadline are saved');

select pg_temp.kc_turn_mode(jsonb_build_object('mode', 'deadline', 'time', '20:00', 'everyDays', 1,
  'nextDeadlineAt', to_char((now() - interval '1 minute') at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')), 'p1');
select throws_ok($$select public.submit_orders(pg_temp.kc_game('A'), 3, pg_temp.kc_orders(3, 'late'), true)$$,
  'P0001', 'This turn''s deadline has passed: orders can no longer be sent or changed.',
  'orders sent after the deadline are refused, with a clear message');
select throws_ok($$select public.submit_orders(pg_temp.kc_game('A'), 3, pg_temp.kc_orders(3, 'late'), false)$$,
  'P0001', 'This turn''s deadline has passed: orders can no longer be sent or changed.',
  'and, until the maintainers rule, so is a draft');
select throws_ok($$select public.submit_orders(pg_temp.kc_game('A'), 3, pg_temp.kc_orders(3, 'late'), null)$$,
  'P0001', 'This turn''s deadline has passed: orders can no longer be sent or changed.',
  'the order of the heroes');
select throws_ok($$select public.submit_orders(pg_temp.kc_game('A'), 3, null, false)$$,
  'P0001', 'This turn''s deadline has passed: orders can no longer be sent or changed.',
  'and opening the orders again to revise them');
select is((pg_temp.kc_realm('A', 0)).orders, pg_temp.kc_orders(3, 'in time'), 'the orders in by the deadline stay');

select pg_temp.kc_turn_mode(jsonb_build_object('mode', 'deadline', 'time', '20:00', 'everyDays', 1,
  'nextDeadlineAt', null), 'p1');
select lives_ok($$select public.submit_orders(pg_temp.kc_game('A'), 3, pg_temp.kc_orders(3), true)$$,
  'a game in deadline mode with no deadline set takes orders');
select pg_temp.kc_turn_mode(jsonb_build_object('mode', 'manual', 'time', '20:00', 'everyDays', 1,
  'nextDeadlineAt', to_char((now() - interval '1 day') at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')), 'p1');
select lives_ok($$select public.submit_orders(pg_temp.kc_game('A'), 3, pg_temp.kc_orders(3), true)$$,
  'a game in another mode has no deadline, whatever date it holds');
select pg_temp.kc_turn_mode(null, 'p1');
select lives_ok($$select public.submit_orders(pg_temp.kc_game('A'), 3, pg_temp.kc_orders(3), true)$$,
  'nor has a game with no turn mode saved');

-- ── the orders as the order form sends them ──────────────────────────────────────────────────

select throws_ok($$select public.submit_orders(pg_temp.kc_game('A'), 3, '12'::jsonb, true)$$,
  'P0001', 'Orders are saved as the order form writes them.', 'orders that are a number are refused');
select throws_ok($$select public.submit_orders(pg_temp.kc_game('A'), 3, '[1, 2]'::jsonb, true)$$,
  'P0001', 'Orders are saved as the order form writes them.', 'so are orders that are a list');
select throws_ok($$select public.submit_orders(pg_temp.kc_game('A'), 3, to_jsonb('{not json'::text), true)$$,
  'P0001', 'Orders are saved as the order form writes them.', 'and text that isn''t JSON');
select throws_ok($$select public.submit_orders(pg_temp.kc_game('A'), 3,
          to_jsonb('{"orders":{},"encounterPlans":{}}'::text), true)$$,
  'P0001', 'These orders don''t name this turn: reload to see the current turn.',
  'orders that name no turn are refused');
select throws_ok($$select public.submit_orders(pg_temp.kc_game('A'), 3, pg_temp.kc_orders(2), true)$$,
  'P0001', 'These orders don''t name this turn: reload to see the current turn.',
  'so are orders that name another turn');
select throws_ok($$select public.submit_orders(pg_temp.kc_game('A'), 3,
          to_jsonb('{"orders":{},"encounterPlans":{},"forTurn":"3"}'::text), true)$$,
  'P0001', 'These orders don''t name this turn: reload to see the current turn.',
  'and orders that name the turn in words, not as a number');
select throws_ok($$select public.submit_orders(pg_temp.kc_game('A'), 3, pg_temp.kc_orders(3, repeat('a', 262144)), true)$$,
  'P0001', 'These orders are too long to save.', 'orders longer than 256 KB are refused');
select lives_ok($$select public.submit_orders(pg_temp.kc_game('A'), 3, pg_temp.kc_orders(3, repeat('a', 200000)), true)$$,
  'orders of 200 KB are saved');
select throws_ok($$select public.submit_orders(pg_temp.kc_game('A'), 3, null, null)$$,
  'P0001', 'There is nothing to save.', 'a call that changes nothing is refused');
select throws_ok($$select public.submit_orders(pg_temp.kc_game('A'), 3, null, true)$$,
  'P0001', 'Send the orders to submit them.', 'and orders are submitted only with the orders themselves');

select * from finish();
rollback;
