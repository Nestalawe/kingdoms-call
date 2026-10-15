-- The Overlord suspends an account (P0-32h, R-097): Supabase Auth then refuses its sign-in and token refresh until
-- p_until (a session already open lasts until its token expires, up to an hour). No end given: until lifted, which is
-- a hundred years (what Supabase's own ban does; Auth can't read 'infinity'). The account keeps everything: its realms,
-- its games, its Game Master role. Refuses anyone but the Overlord, the Overlord's own account, an account that
-- doesn't exist and an end that has passed. Suspending again replaces the end.
CREATE OR REPLACE FUNCTION public.account_suspend(p_user uuid, p_until timestamp with time zone)
  RETURNS void
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
begin
  if not public.is_site_admin() then
    raise exception 'Only the Overlord can suspend an account.';
  end if;
  if exists (select 1 from public.site_admins where user_id = p_user) then
    raise exception 'This doesn''t work on the Overlord''s own account.';
  end if;
  if p_until is not null and p_until <= now() then
    raise exception 'A suspension must end in the future.';
  end if;
  update auth.users set banned_until = coalesce(p_until, now() + interval '100 years') where id = p_user;
  if not found then
    raise exception 'No such account.';
  end if;
end
$function$;

REVOKE ALL ON FUNCTION "public"."account_suspend"(uuid, timestamp with time zone) FROM PUBLIC;

REVOKE ALL ON FUNCTION "public"."account_suspend"(uuid, timestamp with time zone) FROM "anon";

REVOKE ALL ON FUNCTION "public"."account_suspend"(uuid, timestamp with time zone) FROM "authenticated";

GRANT EXECUTE ON FUNCTION "public"."account_suspend"(uuid, timestamp with time zone) TO "authenticated";

GRANT EXECUTE ON FUNCTION "public"."account_suspend"(uuid, timestamp with time zone) TO "service_role";
