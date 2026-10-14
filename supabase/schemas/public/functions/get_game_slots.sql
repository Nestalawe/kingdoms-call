-- Every realm slot of the given games, as the player portal needs to see other realms (P0-20): the slot's
-- number, whether it's a bot, whether its orders are in, and its alignment while the game is in setup (the
-- join form's Divine/Undead check). Never orders, reports, names or accounts. Games the caller may not see are
-- left out: a member or the game's GM sees their game, and the Overlord every game (P0-32e); any signed-in account
-- sees a public game in setup, and an invited account a private one (as the games read rule). Signed-in accounts
-- only.
CREATE OR REPLACE FUNCTION public.get_game_slots(p_games uuid[])
  RETURNS TABLE(game_id uuid, player_index integer, is_bot boolean, orders_submitted boolean, alignment text)
  LANGUAGE sql
  STABLE
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
  -- game_state and turn_report hold JSON as text inside jsonb (the portals write JSON.stringify), or older
  -- rows an object: both are read; text that isn't valid JSON reads as nothing.
  select s.game_id, s.player_index, s.user_id is null, s.orders_submitted,
         case when g.status = 'setup' then rpt.v -> 'playerSetup' ->> 'alignment' end
  from public.games g
  cross join lateral (select case jsonb_typeof(g.game_state)
                               when 'string' then case when pg_input_is_valid(g.game_state #>> '{}', 'jsonb')
                                                       then (g.game_state #>> '{}')::jsonb end
                               else g.game_state end as v) cfg
  join public.game_players s on s.game_id = g.id
  cross join lateral (select case jsonb_typeof(s.turn_report)
                               when 'string' then case when pg_input_is_valid(s.turn_report #>> '{}', 'jsonb')
                                                       then (s.turn_report #>> '{}')::jsonb end
                               else s.turn_report end as v) rpt
  where g.id = any (p_games)
    and (g.gm_user_id = auth.uid()
         or public.is_site_admin()
         or exists (select 1 from public.game_players m where m.game_id = g.id and m.user_id = auth.uid())
         or (g.status = 'setup'
             and (coalesce(cfg.v ->> 'visibility', 'public') <> 'private'
                  or coalesce(cfg.v -> 'invited', '[]'::jsonb) ? (auth.uid())::text)))
  order by s.game_id, s.player_index
$function$;

REVOKE ALL ON FUNCTION "public"."get_game_slots"(uuid[]) FROM PUBLIC;

REVOKE ALL ON FUNCTION "public"."get_game_slots"(uuid[]) FROM "anon";

REVOKE ALL ON FUNCTION "public"."get_game_slots"(uuid[]) FROM "authenticated";

GRANT EXECUTE ON FUNCTION "public"."get_game_slots"(uuid[]) TO "authenticated";

GRANT EXECUTE ON FUNCTION "public"."get_game_slots"(uuid[]) TO "service_role";
