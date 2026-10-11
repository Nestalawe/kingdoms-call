-- The signed-in account declines its own Game Master offer (P0-32b): the offer is deleted.
CREATE OR REPLACE FUNCTION public.gm_decline_offer()
  RETURNS void
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
begin
  delete from public.game_masters where user_id = auth.uid() and accepted_at is null;
  if not found then
    raise exception 'You have no offer to decline.';
  end if;
end
$function$;

REVOKE ALL ON FUNCTION "public"."gm_decline_offer"() FROM PUBLIC;

REVOKE ALL ON FUNCTION "public"."gm_decline_offer"() FROM "anon";

REVOKE ALL ON FUNCTION "public"."gm_decline_offer"() FROM "authenticated";

GRANT EXECUTE ON FUNCTION "public"."gm_decline_offer"() TO "authenticated";

GRANT EXECUTE ON FUNCTION "public"."gm_decline_offer"() TO "service_role";
