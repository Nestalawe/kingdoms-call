-- Is the signed-in account a Game Master (P0-32b)? True only once an offer has been accepted. For later
-- steps' rules (P0-32d: only Game Masters create games), written as `(select public.is_game_master())` so
-- it's evaluated once per query. Signed-in accounts only.
CREATE OR REPLACE FUNCTION public.is_game_master()
  RETURNS boolean
  LANGUAGE sql
  STABLE
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
  select exists (select 1 from public.game_masters where user_id = auth.uid() and accepted_at is not null)
$function$;

REVOKE ALL ON FUNCTION "public"."is_game_master"() FROM PUBLIC;

REVOKE ALL ON FUNCTION "public"."is_game_master"() FROM "anon";

REVOKE ALL ON FUNCTION "public"."is_game_master"() FROM "authenticated";

GRANT EXECUTE ON FUNCTION "public"."is_game_master"() TO "authenticated";

GRANT EXECUTE ON FUNCTION "public"."is_game_master"() TO "service_role";
