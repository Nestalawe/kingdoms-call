-- Game Masters by offer (plan step P0-32b, decision D-13). Nothing on the site uses it yet (P0-32c adds the
-- offer banner and the GM portal gate; P0-32d makes creating a game need it).
--
-- What the game needs:
--   game_masters holds one row per account the Overlord has offered GM to: offered (accepted_at null) or a
--   Game Master (accepted). No API role writes it directly; an account reads its own row, the Overlord
--   reads every row, and nobody else reads any;
--   is_game_master() is true only for an accepted row, and only signed-in accounts may ask;
--   only the Overlord offers (never to its own account), withdraws an offer not yet accepted, and revokes;
--   revoking is refused while that account runs a game that isn't complete, archived or not (the Overlord
--   hands it over first, P0-32e);
--   an account accepts or declines only its own offer;
--   overlord_accounts() lists every account, with its email, for the Overlord only;
--   kc_set_overlord() refuses an account that's a Game Master or has an offer;
--   everyone who runs a game when this goes live becomes a Game Master (the migration's data step; mirrored
--   here for gm and gm2).
begin;
\ir ../lib/world.psql
select plan(41);

-- ── nobody but these functions writes game_masters ──────────────────────────────────────────────────

select pg_temp.kc_as('postgres');
select is((select string_agg(r || ' ' || p, ', ' order by r, p)
           from unnest(array['anon','authenticated']) r
           cross join unnest(array['INSERT','UPDATE','DELETE','TRUNCATE']) p
           where has_table_privilege(r, 'public.game_masters', p)), null,
  'no API role can write game_masters directly');
select ok(not has_table_privilege('anon', 'public.game_masters', 'SELECT'),
  'a signed-out visitor can''t read game_masters');
select is((select string_agg(f, ', ' order by f) from unnest(array[
             'public.is_game_master()', 'public.gm_offer(uuid)', 'public.gm_withdraw_offer(uuid)',
             'public.gm_revoke(uuid)', 'public.gm_accept_offer()', 'public.gm_decline_offer()',
             'public.overlord_accounts()']) f
           where has_function_privilege('anon', f, 'EXECUTE')), null,
  'a signed-out visitor can''t call any Game Master function');
select is((select string_agg(f, ', ' order by f) from unnest(array[
             'public.is_game_master()', 'public.gm_offer(uuid)', 'public.gm_withdraw_offer(uuid)',
             'public.gm_revoke(uuid)', 'public.gm_accept_offer()', 'public.gm_decline_offer()',
             'public.overlord_accounts()']) f
           where not has_function_privilege('authenticated', f, 'EXECUTE')), null,
  'a signed-in account can call each of them (each checks who''s asking)');

-- The Overlord is stranger (in no game). Today's GMs (gm, gm2) are Game Masters, as the migration's data
-- step makes them on the live database.
select is(public.kc_set_overlord('stranger@example.test', false), 'Overlord set', 'stranger is the Overlord');
insert into public.game_masters (user_id, offered_at, offered_by, accepted_at)
  values (pg_temp.kc_uid('gm'), now(), null, now()), (pg_temp.kc_uid('gm2'), now(), null, now());

-- ── is_game_master() ────────────────────────────────────────────────────────────────────────────────

select pg_temp.kc_as('gm');
select is(public.is_game_master(), true, 'a Game Master is one');
select pg_temp.kc_as('p1');
select is(public.is_game_master(), false, 'a player isn''t');
select pg_temp.kc_as('stranger');
select is(public.is_game_master(), false, 'the Overlord isn''t a Game Master');

-- ── offering ────────────────────────────────────────────────────────────────────────────────────────

select pg_temp.kc_as('p1');
select throws_like($$select public.gm_offer(pg_temp.kc_uid('p3'))$$, '%Only the Overlord%',
  'a player can''t offer GM');
select pg_temp.kc_as('gm');
select throws_like($$select public.gm_offer(pg_temp.kc_uid('p3'))$$, '%Only the Overlord%',
  'a Game Master can''t offer GM');

select pg_temp.kc_as('stranger');
select throws_like($$select public.gm_offer(pg_temp.kc_uid('stranger'))$$, '%Overlord%',
  'the Overlord can''t offer GM to its own account');
select throws_like($$select public.gm_offer(pg_temp.kc_uid('gm'))$$, '%already a Game Master%',
  'offering an account that''s already a Game Master is refused');
select throws_like($$select public.gm_offer('00000000-0000-4000-a000-0000000000ff'::uuid)$$, '%No such account%',
  'offering an account that doesn''t exist is refused');
select lives_ok($$select public.gm_offer(pg_temp.kc_uid('p3'))$$, 'the Overlord offers GM to a player');
select lives_ok($$select public.gm_offer(pg_temp.kc_uid('p3'))$$, 'offering again changes nothing');

-- ── who reads which rows ────────────────────────────────────────────────────────────────────────────

