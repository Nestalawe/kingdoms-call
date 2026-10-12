-- Realm slots for the player portal; one realm per slot number (plan step P0-20, Unit B expand). Nothing on the
-- site uses these yet.
--
-- Guard (hand-written; the generator never writes it): the unique slot number below can't be added while a game
-- already has two realms with one number. If any has, this stops here and changes nothing; the GM (or Toby, with
-- Theo) sorts that game out first, then this runs again. The message gives only a count: the run's log is public.
do $$
declare n int;
begin
  select count(*) into n from (
    select 1 from public.game_players group by game_id, player_index having count(*) > 1
  ) dup;
  if n > 0 then
    raise exception 'P0-20 stopped, nothing changed: % slot number(s) are held by more than one realm in the same game. Sort those games out first, then this runs again.', n;
  end if;
end
$$;

-- Generated from supabase/schemas/.
SET local check_function_bodies = off;

CREATE OR REPLACE FUNCTION public.get_game_slots (
  p_games uuid[]
)
  RETURNS TABLE (
    game_id          uuid,
    player_index     integer,
    is_bot           boolean,
    orders_submitted boolean,
    alignment        text
  )
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
         or exists (select 1 from public.game_players m where m.game_id = g.id and m.user_id = auth.uid())
         or (g.status = 'setup'
             and (coalesce(cfg.v ->> 'visibility', 'public') <> 'private'
                  or coalesce(cfg.v -> 'invited', '[]'::jsonb) ? (auth.uid())::text)))
  order by s.game_id, s.player_index
$function$;

REVOKE ALL ON FUNCTION "public"."get_game_slots"(uuid[]) FROM PUBLIC, "anon";

CREATE OR REPLACE FUNCTION public.is_game_gm (
  p_game uuid
)
  RETURNS boolean
  LANGUAGE sql
  STABLE
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
  select exists (select 1 from public.games where id = p_game and gm_user_id = auth.uid())
$function$;

REVOKE ALL ON FUNCTION "public"."is_game_gm"(uuid) FROM PUBLIC, "anon";

CREATE OR REPLACE FUNCTION public.is_game_member (
  p_game uuid
)
  RETURNS boolean
  LANGUAGE sql
  STABLE
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
  select exists (select 1 from public.game_players where game_id = p_game and user_id = auth.uid())
$function$;

REVOKE ALL ON FUNCTION "public"."is_game_member"(uuid) FROM PUBLIC, "anon";

CREATE UNIQUE INDEX game_players_one_per_number ON public.game_players USING btree (game_id, player_index);

GRANT EXECUTE ON FUNCTION "public"."get_game_slots"(uuid[]) TO "authenticated";

REVOKE ALL ON FUNCTION "public"."get_game_slots"(uuid[]) FROM "postgres";

GRANT EXECUTE ON FUNCTION "public"."get_game_slots"(uuid[]) TO "postgres";

GRANT EXECUTE ON FUNCTION "public"."get_game_slots"(uuid[]) TO "service_role";

GRANT EXECUTE ON FUNCTION "public"."is_game_gm"(uuid) TO "authenticated";

REVOKE ALL ON FUNCTION "public"."is_game_gm"(uuid) FROM "postgres";

GRANT EXECUTE ON FUNCTION "public"."is_game_gm"(uuid) TO "postgres";

GRANT EXECUTE ON FUNCTION "public"."is_game_gm"(uuid) TO "service_role";

GRANT EXECUTE ON FUNCTION "public"."is_game_member"(uuid) TO "authenticated";

REVOKE ALL ON FUNCTION "public"."is_game_member"(uuid) FROM "postgres";

GRANT EXECUTE ON FUNCTION "public"."is_game_member"(uuid) TO "postgres";

GRANT EXECUTE ON FUNCTION "public"."is_game_member"(uuid) TO "service_role";
