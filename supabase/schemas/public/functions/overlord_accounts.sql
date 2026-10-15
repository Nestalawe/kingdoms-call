-- Every account, for the Overlord only (P0-32b): name, email, joined, last sign-in, Game Master status and
-- how many games it has run and played, and until when it's suspended (P0-32h; null if it isn't). The Overlord page's
-- one read (P0-32f), so it doesn't depend on P0-31's email rules. gm_status is 'game_master', 'offered' or 'none'.
CREATE OR REPLACE FUNCTION public.overlord_accounts()
  RETURNS TABLE(user_id uuid, name text, email text, joined timestamp with time zone, last_sign_in timestamp with time zone, gm_status text, games_run integer, games_played integer, suspended_until timestamp with time zone)
  LANGUAGE plpgsql
  STABLE
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
begin
  if not public.is_site_admin() then
    raise exception 'Only the Overlord can list the accounts.';
  end if;
  return query
    select u.id, p.name, u.email::text, u.created_at, u.last_sign_in_at,
           case when gm.accepted_at is not null then 'game_master' when gm.user_id is not null then 'offered' else 'none' end,
           (select count(*)::int from public.games g where g.gm_user_id = u.id),
           (select count(distinct gp.game_id)::int from public.game_players gp where gp.user_id = u.id),
           case when u.banned_until > now() then u.banned_until end
    from auth.users u
    left join public.profiles p on p.id = u.id
    left join public.game_masters gm on gm.user_id = u.id
    order by u.created_at;
end
$function$;

REVOKE ALL ON FUNCTION "public"."overlord_accounts"() FROM PUBLIC;

REVOKE ALL ON FUNCTION "public"."overlord_accounts"() FROM "anon";

REVOKE ALL ON FUNCTION "public"."overlord_accounts"() FROM "authenticated";

GRANT EXECUTE ON FUNCTION "public"."overlord_accounts"() TO "authenticated";

GRANT EXECUTE ON FUNCTION "public"."overlord_accounts"() TO "service_role";