select pg_temp.kc_as('p3');
select is((select count(*)::int from public.game_masters where user_id = pg_temp.kc_uid('p3') and accepted_at is null), 1,
  'the offered player sees their pending offer');
select is(public.is_game_master(), false, 'an offer alone doesn''t make a Game Master');
select is((select count(*)::int from public.game_masters), 1, 'the offered player sees only their own row');
select pg_temp.kc_as('p1');
select is((select count(*)::int from public.game_masters), 0, 'another player sees no rows');
select pg_temp.kc_as('gm');
select is((select count(*)::int from public.game_masters), 1, 'a Game Master sees only their own row');
select pg_temp.kc_as('stranger');
select is((select count(*)::int from public.game_masters), 3, 'the Overlord sees every row');

-- ── no shortcuts: accepting only through the function ──────────────────────────────────────────────

select pg_temp.kc_as('p3');
select is(pg_temp.kc_writes($$update public.game_masters set accepted_at = now() where user_id = pg_temp.kc_uid('p3')$$), 0,
  'the offered player can''t accept by writing the row');
select pg_temp.kc_as('p1');
select is(pg_temp.kc_writes($$insert into public.game_masters (user_id, accepted_at) values (pg_temp.kc_uid('p1'), now())$$), 0,
  'a player can''t make themself a Game Master');

-- ── accepting and declining ─────────────────────────────────────────────────────────────────────────

select pg_temp.kc_as('p1');
select throws_like($$select public.gm_accept_offer()$$, '%no offer%', 'accepting with no offer is refused');
select pg_temp.kc_as('p3');
select lives_ok($$select public.gm_accept_offer()$$, 'the offered player accepts');
select is(public.is_game_master(), true, 'having accepted, they''re a Game Master');

select pg_temp.kc_as('stranger');
select lives_ok($$select public.gm_offer(pg_temp.kc_uid('p2'))$$, 'the Overlord offers GM to another player');
select pg_temp.kc_as('p2');
select lives_ok($$select public.gm_decline_offer()$$, 'who declines');
select pg_temp.kc_as('stranger');
select is((select count(*)::int from public.game_masters where user_id = pg_temp.kc_uid('p2')), 0,
  'a declined offer is gone');

-- ── withdrawing ─────────────────────────────────────────────────────────────────────────────────────

select lives_ok($$select public.gm_offer(pg_temp.kc_uid('p4'))$$, 'the Overlord offers GM to a third player');
select lives_ok($$select public.gm_withdraw_offer(pg_temp.kc_uid('p4'))$$, 'and withdraws it before it''s accepted');
select throws_like($$select public.gm_withdraw_offer(pg_temp.kc_uid('p3'))$$, '%accepted%',
  'an accepted offer can''t be withdrawn (that''s a revoke)');

-- ── revoking ────────────────────────────────────────────────────────────────────────────────────────

select pg_temp.kc_as('gm');
select throws_like($$select public.gm_revoke(pg_temp.kc_uid('gm2'))$$, '%Only the Overlord%',
  'a Game Master can''t revoke another');
select pg_temp.kc_as('stranger');
select throws_like($$select public.gm_revoke(pg_temp.kc_uid('gm'))$$, '%unfinished game%',
  'revoking a GM who runs an unfinished game is refused');
select pg_temp.kc_as('postgres');
update public.games set meta = coalesce(meta, '{}'::jsonb) || '{"archived":true}' where id = pg_temp.kc_game('B');
select pg_temp.kc_as('stranger');
select throws_like($$select public.gm_revoke(pg_temp.kc_uid('gm2'))$$, '%unfinished game%',
  'an archived game that isn''t complete still counts as unfinished');
select pg_temp.kc_as('postgres');
update public.games set status = 'complete' where id = pg_temp.kc_game('B');
select pg_temp.kc_as('stranger');
select lives_ok($$select public.gm_revoke(pg_temp.kc_uid('gm2'))$$, 'once their games are complete, a GM can be revoked');
select pg_temp.kc_as('gm2');
select is(public.is_game_master(), false, 'a revoked GM is no longer one');

-- ── the Overlord's list of accounts ─────────────────────────────────────────────────────────────────

select pg_temp.kc_as('p1');
select throws_like($$select * from public.overlord_accounts()$$, '%Only the Overlord%',
  'a player can''t list the accounts');
select pg_temp.kc_as('stranger');
select is((select format('%s %s %s %s', email, gm_status, games_run, games_played)
           from public.overlord_accounts() where user_id = pg_temp.kc_uid('gm')),
  'gm@example.test game_master 4 0',
  'the Overlord sees an account''s email, GM status, games run and games played');

-- ── the Overlord is never a Game Master ─────────────────────────────────────────────────────────────

select lives_ok($$select public.gm_offer(pg_temp.kc_uid('invitee'))$$, 'the Overlord offers GM to an account in no game');
select pg_temp.kc_as('postgres');
select throws_like($$select public.kc_set_overlord('invitee@example.test', true)$$, '%Game Master%',
  'an account with a Game Master offer can''t become the Overlord');

select * from finish();
rollback;
