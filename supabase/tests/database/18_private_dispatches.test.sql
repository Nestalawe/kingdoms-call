-- Private dispatches and the GM (plan step P0-24, part 3; rulings D-01 and D-13g).
--
-- What the game needs:
--   the GM doesn't read private dispatches, except one reported to them: that one they read, and may delete (the
--   GM portal's Reported dispatches card);
--   deleting a game deletes all its dispatches, private ones too (the GM can't see them to delete them).
-- Also checked: a GM who plays in the game doesn't read a reported dispatch through being GM (its report goes to
-- the Overlord); the sender can't tell their dispatch was reported.
begin;
\ir ../lib/world.psql
select plan(9);

create function pg_temp.msg(b text) returns bigint language sql as $$ select id from public.game_messages where body = b $$;

-- Before any report: the GM reads none of Marchwood's private dispatches.
select pg_temp.kc_as('gm');
select is(pg_temp.kc_count($$select body from public.game_messages where game_id = pg_temp.kc_game('A')::text and scope = 'private'$$), 0,
  'the GM reads no private dispatch');

-- p2 reports what p1 wrote to them.
select pg_temp.kc_as('p2');
insert into public.message_reports (message_id, game_id, reporter_index, reason)
  select id, game_id, 1, 'Threats' from public.game_messages where body = 'Thornmere to Veyholt only.';

select pg_temp.kc_as('gm');
select results_eq($$select body from public.game_messages where game_id = pg_temp.kc_game('A')::text and scope = 'private'$$,
  $$values ('Thornmere to Veyholt only.'::text)$$, 'once it''s reported to them, the GM reads exactly that one');
select is(pg_temp.kc_writes($$delete from public.game_messages where body = 'Thornmere to Veyholt only.'$$), 1,
  'and can delete it');

select pg_temp.kc_as('p1');
select is(pg_temp.kc_count($$select id from public.message_reports$$), 0, 'the sender sees no report');
select is(public.is_reported_to_caller(pg_temp.msg('Thornmere to Veyholt only.')), false,
  'and can''t ask whether their dispatch was reported');

-- Hearth Hollow: the GM plays in it, so its reports go to the Overlord only.
select pg_temp.kc_as('postgres');
insert into public.games (id, name, gm_user_id, status, turn, max_players)
  values ('00000000-0000-4000-b000-0000000000a1', 'Hearth Hollow', pg_temp.kc_uid('gm'), 'active', 2, 3);
insert into public.game_players (game_id, user_id, player_index, display_name) values
  ('00000000-0000-4000-b000-0000000000a1', pg_temp.kc_uid('gm'), 0, 'Oakhold'),
  ('00000000-0000-4000-b000-0000000000a1', pg_temp.kc_uid('p3'), 1, 'Morrowmere'),
  ('00000000-0000-4000-b000-0000000000a1', pg_temp.kc_uid('p4'), 2, 'Ashgrove');
insert into public.game_messages (game_id, turn, from_index, from_user_id, to_indexes, scope, body) values
  ('00000000-0000-4000-b000-0000000000a1', 2, 1, pg_temp.kc_uid('p3'), '{2}', 'private', 'Morrowmere to Ashgrove only.');
insert into public.message_reports (message_id, game_id, reporter_index, reporter_user_id, reason)
  select id, game_id, 2, pg_temp.kc_uid('p4'), 'Rude' from public.game_messages where body = 'Morrowmere to Ashgrove only.';
select pg_temp.kc_as('gm');
select is(pg_temp.kc_count($$select body from public.game_messages where body = 'Morrowmere to Ashgrove only.'$$), 0,
  'a GM who plays in the game doesn''t read a reported dispatch between others');
select pg_temp.kc_as('stranger');
select is(pg_temp.kc_count($$select body from public.game_messages where body = 'Morrowmere to Ashgrove only.'$$), 0,
  'an account in no game reads none of it');

-- Deleting a game deletes all its dispatches.
select pg_temp.kc_as('gm');
delete from public.games where id = pg_temp.kc_game('A');      -- kept: kc_writes would undo it
select pg_temp.kc_as('postgres');
select is((select count(*)::int from public.game_messages where game_id = pg_temp.kc_game('A')::text), 0,
  'deleting a game deletes all its dispatches, private ones included');
select is((select count(*)::int from public.message_reports where game_id = pg_temp.kc_game('A')::text), 0,
  'and their reports');

select * from finish();
rollback;
