-- game_message_reads: each realm's "read up to here" markers for Dispatches, keyed by (game, realm).
--
-- What the game needs:
--   a player reads and saves the markers of their own realm (an upsert on game_id, player_index).
-- Also checked: nobody reads or changes another account's markers.
begin;
\ir ../lib/world.psql
select plan(7);

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

select pg_temp.kc_as('anon');
select is(pg_temp.kc_count($$select reads from public.game_message_reads$$), 0,
  'a signed-out visitor reads no markers');

select * from finish();
rollback;
