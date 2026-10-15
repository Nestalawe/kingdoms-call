-- Suspending and deleting accounts (plan step P0-32h, ruling R-097, D-13 follow-up 2).
--
-- What the game needs:
--   nothing here changes an account unless the Overlord asks; a suspension changes nothing in any game.
-- Also checked:
--   only the Overlord suspends, lifts a suspension and deletes, and never on their own account;
--   account_suspend(user, until) sets the account's suspension (Supabase Auth then refuses its sign-in) until a
--   time in the future, or until lifted (no end given); account_unsuspend lifts it; overlord_accounts() says who's
--   suspended, until when;
--   account_delete(user) is refused while the account runs an unfinished game (hand it over first) or plays in one
--   (suspend it instead until the game ends); otherwise the account goes, with its profile, its Game Master row and
--   its read markers, and its finished games stay: its realm slots with no account, a game it ran with no GM.
begin;
\ir ../lib/world.psql
select plan(42);

create function pg_temp.banned(who uuid) returns timestamptz language sql as
  $$ select banned_until from auth.users where id = who $$;
create function pg_temp.kc_extra(k text) returns uuid language sql immutable as $$
  select (case k when 'retired' then '00000000-0000-4000-a000-000000000031'
                 when 'oldgm'   then '00000000-0000-4000-a000-000000000032'
                 when 'ghost'   then '00000000-0000-4000-a000-0000000000ff' end)::uuid $$;

-- The Overlord is stranger (in no game). Two more accounts, with finished games only:
--   retired  played realm 1 in Ashen Reach (complete), kept a read marker there, and has an open GM offer;
--   oldgm    a Game Master whose one game, Cinder Hold, is complete and in the Hall of Fame.
select pg_temp.kc_as('postgres');
select is(public.kc_set_overlord('stranger@example.test', false), 'Overlord set', 'stranger is the Overlord');
insert into auth.users (id, email, aud, role, raw_user_meta_data) values
  (pg_temp.kc_extra('retired'), 'retired@example.test', 'authenticated', 'authenticated', '{"display_name":"Gale Wren"}'),
  (pg_temp.kc_extra('oldgm'),   'oldgm@example.test',   'authenticated', 'authenticated', '{"display_name":"Warden Hale"}');
insert into public.game_players (game_id, user_id, player_index, display_name)
  values (pg_temp.kc_game('C'), pg_temp.kc_extra('retired'), 1, 'Wrenholt');
insert into public.game_message_reads (game_id, player_index, user_id, reads)
  values (pg_temp.kc_game('C')::text, 1, pg_temp.kc_extra('retired'), '{"public":3}');
insert into public.game_masters (user_id, offered_at, offered_by, accepted_at) values
  (pg_temp.kc_extra('retired'), now(), pg_temp.kc_uid('stranger'), null),
  (pg_temp.kc_extra('oldgm'),   now(), null, now());
insert into public.games (id, name, gm_user_id, status, turn)
  values ('00000000-0000-4000-b000-0000000000c2', 'Cinder Hold', pg_temp.kc_extra('oldgm'), 'complete', 7);
insert into public.game_records (game_id, game_name, gm_user_id, winner_realm)
  values ('00000000-0000-4000-b000-0000000000c2', 'Cinder Hold', pg_temp.kc_extra('oldgm'), 'Emberfast');

-- ── only the Overlord, never on their own account ────────────────────────────────────────────

select pg_temp.kc_as('anon');
select throws_ok($$select public.account_suspend(pg_temp.kc_uid('p3'), null)$$, '42501', null,
  'a signed-out visitor can''t suspend an account');
select throws_ok($$select public.account_unsuspend(pg_temp.kc_uid('p3'))$$, '42501', null,
  'nor lift a suspension');
select throws_ok($$select public.account_delete(pg_temp.kc_uid('invitee'))$$, '42501', null,
  'nor delete an account');

select pg_temp.kc_as('p1');
select throws_ok($$select public.account_suspend(pg_temp.kc_uid('p3'), null)$$, 'P0001',
  'Only the Overlord can suspend an account.', 'a player can''t suspend an account');
select throws_ok($$select public.account_unsuspend(pg_temp.kc_uid('p3'))$$, 'P0001',
  'Only the Overlord can lift a suspension.', 'nor lift a suspension');
select throws_ok($$select public.account_delete(pg_temp.kc_uid('invitee'))$$, 'P0001',
  'Only the Overlord can delete an account.', 'nor delete an account');
select pg_temp.kc_as('gm');
select throws_ok($$select public.account_suspend(pg_temp.kc_uid('p1'), null)$$, 'P0001',
  'Only the Overlord can suspend an account.', 'a GM can''t suspend a player in their game');
select throws_ok($$select public.account_delete(pg_temp.kc_uid('invitee'))$$, 'P0001',
  'Only the Overlord can delete an account.', 'nor delete an account');

select pg_temp.kc_as('stranger');
select throws_ok($$select public.account_suspend(auth.uid(), null)$$, 'P0001',
  'This doesn''t work on the Overlord''s own account.', 'the Overlord can''t suspend their own account');
select throws_ok($$select public.account_unsuspend(auth.uid())$$, 'P0001',
  'This doesn''t work on the Overlord''s own account.', 'nor lift a suspension on it');
select throws_ok($$select public.account_delete(auth.uid())$$, 'P0001',
  'This doesn''t work on the Overlord''s own account.', 'nor delete it');
select throws_ok($$select public.account_suspend(pg_temp.kc_extra('ghost'), null)$$, 'P0001',
  'No such account.', 'suspending an account that doesn''t exist is refused');
