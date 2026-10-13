-- When a game is deleted, its dispatches go too, and with them their reports (P0-24): a trigger on games, after each
-- delete. security definer, because the GM can't see the private ones to delete them. No API role calls it.
CREATE OR REPLACE FUNCTION public.games_delete_messages()
  RETURNS trigger
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
begin
  delete from public.game_messages where game_id = old.id::text;
  return old;
end
$function$;

REVOKE ALL ON FUNCTION "public"."games_delete_messages"() FROM PUBLIC;

REVOKE ALL ON FUNCTION "public"."games_delete_messages"() FROM "anon";

REVOKE ALL ON FUNCTION "public"."games_delete_messages"() FROM "authenticated";

GRANT EXECUTE ON FUNCTION "public"."games_delete_messages"() TO "service_role";
