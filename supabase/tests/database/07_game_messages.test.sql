-- game_messages: Dispatches between realms.
--
-- What the game needs:
--   a realm sends public dispatches, and private ones to one or more realms, in its own name only;
--   a realm reads the public channel and the private dispatches it sent or received;
--   the GM reads the public channel and deletes dispatches in their own game.
-- Also checked: nobody edits a dispatch, and nobody outside the game reads or deletes one.
--
-- In Marchwood (game A): Thornmere (p1, realm 0) and Veyholt (p2, realm 1) have exchanged one private
-- dispatch each way, and Thornmere has posted one public dispatch; Harrowdale (p4, realm 3) is
-- addressed by nobody.
begin;
\ir ../lib/world.psql
select plan(20);

-- ── what the game needs ──────────────────────────────────────────────────────────────────────

select pg_temp.kc_as('p1');
select is(pg_temp.kc_writes($$insert into public.game_messages (game_id, turn, from_index, to_indexes, scope, body)
          values (pg_temp.kc_game('A')::text, 3, 0, '{}', 'public', 'To all realms.')$$), 1,
  'a realm sends a public dispatch');
select is(pg_temp.kc_writes($$insert into public.game_messages (game_id, turn, from_index, to_indexes, scope, body)
          values (pg_temp.kc_game('A')::text, 3, 0, '{1}', 'private', 'To Veyholt.')$$), 1,
  'a realm sends a private dispatch');
select is(pg_temp.kc_writes($$insert into public.game_messages (game_id, turn, from_index, to_indexes, scope, body)
          values (pg_temp.kc_game('A')::text, 3, 0, '{1,3}', 'private', 'To Veyholt and Harrowdale.')$$), 1,
  'a realm sends a private dispatch to several realms');
select is(pg_temp.kc_count($$select body from public.game_messages where game_id = pg_temp.kc_game('A')::text$$), 3,
  'a realm reads the public channel and the private dispatches it sent and received');

select pg_temp.kc_as('p2');
select is(pg_temp.kc_count($$select body from public.game_messages where game_id = pg_temp.kc_game('A')::text$$), 3,
  'the other side of a private exchange reads it too');

select pg_temp.kc_as('p4');
select is(pg_temp.kc_count($$select body from public.game_messages where game_id = pg_temp.kc_game('A')::text$$), 1,
  'a realm addressed by nobody reads only the public channel');

select pg_temp.kc_as('gm');
select is(pg_temp.kc_count($$select body from public.game_messages
          where game_id = pg_temp.kc_game('A')::text and scope = 'public'$$), 1,
  'the GM reads the public channel of their own game');
select is(pg_temp.kc_writes($$delete from public.game_messages
          where game_id = pg_temp.kc_game('A')::text and scope = 'public'$$), 1,
  'the GM deletes a dispatch in their own game');

-- ── a realm writes only in its own name, in its own game ─────────────────────────────────────

select pg_temp.kc_as('p1');
select is(pg_temp.kc_writes($$insert into public.game_messages (game_id, turn, from_index, to_indexes, scope, body)
          values (pg_temp.kc_game('A')::text, 3, 1, '{3}', 'private', 'Forged as Veyholt.')$$), 0,
  'a realm can''t send a dispatch as another realm');
select is(pg_temp.kc_writes($$insert into public.game_messages (game_id, turn, from_index, from_user_id, to_indexes, scope, body)
          values (pg_temp.kc_game('A')::text, 3, 0, pg_temp.kc_uid('p2'), '{1}', 'private', 'Forged sender.')$$), 0,
  'a realm can''t send a dispatch under another account');
select is(pg_temp.kc_writes($$insert into public.game_messages (game_id, turn, from_index, to_indexes, scope, body)
          values (pg_temp.kc_game('B')::text, 2, 0, '{}', 'public', 'Into Fenmoor.')$$), 0,
  'a player can''t send a dispatch into a game they''re not in');
select throws_ok($$insert into public.game_messages (game_id, turn, from_index, to_indexes, scope, body)
          values (pg_temp.kc_game('A')::text, 3, 0, '{}', 'private', 'To nobody.')$$, '23514', null,
  'a private dispatch must name at least one realm');
select is(pg_temp.kc_writes($$update public.game_messages set body = 'Rewritten' where from_index = 0$$), 0,
  'nobody edits a dispatch, even their own');
select is(pg_temp.kc_writes($$delete from public.game_messages where from_index = 0$$), 0,
  'a realm can''t delete a dispatch, even their own');

select pg_temp.kc_as('gm');
select is(pg_temp.kc_writes($$insert into public.game_messages (game_id, turn, from_index, to_indexes, scope, body)
          values (pg_temp.kc_game('A')::text, 3, 0, '{}', 'public', 'The GM as Thornmere.')$$), 0,
  'the GM can''t send a dispatch as a realm they don''t play');

select pg_temp.kc_as('anon');
select is(pg_temp.kc_writes($$insert into public.game_messages (game_id, turn, from_index, from_user_id, to_indexes, scope, body)
          values (pg_temp.kc_game('A')::text, 3, 0, pg_temp.kc_uid('p1'), '{}', 'public', 'From outside.')$$), 0,
  'a signed-out visitor can''t send a dispatch');

-- ── nobody outside the game reads or deletes its dispatches ──────────────────────────────────

select pg_temp.kc_as('p3');
select is(pg_temp.kc_count($$select body from public.game_messages where game_id = pg_temp.kc_game('A')::text$$), 0,
  'a player in another game reads none of the game''s dispatches');

select pg_temp.kc_as('gm2');
select is(pg_temp.kc_count($$select body from public.game_messages where game_id = pg_temp.kc_game('A')::text$$), 0,
  'another GM reads none of the game''s dispatches');
select is(pg_temp.kc_writes($$delete from public.game_messages where game_id = pg_temp.kc_game('A')::text$$), 0,
  'another GM can''t delete the game''s dispatches');

select pg_temp.kc_as('anon');
select is(pg_temp.kc_count($$select body from public.game_messages$$), 0,
  'a signed-out visitor reads no dispatch');

select * from finish();
rollback;
