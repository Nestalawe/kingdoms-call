-- The Overlord lifts an account's suspension (P0-32h, R-097): it can sign in again. Lifting one that isn't suspended
-- changes nothing. Refuses anyone but the Overlord, the Overlord's own account and an account that doesn't exist.
CREATE OR REPLACE FUNCTION public.account_unsuspend(p_user uuid)
  RETURNS void
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
begin
  if not public.is_site_admin() then
    raise exception 'Only the Overlord can lift a suspension.';
  end if;
  if exists (select 1 from public.site_admins where user_id = p_user) then
    raise exception 'This doesn''t work on the Overlord''s own account.';
  end if;
  update auth.users set banned_until = null where id = p_user;
  if not found then
    raise exception 'No such account.';
  end if;
end
$function$;

REVOKE ALL ON FUNCTION "public"."account_unsuspend"(uuid) FROM PUBLIC;

REVOKE ALL ON FUNCTION "public"."account_unsuspend"(uuid) FROM "anon";

REVOKE ALL ON FUNCTION "public"."account_unsuspend"(uuid) FROM "authenticated";

GRANT EXECUTE ON FUNCTION "public"."account_unsuspend"(uuid) TO "authenticated";

GRANT EXECUTE ON FUNCTION "public"."account_unsuspend"(uuid) TO "service_role";
