-- When a game is deleted, its Dispatches read markers go too (P0-23): a trigger on games, after each delete.
-- security definer, because nobody but each realm's own player may read or delete markers. No API role calls it.
CREATE OR REPLACE FUNCTION public.games_delete_message_reads()
  RETURNS trigger
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
begin
  delete from public.game_message_reads where game_id = old.id::text;
  return old;
end
$function$;

REVOKE ALL ON FUNCTION "public"."games_delete_message_reads"() FROM PUBLIC;

REVOKE ALL ON FUNCTION "public"."games_delete_message_reads"() FROM "anon";

REVOKE ALL ON FUNCTION "public"."games_delete_message_reads"() FROM "authenticated";

GRANT EXECUTE ON FUNCTION "public"."games_delete_message_reads"() TO "service_role";
