-- Private dispatches are private (plan step P0-24, part 3 of 3; rulings D-01, D-13g): the game's GM reads the public
-- channel and the dispatches reported to them (is_reported_to_caller), no longer every private one; deleting a game
-- deletes all its dispatches. Needs part 2 (Report) live. Generated from supabase/schemas/. Rules only: no data
-- changes.

SET local check_function_bodies = off;

DROP POLICY "read game_messages" ON "public"."game_messages";

CREATE OR REPLACE FUNCTION public.games_delete_messages()
  RETURNS TRIGGER
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
begin
  delete from public.game_messages where game_id = old.id::text;
  return old;
end
$function$;

REVOKE ALL ON FUNCTION "public"."games_delete_messages"() FROM PUBLIC, "anon", "authenticated";

CREATE OR REPLACE FUNCTION public.is_reported_to_caller (
  p_message bigint
)
  RETURNS boolean
  LANGUAGE sql
  STABLE
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
  select exists (
    select 1
    from public.message_reports r
    join public.game_messages m on m.id = r.message_id
    join public.games g on g.id::text = m.game_id
    where r.message_id = p_message
      and g.gm_user_id = auth.uid()
      and not exists (select 1 from public.game_players gp where gp.game_id = g.id and gp.user_id = auth.uid()))
$function$;

REVOKE ALL ON FUNCTION "public"."is_reported_to_caller"(bigint) FROM PUBLIC, "anon";

CREATE TRIGGER games_delete_messages
  AFTER DELETE ON public.games
  FOR EACH ROW
  EXECUTE FUNCTION public.games_delete_messages();

CREATE POLICY "read game_messages" ON "public"."game_messages"
  FOR SELECT
  TO "authenticated"
  USING (((EXISTS ( SELECT 1
   FROM public.game_players gp
  WHERE ((gp.game_id =
        CASE
            WHEN pg_input_is_valid(game_messages.game_id, 'uuid'::text) THEN (game_messages.game_id)::uuid
            ELSE NULL::uuid
        END) AND (gp.user_id = auth.uid()) AND
          ((game_messages.scope = 'public'::text) OR (gp.player_index = game_messages.from_index) OR (gp.player_index = ANY (game_messages.to_indexes)))))) OR ((EXISTS ( SELECT 1
   FROM public.games g
  WHERE ((g.id =
        CASE
            WHEN pg_input_is_valid(game_messages.game_id, 'uuid'::text) THEN (game_messages.game_id)::uuid
            ELSE NULL::uuid
        END) AND (g.gm_user_id = auth.uid())))) AND ((scope = 'public'::text) OR public.is_reported_to_caller(id))) OR ( SELECT public.is_site_admin() AS is_site_admin)));

REVOKE ALL ON FUNCTION "public"."games_delete_messages"() FROM "postgres";

GRANT EXECUTE ON FUNCTION "public"."games_delete_messages"() TO "postgres";

GRANT EXECUTE ON FUNCTION "public"."games_delete_messages"() TO "service_role";

GRANT EXECUTE ON FUNCTION "public"."is_reported_to_caller"(bigint) TO "authenticated";

REVOKE ALL ON FUNCTION "public"."is_reported_to_caller"(bigint) FROM "postgres";

GRANT EXECUTE ON FUNCTION "public"."is_reported_to_caller"(bigint) TO "postgres";

GRANT EXECUTE ON FUNCTION "public"."is_reported_to_caller"(bigint) TO "service_role";
