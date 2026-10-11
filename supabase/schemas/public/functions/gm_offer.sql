-- The Overlord offers an account Game Master (P0-32b). Refuses anyone but the Overlord, the Overlord's own
-- account, an account that doesn't exist, and one that's already a Game Master. Offering again to an account
-- with an open offer changes nothing.
CREATE OR REPLACE FUNCTION public.gm_offer(p_user uuid)
  RETURNS void
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
begin
  if not public.is_site_admin() then
    raise exception 'Only the Overlord can offer Game Master.';
  end if;
  if exists (select 1 from public.site_admins where user_id = p_user) then
    raise exception 'The Overlord can''t be a Game Master.';
  end if;
  if not exists (select 1 from auth.users where id = p_user) then
    raise exception 'No such account.';
  end if;
  if exists (select 1 from public.game_masters where user_id = p_user and accepted_at is not null) then
    raise exception 'That account is already a Game Master.';
  end if;
  insert into public.game_masters (user_id, offered_by) values (p_user, auth.uid())
    on conflict (user_id) do nothing;
end
$function$;

REVOKE ALL ON FUNCTION "public"."gm_offer"(uuid) FROM PUBLIC;

REVOKE ALL ON FUNCTION "public"."gm_offer"(uuid) FROM "anon";

REVOKE ALL ON FUNCTION "public"."gm_offer"(uuid) FROM "authenticated";

GRANT EXECUTE ON FUNCTION "public"."gm_offer"(uuid) TO "authenticated";

GRANT EXECUTE ON FUNCTION "public"."gm_offer"(uuid) TO "service_role";
