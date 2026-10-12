-- Does the signed-in account hold a realm in this game (P0-20)? For the access rules of P0-21 onwards, written
-- as `(select public.is_game_member(game_id))`. security definer, so a rule on game_players can ask without
-- reading game_players under its own rules (which would recurse). Signed-in accounts only.
CREATE OR REPLACE FUNCTION public.is_game_member(p_game uuid)
  RETURNS boolean
  LANGUAGE sql
  STABLE
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
  select exists (select 1 from public.game_players where game_id = p_game and user_id = auth.uid())
$function$;

REVOKE ALL ON FUNCTION "public"."is_game_member"(uuid) FROM PUBLIC;

REVOKE ALL ON FUNCTION "public"."is_game_member"(uuid) FROM "anon";

REVOKE ALL ON FUNCTION "public"."is_game_member"(uuid) FROM "authenticated";

GRANT EXECUTE ON FUNCTION "public"."is_game_member"(uuid) TO "authenticated";

GRANT EXECUTE ON FUNCTION "public"."is_game_member"(uuid) TO "service_role";
