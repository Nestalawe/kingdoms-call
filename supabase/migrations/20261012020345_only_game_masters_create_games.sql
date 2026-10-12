-- Only Game Masters create games; the Overlord neither creates games nor plays (plan step P0-32d, decision D-13).
--
-- Guard (hand-written; the generator never writes it): every unfinished game's GM must already be a Game Master.
-- P0-32b made everyone who ran a game then one; this catches an account that has created a game since without
-- being one. If any has, this stops here and changes nothing; the
-- Overlord offers them GM (or, from P0-32e, hands the game over), then this is run again. The message gives only
-- a count: the run's log is public.
do $$
declare n int;
begin
  select count(*) into n
  from public.games g
  where g.status <> 'complete'
    and g.gm_user_id is not null
    and not exists (select 1 from public.game_masters m
                    where m.user_id = g.gm_user_id and m.accepted_at is not null);
  if n > 0 then
    raise exception 'P0-32d stopped, nothing changed: % unfinished game(s) are run by an account that isn''t a Game Master. The Overlord offers them GM first, then this runs again.', n;
  end if;
end
$$;

-- Generated from supabase/schemas/ (restrictive: each narrows every other rule that allows the write).
CREATE POLICY "the Overlord holds no realm (insert)" ON "public"."game_players"
  AS RESTRICTIVE
  FOR INSERT
  TO "authenticated"
  WITH CHECK (((user_id IS DISTINCT FROM ( SELECT auth.uid() AS uid)) OR (NOT ( SELECT public.is_site_admin() AS is_site_admin))));

CREATE POLICY "the Overlord holds no realm (update)" ON "public"."game_players"
  AS RESTRICTIVE
  FOR UPDATE
  TO "authenticated"
  USING (true)
  WITH CHECK (((user_id IS DISTINCT FROM ( SELECT auth.uid() AS uid)) OR (NOT ( SELECT public.is_site_admin() AS is_site_admin))));

CREATE POLICY "only Game Masters create games" ON "public"."games"
  AS RESTRICTIVE
  FOR INSERT
  TO "authenticated"
  WITH CHECK (((gm_user_id = ( SELECT auth.uid() AS uid)) AND ( SELECT public.is_game_master() AS is_game_master) AND (NOT ( SELECT public.is_site_admin() AS is_site_admin))));
