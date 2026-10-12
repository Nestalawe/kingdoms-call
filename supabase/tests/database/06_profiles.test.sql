-- profiles: one row per account, its display name (and the email it signed up with, which no account reads
-- through the API: an account's own email comes from its sign-in session; P0-31, ruling D-08).
--
-- What the game needs:
--   an account reads its own name and sets it (an upsert: an account made before the sign-up trigger
--   existed has no row until it saves a name);
--   signed-in accounts read other people's names (the GM on the open-games list, players on the Hall
--   of Fame, the GM's invite list).
-- Also checked: nobody writes another account's profile or deletes their own, nobody reads any account's email,
-- and signed-out visitors read none.
begin;
\ir ../lib/world.psql
select plan(13);

-- ── what the game needs ──────────────────────────────────────────────────────────────────────

select pg_temp.kc_as('p1');
select is(pg_temp.kc_count($$select id, name, created_at from public.profiles where id = auth.uid()$$), 1,
  'an account reads its own profile (id, name, joined)');
select is(pg_temp.kc_writes($$update public.profiles set name = 'Ada of Thornmere' where id = auth.uid()$$), 1,
  'an account sets its own name');
select is(pg_temp.kc_writes($$insert into public.profiles (id, name) values (auth.uid(), 'Ada Thorn')
          on conflict (id) do update set name = excluded.name$$), 1,
  'an account saves its name as the player portal does (an upsert)');

select pg_temp.kc_as('stranger');
select is(pg_temp.kc_count($$select id, name from public.profiles where id = pg_temp.kc_uid('gm')$$), 1,
  'a signed-in account reads another person''s name');

select pg_temp.kc_as('postgres');
delete from public.profiles where id = pg_temp.kc_uid('invitee');
select pg_temp.kc_as('invitee');
select is(pg_temp.kc_writes($$insert into public.profiles (id, name) values (auth.uid(), 'Edda Lune')$$), 1,
  'an account with no profile creates its own');

-- ── nobody reads an email (P0-31) ────────────────────────────────────────────────────────────

select pg_temp.kc_as('p1');
select is(pg_temp.kc_count($$select email from public.profiles
          where id = pg_temp.kc_uid('p2') and email is not null$$), 0,
  'an account can''t read another account''s email');

select pg_temp.kc_as('gm');
select is(pg_temp.kc_count($$select email from public.profiles
          where id <> auth.uid() and email is not null$$), 0,
  'a GM can''t read players'' emails');

-- ── nobody writes another account's profile ──────────────────────────────────────────────────

select pg_temp.kc_as('p1');
select is(pg_temp.kc_writes($$update public.profiles set name = 'Renamed' where id = pg_temp.kc_uid('p2')$$), 0,
  'an account can''t rename another account');
select is(pg_temp.kc_writes($$insert into public.profiles (id, name) values (pg_temp.kc_uid('invitee'), 'Claimed')$$), 0,
  'an account can''t create a profile for another account');

select is(pg_temp.kc_writes($$delete from public.profiles where id = auth.uid()$$), 0,
  'an account can''t delete its profile');

select pg_temp.kc_as('gm');
select is(pg_temp.kc_writes($$update public.profiles set name = 'Renamed' where id = pg_temp.kc_uid('p1')$$), 0,
  'a GM can''t rename a player');

select pg_temp.kc_as('anon');
select is(pg_temp.kc_count($$select id from public.profiles$$), 0,
  'a signed-out visitor reads no profile');
select is(pg_temp.kc_writes($$update public.profiles set name = 'Nobody'$$), 0,
  'a signed-out visitor can''t change a profile');

select * from finish();
rollback;
