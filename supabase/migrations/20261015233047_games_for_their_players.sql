-- A running or finished game, and its turn logs, are read by the game's GM, its players and the Overlord; a game in
-- setup by any signed-in account if public, or an invited one if private (plan step P2-16, ruling D-10). The Hall of
-- Fame record rules ask game_exists whether a record's game was deleted. Access rules and one function; no data
-- changes.
--
-- Generated from supabase/schemas/.
SET local check_function_bodies = off;

DROP POLICY "edit game_records: its GM or the Overlord" ON "public"."game_records";

DROP POLICY "remove game_records: its GM or the Overlord" ON "public"."game_records";

DROP POLICY "read games (gm, public, or invited to private setup)" ON "public"."games";

DROP POLICY "allow_read_games" ON "public"."games";

DROP POLICY "anyone_can_read_games" ON "public"."games";

DROP POLICY "g2" ON "public"."games";

DROP POLICY "g3" ON "public"."games";

DROP POLICY "tl2" ON "public"."turn_logs";

CREATE OR REPLACE FUNCTION public.game_exists (
  p_game text
)
  RETURNS boolean
  LANGUAGE sql
  STABLE
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
  select case when pg_input_is_valid(p_game, 'uuid') then exists (select 1 from public.games where id = p_game::uuid)
              else false end
$function$;

REVOKE ALL ON FUNCTION "public"."game_exists"(text) FROM PUBLIC, "anon";

CREATE POLICY "edit game_records: its GM or the Overlord" ON "public"."game_records"
  FOR UPDATE
  TO "authenticated"
  USING ((( SELECT public.is_site_admin() AS is_site_admin) OR (game_id IN ( SELECT (g.id)::text AS id
   FROM public.games g
  WHERE (g.gm_user_id = ( SELECT auth.uid() AS uid)))) OR ((gm_user_id = ( SELECT auth.uid() AS uid)) AND (NOT public.game_exists(game_id)))))
  WITH CHECK ((( SELECT public.is_site_admin() AS is_site_admin) OR (game_id IN ( SELECT (g.id)::text AS id
   FROM public.games g
  WHERE (g.gm_user_id = ( SELECT auth.uid() AS uid)))) OR ((gm_user_id = ( SELECT auth.uid() AS uid)) AND (NOT public.game_exists(game_id)))));

CREATE POLICY "remove game_records: its GM or the Overlord" ON "public"."game_records"
  FOR DELETE
  TO "authenticated"
  USING ((( SELECT public.is_site_admin() AS is_site_admin) OR (game_id IN ( SELECT (g.id)::text AS id
   FROM public.games g
  WHERE (g.gm_user_id = ( SELECT auth.uid() AS uid)))) OR ((gm_user_id = ( SELECT auth.uid() AS uid)) AND (NOT public.game_exists(game_id)))));

CREATE POLICY "read games: its GM, its players, and open games in setup" ON "public"."games"
  FOR SELECT
  TO "authenticated"
  USING (((gm_user_id = ( SELECT auth.uid() AS uid)) OR public.is_game_member(id) OR ((status = 'setup'::text) AND ((COALESCE((
CASE jsonb_typeof(game_state)
    WHEN 'string'::text THEN
    CASE
        WHEN pg_input_is_valid((game_state #>> '{}'::text[]), 'jsonb'::text) THEN ((game_state #>> '{}'::text[]))::jsonb
        ELSE NULL::jsonb
    END
    ELSE game_state
END ->> 'visibility'::text), 'public'::text) <> 'private'::text) OR (COALESCE((
CASE jsonb_typeof(game_state)
    WHEN 'string'::text THEN
    CASE
        WHEN pg_input_is_valid((game_state #>> '{}'::text[]), 'jsonb'::text) THEN ((game_state #>> '{}'::text[]))::jsonb
        ELSE NULL::jsonb
    END
    ELSE game_state
END -> 'invited'::text), '[]'::jsonb) ? (( SELECT auth.uid() AS uid))::text)))));

CREATE POLICY "a game's players read its turn logs" ON "public"."turn_logs"
  FOR SELECT
  TO "authenticated"
  USING (public.is_game_member(game_id));

GRANT EXECUTE ON FUNCTION "public"."game_exists"(text) TO "authenticated";

REVOKE ALL ON FUNCTION "public"."game_exists"(text) FROM "postgres";

GRANT EXECUTE ON FUNCTION "public"."game_exists"(text) TO "postgres";

GRANT EXECUTE ON FUNCTION "public"."game_exists"(text) TO "service_role";
