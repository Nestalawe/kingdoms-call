-- Hand-written (plan step P0-32b; the generator never writes data). Everyone who runs a game when this goes
-- live becomes a Game Master (decision D-13, follow-up 3), so nothing changes for them when P0-32d makes
-- creating a game need it. offered_by is null: nobody offered; they were GMs already. Running it twice
-- changes nothing.
insert into public.game_masters (user_id, offered_at, offered_by, accepted_at)
select distinct g.gm_user_id, now(), null::uuid, now()
from public.games g
where g.gm_user_id is not null
  and not exists (select 1 from public.site_admins s where s.user_id = g.gm_user_id)
on conflict (user_id) do nothing;
