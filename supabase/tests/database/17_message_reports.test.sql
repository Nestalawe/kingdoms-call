-- Reported dispatches (plan step P0-24, rulings D-01 and D-13g), and the Overlord reading every dispatch (D-13,
-- follow-up 1). Nothing on the site uses them yet.
--
-- What the game needs:
--   a player reports a private dispatch they received, as the realm they play, once, with an optional reason; they
--   see their own reports;
--   the game's GM sees its reported dispatches (each with its reporter and reason) through gm_reported_messages,
--   unless the GM holds a realm in that game: then the Overlord only (D-13g); the Overlord sees every game's;
--   the Overlord reads every dispatch, private ones included;
--   deleting a dispatch deletes its reports.
-- Also checked: nobody reports a dispatch they can't read, their own, or in another realm's name; nobody else reads
-- the reports; another GM, a player and a signed-out visitor get no reports.
begin;
\ir ../lib/world.psql
select plan(21);

-- The Overlord is stranger (in no game). Marchwood (A): p1 wrote to p2 privately (and p2 to p1).
-- "Hearth Hollow" (H): the GM plays in it, so its reports go to the Overlord only.
select pg_temp.kc_as('postgres');
select is(public.kc_set_overlord('stranger@example.test', false), 'Overlord set', 'stranger is the Overlord');
insert into public.games (id, name, gm_user_id, status, turn, max_players)
  values ('00000000-0000-4000-b000-0000000000a1', 'Hearth Hollow', pg_temp.kc_uid('gm'), 'active', 2, 2);
insert into public.game_players (game_id, user_id, player_index, display_name) values
  ('00000000-0000-4000-b000-0000000000a1', pg_temp.kc_uid('gm'), 0, 'Oakhold'),
  ('00000000-0000-4000-b000-0000000000a1', pg_temp.kc_uid('p3'), 1, 'Morrowmere');
insert into public.game_messages (game_id, turn, from_index, from_user_id, to_indexes, scope, body) values
  ('00000000-0000-4000-b000-0000000000a1', 2, 0, pg_temp.kc_uid('gm'), '{1}', 'private', 'Oakhold to Morrowmere only.');
create function pg_temp.msg(b text) returns bigint language sql as $$ select id from public.game_messages where body = b $$;
create function pg_temp.report(b text, idx int, why text default null) returns text language sql as $$
  select pg_temp.kc_outcome(format($q$insert into public.message_reports (message_id, game_id, reporter_index, reason)
    select id, game_id, %s, %L from public.game_messages where id = %s returning 1$q$, idx, why, pg_temp.msg(b)))
$$;

-- ── a player reports a dispatch they received ────────────────────────────────────────────────

select pg_temp.kc_as('p2');
select is(pg_temp.report('Thornmere to Veyholt only.', 1, 'Threats against my family'), 'ok:1',
  'a player reports a private dispatch they received');
select is(pg_temp.kc_count($$select reason from public.message_reports$$), 1, 'and sees their own report');
select isnt(pg_temp.report('Thornmere to Veyholt only.', 1), 'ok:1', 'once only');
select isnt(pg_temp.report('Veyholt to Thornmere only.', 1), 'ok:1', 'not their own dispatch');
select isnt(pg_temp.report('Peace on the river.', 0), 'ok:1', 'not in another realm''s name');

select pg_temp.kc_as('p4');
select isnt(pg_temp.report('Thornmere to Veyholt only.', 3), 'ok:1', 'not a dispatch they can''t read');
select pg_temp.kc_as('p3');
select isnt(pg_temp.report('Thornmere to Veyholt only.', 0), 'ok:1', 'nor one from another game');
select is(pg_temp.report('Oakhold to Morrowmere only.', 1, 'Odd offer'), 'ok:1', '(p3 reports the GM-player''s dispatch in Hearth Hollow)');

-- ── who sees the reports ─────────────────────────────────────────────────────────────────────

select pg_temp.kc_as('p1');
select is(pg_temp.kc_count($$select id from public.message_reports$$), 0, 'nobody else reads the reports table');

select pg_temp.kc_as('gm');
select is(pg_temp.kc_count($$select id from public.message_reports$$), 0, 'the GM doesn''t read it directly either');
select results_eq($$select body, reporter_index, reason from public.gm_reported_messages(pg_temp.kc_game('A'))$$,
  $$values ('Thornmere to Veyholt only.'::text, 1, 'Threats against my family'::text)$$,
  'the game''s GM sees its reported dispatch, its reporter and the reason');
select is((select count(*)::int from public.gm_reported_messages('00000000-0000-4000-b000-0000000000a1')), 0,
  'but not in a game where the GM holds a realm (D-13g)');

select pg_temp.kc_as('gm2');
select is((select count(*)::int from public.gm_reported_messages(pg_temp.kc_game('A'))), 0, 'another GM sees none');
select pg_temp.kc_as('p2');
select is((select count(*)::int from public.gm_reported_messages(pg_temp.kc_game('A'))), 0, 'nor does a player');

select pg_temp.kc_as('stranger');
select is((select count(*)::int from public.gm_reported_messages(null)), 2, 'the Overlord sees every game''s reports');
select is((select count(*)::int from public.gm_reported_messages('00000000-0000-4000-b000-0000000000a1')), 1,
  'including where the GM plays');
select is(pg_temp.kc_count($$select body from public.game_messages where scope = 'private'$$), 3,
  'the Overlord reads every dispatch, private ones included');

select pg_temp.kc_as('anon');
select throws_ok($$select * from public.gm_reported_messages(null)$$, '42501', null, 'a signed-out visitor can''t call it');
select is(pg_temp.kc_outcome($$insert into public.message_reports (message_id, game_id, reporter_index)
          values (1, pg_temp.kc_game('A')::text, 1) returning 1$$), 'error:42501', 'nor report');

-- ── a deleted dispatch takes its reports with it ─────────────────────────────────────────────

select pg_temp.kc_as('gm');
delete from public.game_messages where id = pg_temp.msg('Thornmere to Veyholt only.');
select pg_temp.kc_as('postgres');
select is((select count(*)::int from public.message_reports where game_id = pg_temp.kc_game('A')::text), 0,
  'deleting a dispatch deletes its reports');

select * from finish();
rollback;
