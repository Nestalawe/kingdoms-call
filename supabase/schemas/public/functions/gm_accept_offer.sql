-- The signed-in account accepts its own Game Master offer (P0-32b). Accepting again changes nothing.
CREATE OR REPLACE FUNCTION public.gm_accept_offer()
  RETURNS void
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
begin
  if not exists (select 1 from public.game_masters where user_id = auth.uid()) then
    raise exception 'You have no offer to accept.';
  end if;
  update public.game_masters set accepted_at = now() where user_id = auth.uid() and accepted_at is null;
end
$function$;

REVOKE ALL ON FUNCTION "public"."gm_accept_offer"() FROM PUBLIC;

REVOKE ALL ON FUNCTION "public"."gm_accept_offer"() FROM "anon";

REVOKE ALL ON FUNCTION "public"."gm_accept_offer"() FROM "authenticated";

GRANT EXECUTE ON FUNCTION "public"."gm_accept_offer"() TO "authenticated";

GRANT EXECUTE ON FUNCTION "public"."gm_accept_offer"() TO "service_role";
