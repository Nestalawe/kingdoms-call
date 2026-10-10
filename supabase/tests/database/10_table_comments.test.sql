-- Table comments: what each table holds, readable in the database itself (Supabase's table editor shows it).
-- The first migration through the deploy pipeline (P0-17) added the first one.
begin;
select plan(1);

select is(obj_description('public.games'::regclass, 'pg_class'),
  'One row per game: its settings, turn and status, the world (game_state) and a light summary of it (meta).',
  'games says what it holds');

select * from finish();
rollback;