select throws_ok($$select public.account_unsuspend(pg_temp.kc_extra('ghost'))$$, 'P0001',
  'No such account.', 'so is lifting one');
select throws_ok($$select public.account_delete(pg_temp.kc_extra('ghost'))$$, 'P0001',
  'No such account.', 'and deleting one');

-- ── suspending ───────────────────────────────────────────────────────────────────────────────

select throws_ok($$select public.account_suspend(pg_temp.kc_uid('p3'), now() - interval '1 minute')$$, 'P0001',
  'A suspension must end in the future.', 'a suspension that has already ended is refused');
select lives_ok($$select public.account_suspend(pg_temp.kc_uid('p3'), now() + interval '1 day')$$,
  'the Overlord suspends a player for a day');
select pg_temp.kc_as('postgres');
select ok(pg_temp.banned(pg_temp.kc_uid('p3')) between now() + interval '1 day' - interval '1 minute' and now() + interval '1 day' + interval '1 minute',
  'their account is suspended until then');
select is((select count(*)::int from public.game_players where user_id = pg_temp.kc_uid('p3') and game_id = pg_temp.kc_game('B')), 1,
  'and keeps their realm');
select pg_temp.kc_as('stranger');
select ok((select suspended_until from public.overlord_accounts() where user_id = pg_temp.kc_uid('p3')) is not null,
  'the Overlord''s list says they''re suspended');
select is((select suspended_until from public.overlord_accounts() where user_id = pg_temp.kc_uid('p1')), null,
  'and that others aren''t');
select lives_ok($$select public.account_suspend(pg_temp.kc_uid('p3'), null)$$, 'with no end, the suspension lasts until lifted');
select pg_temp.kc_as('postgres');
select ok(pg_temp.banned(pg_temp.kc_uid('p3')) > now() + interval '99 years', 'which is a hundred years');
select pg_temp.kc_as('stranger');
select lives_ok($$select public.account_unsuspend(pg_temp.kc_uid('p3'))$$, 'the Overlord lifts the suspension');
select pg_temp.kc_as('postgres');
select is(pg_temp.banned(pg_temp.kc_uid('p3')), null, 'and the account can sign in again');
select pg_temp.kc_as('stranger');
select lives_ok($$select public.account_unsuspend(pg_temp.kc_uid('p3'))$$, 'lifting it again changes nothing');
-- a suspension that has run out reads as none
select pg_temp.kc_as('postgres');
update auth.users set banned_until = now() - interval '1 hour' where id = pg_temp.kc_uid('p2');
select pg_temp.kc_as('stranger');
select is((select suspended_until from public.overlord_accounts() where user_id = pg_temp.kc_uid('p2')), null,
  'a suspension that has run out isn''t shown');

-- ── deleting: refused while the account has an unfinished game ───────────────────────────────

select throws_ok($$select public.account_delete(pg_temp.kc_uid('p1'))$$, 'P0001',
  'That account plays in an unfinished game: suspend it instead until the game ends.',
  'an account playing in a running game can''t be deleted');
select throws_ok($$select public.account_delete(pg_temp.kc_uid('gm2'))$$, 'P0001',
  'That account runs an unfinished game: hand it over first.',
  'an account running a game can''t be deleted');
select pg_temp.kc_as('postgres');
select is((select count(*)::int from auth.users where id in (pg_temp.kc_uid('p1'), pg_temp.kc_uid('gm2'))), 2,
  'after the refusals, both accounts are still there');

-- ── deleting: what goes and what stays ───────────────────────────────────────────────────────

select pg_temp.kc_as('stranger');
select lives_ok($$select public.account_delete(pg_temp.kc_extra('retired'))$$,
  'the Overlord deletes an account whose games are all finished');
select pg_temp.kc_as('postgres');
select is((select count(*)::int from auth.users where id = pg_temp.kc_extra('retired')), 0, 'the account is gone');
select is((select count(*)::int from public.profiles where id = pg_temp.kc_extra('retired')), 0, 'and its profile');
select is((select count(*)::int from public.game_masters where user_id = pg_temp.kc_extra('retired')), 0, 'and its Game Master offer');
select is((select count(*)::int from public.game_message_reads where user_id = pg_temp.kc_extra('retired')), 0, 'and its read markers');
select results_eq($$select display_name, user_id from public.game_players where game_id = pg_temp.kc_game('C') and player_index = 1$$,
  $$values ('Wrenholt'::text, null::uuid)$$, 'its realm in a finished game stays, with no account');

select pg_temp.kc_as('stranger');
select lives_ok($$select public.account_delete(pg_temp.kc_extra('oldgm'))$$,
  'the Overlord deletes a Game Master whose games are all finished');
select pg_temp.kc_as('postgres');
select results_eq($$select name, gm_user_id from public.games where id = '00000000-0000-4000-b000-0000000000c2'$$,
  $$values ('Cinder Hold'::text, null::uuid)$$, 'the game they ran stays, with no GM');
select is((select count(*)::int from public.game_records where game_id = '00000000-0000-4000-b000-0000000000c2'), 1,
  'and stays in the Hall of Fame');
select is((select count(*)::int from public.game_masters where user_id = pg_temp.kc_extra('oldgm')), 0, 'and they''re no longer a Game Master');

select pg_temp.kc_as('stranger');
select lives_ok($$select public.account_delete(pg_temp.kc_uid('invitee'))$$, 'an account in no game is deleted');
select pg_temp.kc_as('postgres');
select is((select count(*)::int from auth.users where id in (pg_temp.kc_uid('p1'), pg_temp.kc_uid('p3'), pg_temp.kc_uid('gm'))), 3,
  'no other account was touched');

select * from finish();
rollback;
