-- Is there still a game with this id (P2-16)? For the Hall of Fame record rules, which let the GM named on a record
-- keep it once its game is deleted: a game the caller can't read is not a deleted game. security definer, so it
-- sees every game; it answers only yes or no. game_records.game_id is text. Signed-in accounts only.
CREATE OR REPLACE FUNCTION public.game_exists(p_game text)
  RETURNS boolean
  LANGUAGE sql
  STABLE
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
  select case when pg_input_is_valid(p_game, 'uuid') then exists (select 1 from public.games where id = p_game::uuid)
              else false end
$function$;

REVOKE ALL ON FUNCTION "public"."game_exists"(text) FROM PUBLIC;

REVOKE ALL ON FUNCTION "public"."game_exists"(text) FROM "anon";

REVOKE ALL ON FUNCTION "public"."game_exists"(text) FROM "authenticated";

GRANT EXECUTE ON FUNCTION "public"."game_exists"(text) TO "authenticated";

GRANT EXECUTE ON FUNCTION "public"."game_exists"(text) TO "service_role";
