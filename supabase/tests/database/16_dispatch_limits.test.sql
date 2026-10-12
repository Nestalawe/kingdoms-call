-- Dispatch limits (plan step P0-23, ruling D-05).
--
-- What the game needs:
--   a player sends dispatches of up to 500 characters, up to 10 a minute and 300 a day in each game; every
--   other player's and every other game's dispatches count separately;
--   dispatches written before the limit (some longer than 500 characters) stay readable.
-- Also checked: a 501-character dispatch, an 11th in a minute and a 301st in a day are refused, with a message
-- the player portal shows as it is.
begin;
\ir ../lib/world.psql
select plan(11);

-- An old, long dispatch, written before the limit existed (staged the way that happened: without the check, which
-- then comes back as NOT VALID, as the migration adds it).
select pg_temp.kc_as('postgres');
alter table public.game_messages drop constraint game_messages_body_len;
insert into public.game_messages (game_id, turn, from_index, from_user_id, to_indexes, scope, body)
  values (pg_temp.kc_game('A')::text, 1, 1, pg_temp.kc_uid('p2'), '{}', 'public', repeat('An old long speech. ', 60));
alter table public.game_messages add constraint game_messages_body_len check (char_length(body) <= 500) not valid;

-- Sends as the current point of view and keeps the dispatch (kc_writes would undo it, and the limits count what's
-- kept). Returns 1 when sent; a refusal raises.
create function pg_temp.send(body text, idx int, game text default 'A') returns int language plpgsql as $$
begin
  insert into public.game_messages (game_id, turn, from_index, from_user_id, to_indexes, scope, body)
    values (pg_temp.kc_game(game)::text, 3, idx, auth.uid(), '{}', 'public', body);
  return 1;
end $$;

-- ── length ───────────────────────────────────────────────────────────────────────────────────

select pg_temp.kc_as('p1');
select is(pg_temp.send(repeat('a', 500), 0), 1, 'a 500-character dispatch is sent');
select throws_ok($$select pg_temp.send(repeat('a', 501), 0)$$, '23514', null, 'a 501-character dispatch is refused');
select is(pg_temp.kc_count($$select body from public.game_messages where char_length(body) > 500$$), 1,
  'a longer dispatch from before the limit is still read');

-- ── rate: 10 a minute ────────────────────────────────────────────────────────────────────────
-- (now() is fixed for the whole test, so every dispatch below counts as sent this minute; p4 has sent none yet)

select pg_temp.kc_as('p4');
select is((select sum(pg_temp.send('Dispatch ' || i, 3))::int from generate_series(1, 10) i), 10, 'ten in a minute are sent');
select throws_like($$select pg_temp.send('The eleventh', 3)$$, '%too quickly%', 'the eleventh in a minute is refused');

select pg_temp.kc_as('p2');
select is(pg_temp.send('Veyholt speaks', 1), 1, 'another player''s dispatches count separately');

-- ── rate: 300 a day (p3, in Fenmoor, has sent one dispatch there already) ─────────────────────

select pg_temp.kc_as('p3');
select is(pg_temp.send('Fenmoor speaks', 0, 'B'), 1, 'another game counts separately');
select pg_temp.kc_as('postgres');
insert into public.game_messages (game_id, turn, from_index, from_user_id, to_indexes, scope, body, created_at)
  select pg_temp.kc_game('B')::text, 2, 0, pg_temp.kc_uid('p3'), '{}', 'public', 'Earlier today ' || i, now() - interval '2 hours'
  from generate_series(1, 297) i;
select pg_temp.kc_as('p3');
select is(pg_temp.send('The three hundredth', 0, 'B'), 1, 'the 300th in a day is sent');
select throws_like($$select pg_temp.send('The three hundred and first', 0, 'B')$$, '%300 dispatches%', 'the 301st in a day is refused');

select pg_temp.kc_as('postgres');
update public.game_messages set created_at = now() - interval '25 hours' where from_user_id = pg_temp.kc_uid('p3');
select pg_temp.kc_as('p3');
select is(pg_temp.send('A new day', 0, 'B'), 1, 'a day later, dispatches are sent again');

-- ── the limit's own function isn't callable ──────────────────────────────────────────────────

select pg_temp.kc_as('postgres');
select ok(not has_function_privilege('authenticated', 'public.game_messages_rate_limit()', 'EXECUTE')
          and not has_function_privilege('anon', 'public.game_messages_rate_limit()', 'EXECUTE'),
  'no API role can call the rate limit''s function');

select * from finish();
rollback;
