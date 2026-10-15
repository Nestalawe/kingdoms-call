-- The GM's per-game switch "Block eliminated realms from sending dispatches" (plan step P0-25, ruling R-075).
-- games.block_eliminated_msgs: off by default. The player portal reads it to decide, on screen, whether an eliminated or
-- conceded realm may still post publicly (P0-25's site part; P2-04 moves the rule into the database).
--
-- What the game needs:
--   every game, old or new, has the switch, off unless its GM turns it on;
--   the game's GM (and the Overlord) turns it on and off; nobody else can;
--   players in the game read it.
begin;
\ir ../lib/world.psql
select plan(12);

select has_column('public', 'games', 'block_eliminated_msgs', 'games has the switch');
select col_type_is('public', 'games', 'block_eliminated_msgs', 'boolean', 'a yes or no');
select col_not_null('public', 'games', 'block_eliminated_msgs', 'never empty');
select col_default_is('public', 'games', 'block_eliminated_msgs', 'false', 'off by default');

select pg_temp.kc_as('postgres');
select is((select count(*)::int from public.games where block_eliminated_msgs), 0, 'every existing game starts with it off');
select is(public.kc_set_overlord('stranger@example.test', false), 'Overlord set', 'stranger is the Overlord');

-- ── what the game needs ──────────────────────────────────────────────────────────────────────

select pg_temp.kc_as('gm');
select is(pg_temp.kc_writes($$insert into public.games (name, gm_user_id, status, turn) values ('Saltmarsh', auth.uid(), 'setup', 0)$$), 1,
  'a GM still creates a game without naming the switch');
select is(pg_temp.kc_writes($$update public.games set block_eliminated_msgs = true where id = pg_temp.kc_game('A')$$), 1,
  'the game''s GM turns it on');
select pg_temp.kc_as('p1');
select is(pg_temp.kc_count($$select block_eliminated_msgs from public.games where id = pg_temp.kc_game('A')$$), 1,
  'a player in the game reads it');
select pg_temp.kc_as('stranger');
select is(pg_temp.kc_writes($$update public.games set block_eliminated_msgs = true where id = pg_temp.kc_game('B')$$), 1,
  'the Overlord turns it on in any game');

-- ── nobody else ──────────────────────────────────────────────────────────────────────────────

select pg_temp.kc_as('gm2');
select is(pg_temp.kc_writes($$update public.games set block_eliminated_msgs = true where id = pg_temp.kc_game('A')$$), 0,
  'another GM can''t');
select pg_temp.kc_as('p1');
select is(pg_temp.kc_writes($$update public.games set block_eliminated_msgs = false where id = pg_temp.kc_game('A')$$), 0,
  'a player can''t turn it off');

select * from finish();
rollback;
