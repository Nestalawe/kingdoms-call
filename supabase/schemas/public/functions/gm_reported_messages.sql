-- Reported dispatches, with their reporter and reason (P0-24, rulings D-01 and D-13g): for a game (or every game, when
-- p_game is null) the caller may see reports for. The game's GM sees them, unless the GM holds a realm in that game:
-- then only the Overlord does. The Overlord sees every game's. Anyone else gets none. Newest first.
CREATE OR REPLACE FUNCTION public.gm_reported_messages(p_game uuid)
  RETURNS TABLE(report_id bigint, message_id bigint, game_id text, turn integer, from_index integer, to_indexes integer[],
                scope text, body text, sent_at timestamp with time zone, reporter_index integer, reason text,
                reported_at timestamp with time zone)
  LANGUAGE sql
  STABLE
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
  select r.id, m.id, m.game_id, m.turn, m.from_index, m.to_indexes, m.scope, m.body, m.created_at,
         r.reporter_index, r.reason, r.created_at
  from public.message_reports r
  join public.game_messages m on m.id = r.message_id
  where (p_game is null or m.game_id = p_game::text)
    and (public.is_site_admin()
         or exists (select 1 from public.games g
                    where g.id::text = m.game_id and g.gm_user_id = auth.uid()
                      and not exists (select 1 from public.game_players gp where gp.game_id = g.id and gp.user_id = auth.uid())))
  order by r.created_at desc, r.id desc
$function$;

REVOKE ALL ON FUNCTION "public"."gm_reported_messages"(uuid) FROM PUBLIC;

REVOKE ALL ON FUNCTION "public"."gm_reported_messages"(uuid) FROM "anon";

REVOKE ALL ON FUNCTION "public"."gm_reported_messages"(uuid) FROM "authenticated";

GRANT EXECUTE ON FUNCTION "public"."gm_reported_messages"(uuid) TO "authenticated";

GRANT EXECUTE ON FUNCTION "public"."gm_reported_messages"(uuid) TO "service_role";
