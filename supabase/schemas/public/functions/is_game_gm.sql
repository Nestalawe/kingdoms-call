-- Does the signed-in account run this game (P0-20)? For the access rules of P0-21 onwards, written as
-- `(select public.is_game_gm(game_id))`. security definer, so a rule can ask without reading games under its
-- own rules. Signed-in accounts only.
CREATE OR REPLACE FUNCTION public.is_game_gm(p_game uuid)
  RETURNS boolean
  LANGUAGE sql
  STABLE
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
  select exists (select 1 from public.games where id = p_game and gm_user_id = auth.uid())
$function$;

REVOKE ALL ON FUNCTION "public"."is_game_gm"(uuid) FROM PUBLIC;

REVOKE ALL ON FUNCTION "public"."is_game_gm"(uuid) FROM "anon";

REVOKE ALL ON FUNCTION "public"."is_game_gm"(uuid) FROM "authenticated";

GRANT EXECUTE ON FUNCTION "public"."is_game_gm"(uuid) TO "authenticated";

GRANT EXECUTE ON FUNCTION "public"."is_game_gm"(uuid) TO "service_role";
