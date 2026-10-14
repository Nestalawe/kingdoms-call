-- Who runs this game (P0-32e): its GM's account, or null. For the games rule "a save keeps the game's GM", which asks
-- it so a save can't change who runs the game: stable, so inside a save it reads the game as it was before. security
-- definer, so a rule on games can ask without reading games under its own rules (which would recurse). Signed-in
-- accounts only; they read every game's GM anyway.
CREATE OR REPLACE FUNCTION public.game_gm(p_game uuid)
  RETURNS uuid
  LANGUAGE sql
  STABLE
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
  select gm_user_id from public.games where id = p_game
$function$;

REVOKE ALL ON FUNCTION "public"."game_gm"(uuid) FROM PUBLIC;

REVOKE ALL ON FUNCTION "public"."game_gm"(uuid) FROM "anon";

REVOKE ALL ON FUNCTION "public"."game_gm"(uuid) FROM "authenticated";

GRANT EXECUTE ON FUNCTION "public"."game_gm"(uuid) TO "authenticated";

GRANT EXECUTE ON FUNCTION "public"."game_gm"(uuid) TO "service_role";
