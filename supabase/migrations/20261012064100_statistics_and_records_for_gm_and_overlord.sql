-- Statistics and the Hall of Fame for the game's GM and the Overlord; the Overlord renames players (plan step
-- P0-22, rulings D-09 and D-11). Generated from supabase/schemas/. Rules only: no data changes.

SET local check_function_bodies = off;

DROP POLICY "gm write game_records" ON "public"."game_records";

DROP POLICY "gm rw game_results" ON "public"."game_results";

DROP POLICY "gm rw turn_events" ON "public"."turn_events";

CREATE OR REPLACE FUNCTION public.rename_player (
  p_user uuid,
  p_name text
)
  RETURNS void
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
begin
  if not public.is_site_admin() then
    raise exception 'Only the Overlord renames players.';
  end if;
  if coalesce(btrim(p_name), '') = '' then
    raise exception 'A player needs a name.';
  end if;
  update public.profiles set name = btrim(p_name) where id = p_user;
  if not found then
    raise exception 'No such player.';
  end if;
end
$function$;

REVOKE ALL ON FUNCTION "public"."rename_player"(uuid, text) FROM PUBLIC, "anon";

CREATE POLICY "edit game_records: its GM or the Overlord" ON "public"."game_records"
  FOR UPDATE
  TO "authenticated"
  USING ((( SELECT public.is_site_admin() AS is_site_admin) OR (game_id IN ( SELECT (g.id)::text AS id
   FROM public.games g
  WHERE (g.gm_user_id = ( SELECT auth.uid() AS uid)))) OR ((gm_user_id = ( SELECT auth.uid() AS uid)) AND (NOT (EXISTS ( SELECT 1
   FROM public.games g
  WHERE ((g.id)::text = game_records.game_id)))))))
  WITH CHECK ((( SELECT public.is_site_admin() AS is_site_admin) OR (game_id IN ( SELECT (g.id)::text AS id
   FROM public.games g
  WHERE (g.gm_user_id = ( SELECT auth.uid() AS uid)))) OR ((gm_user_id = ( SELECT auth.uid() AS uid)) AND (NOT (EXISTS ( SELECT 1
   FROM public.games g
  WHERE ((g.id)::text = game_records.game_id)))))));

CREATE POLICY "remove game_records: its GM or the Overlord" ON "public"."game_records"
  FOR DELETE
  TO "authenticated"
  USING ((( SELECT public.is_site_admin() AS is_site_admin) OR (game_id IN ( SELECT (g.id)::text AS id
   FROM public.games g
  WHERE (g.gm_user_id = ( SELECT auth.uid() AS uid)))) OR ((gm_user_id = ( SELECT auth.uid() AS uid)) AND (NOT (EXISTS ( SELECT 1
   FROM public.games g
  WHERE ((g.id)::text = game_records.game_id)))))));

CREATE POLICY "write game_records: the game's GM or the Overlord" ON "public"."game_records"
  FOR INSERT
  TO "authenticated"
  WITH CHECK ((( SELECT public.is_site_admin() AS is_site_admin) OR (game_id IN ( SELECT (g.id)::text AS id
   FROM public.games g
  WHERE (g.gm_user_id = ( SELECT auth.uid() AS uid))))));

CREATE POLICY "game's GM or the Overlord" ON "public"."game_results"
  FOR ALL
  TO "authenticated"
  USING ((( SELECT public.is_site_admin() AS is_site_admin) OR (game_id IN ( SELECT (g.id)::text AS id
   FROM public.games g
  WHERE (g.gm_user_id = ( SELECT auth.uid() AS uid))))))
  WITH CHECK ((( SELECT public.is_site_admin() AS is_site_admin) OR (game_id IN ( SELECT (g.id)::text AS id
   FROM public.games g
  WHERE (g.gm_user_id = ( SELECT auth.uid() AS uid))))));

CREATE POLICY "game's GM or the Overlord" ON "public"."turn_events"
  FOR ALL
  TO "authenticated"
  USING ((( SELECT public.is_site_admin() AS is_site_admin) OR (game_id IN ( SELECT (g.id)::text AS id
   FROM public.games g
  WHERE (g.gm_user_id = ( SELECT auth.uid() AS uid))))))
  WITH CHECK ((( SELECT public.is_site_admin() AS is_site_admin) OR (game_id IN ( SELECT (g.id)::text AS id
   FROM public.games g
  WHERE (g.gm_user_id = ( SELECT auth.uid() AS uid))))));

GRANT EXECUTE ON FUNCTION "public"."rename_player"(uuid, text) TO "authenticated";

REVOKE ALL ON FUNCTION "public"."rename_player"(uuid, text) FROM "postgres";

GRANT EXECUTE ON FUNCTION "public"."rename_player"(uuid, text) TO "postgres";

GRANT EXECUTE ON FUNCTION "public"."rename_player"(uuid, text) TO "service_role";
