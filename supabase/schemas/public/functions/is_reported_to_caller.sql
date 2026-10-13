-- Has this dispatch been reported to the caller (P0-24, rulings D-01, D-13g)? True only for the game's GM, when they
-- hold no realm in it, and someone has reported the dispatch. The dispatch read rule asks it, so a GM reads exactly
-- the private dispatches reported to them. Anyone else, the sender included, gets false: nobody learns their
-- dispatch was reported.
CREATE OR REPLACE FUNCTION public.is_reported_to_caller(p_message bigint)
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

REVOKE ALL ON FUNCTION "public"."is_reported_to_caller"(bigint) FROM PUBLIC;

REVOKE ALL ON FUNCTION "public"."is_reported_to_caller"(bigint) FROM "anon";

REVOKE ALL ON FUNCTION "public"."is_reported_to_caller"(bigint) FROM "authenticated";

GRANT EXECUTE ON FUNCTION "public"."is_reported_to_caller"(bigint) TO "authenticated";

GRANT EXECUTE ON FUNCTION "public"."is_reported_to_caller"(bigint) TO "service_role";
