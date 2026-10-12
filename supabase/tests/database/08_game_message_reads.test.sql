-- game_message_reads: each realm's "read up to here" markers for Dispatches, keyed by (game, realm).
--
-- What the game needs:
--   a player reads and saves the markers of their own realm (an upsert on game_id, player_index);
--   deleting a game removes its markers (deleteGame), though nobody but each realm's player reads them.
-- Also checked: nobody reads or changes another account's markers, and nobody keeps markers for a realm they
-- don't play (P0-23).
begin;
\ir ../lib/world.psql
select plan(11);

-- ── what the game needs ──────────────────────────────────────────────────────────────────────

select pg_temp.kc_as('p1');
select is(pg_temp.kc_count($$select reads from public.game_message_reads
          where game_id = pg_temp.kc_game('A')::text and player_index = 0$$), 1,
  'a player reads their realm''s markers');
select is(pg_temp.kc_writes($$update public.game_message_reads set reads = '{"public":2}', updated_at = now()
          where game_id = pg_temp.kc_game('A')::text and player_index = 0$$), 1,
  'a player updates their realm''s markers');

select pg_temp.kc_as('p2');
select is(pg_temp.kc_writes($$insert into public.game_message_reads (game_id, player_index, user_id, reads)
          values (pg_temp.kc_game('A')::text, 1, auth.uid(), '{"public":1}')$$), 1,
  'a player saves their realm''s first markers');

-- ── nobody touches another account's markers ─────────────────────────────────────────────────

select is(pg_temp.kc_count($$select reads from public.game_message_reads$$), 0,
  'a rival can''t read another realm''s markers');
select is(pg_temp.kc_writes($$update public.game_message_reads set reads = '{}'
          where game_id = pg_temp.kc_game('A')::text and player_index = 0$$), 0,
  'a rival can''t change another realm''s markers');
select is(pg_temp.kc_writes($$insert into public.game_message_reads (game_id, player_index, user_id, reads)
          values (pg_temp.kc_game('A')::text, 3, pg_temp.kc_uid('p1'), '{}')$$), 0,
  'a player can''t write markers under another account');

-- ── markers only for the realm you play (P0-23) ─────────────────────────────────────────────

select is(pg_temp.kc_writes($$insert into public.game_message_reads (game_id, player_index, user_id, reads)
          values (pg_temp.kc_game('A')::text, 3, auth.uid(), '{}')$$), 0,
  'a player can''t claim another realm''s markers');

select pg_temp.kc_as('p3');
select is(pg_temp.kc_writes($$insert into public.game_message_reads (game_id, player_index, user_id, reads)
          values (pg_temp.kc_game('A')::text, 1, auth.uid(), '{}')$$), 0,
  'a player can''t keep markers in a game they''re not in');

select pg_temp.kc_as('gm');
select is(pg_temp.kc_count($$select reads from public.game_message_reads$$), 0,
  'the GM can''t read the markers (their keys show who talks privately)');
delete from public.games where id = pg_temp.kc_game('A');      -- the GM deletes their game (kept: kc_writes would undo it)
select pg_temp.kc_as('postgres');
select is((select count(*)::int from public.game_message_reads where game_id = pg_temp.kc_game('A')::text), 0,
  'deleting a game removes its markers');

select pg_temp.kc_as('anon');
select is(pg_temp.kc_count($$select reads from public.game_message_reads$$), 0,
  'a signed-out visitor reads no markers');

select * from finish();
rollback;
