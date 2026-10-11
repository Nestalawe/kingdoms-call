-- The Overlord withdraws an offer that hasn't been accepted yet (P0-32b). An accepted one is revoked
-- instead (gm_revoke).
CREATE OR REPLACE FUNCTION public.gm_withdraw_offer(p_user uuid)
  RETURNS void
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
begin
  if not public.is_site_admin() then
    raise exception 'Only the Overlord can withdraw an offer.';
  end if;
  if exists (select 1 from public.game_masters where user_id = p_user and accepted_at is not null) then
    raise exception 'That offer has been accepted: revoke the Game Master instead.';
  end if;
  delete from public.game_masters where user_id = p_user and accepted_at is null;
  if not found then
    raise exception 'That account has no offer to withdraw.';
  end if;
end
$function$;

REVOKE ALL ON FUNCTION "public"."gm_withdraw_offer"(uuid) FROM PUBLIC;

REVOKE ALL ON FUNCTION "public"."gm_withdraw_offer"(uuid) FROM "anon";

REVOKE ALL ON FUNCTION "public"."gm_withdraw_offer"(uuid) FROM "authenticated";

GRANT EXECUTE ON FUNCTION "public"."gm_withdraw_offer"(uuid) TO "authenticated";

GRANT EXECUTE ON FUNCTION "public"."gm_withdraw_offer"(uuid) TO "service_role";
