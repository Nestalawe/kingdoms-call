-- Makes the account with this email the Overlord (P0-32a). Run only by the database's own role: the Overlord
-- workflow (.github/workflows/overlord.yml, production, Toby approves each run) and the staging seed; no API
-- role may call it. Refuses an email with no account, an account that runs or plays in any game (the Overlord
-- never plays or GMs), and replacing an existing Overlord unless p_replace. Its messages never contain the
-- email or the account's id: the workflow prints them in a public log.
CREATE OR REPLACE FUNCTION public.kc_set_overlord(p_email text, p_replace boolean DEFAULT false)
  RETURNS text
  LANGUAGE plpgsql
  SET search_path TO ''
  AS $function$
declare
  v_user uuid;
  v_current uuid;
begin
  select id into v_user from auth.users where lower(email) = lower(trim(p_email));
  if v_user is null then
    raise exception 'No account has that email. Sign up with it on the player portal first.';
  end if;
  if exists (select 1 from public.games where gm_user_id = v_user) then
    raise exception 'That account runs a game. The Overlord never runs or plays games: use a separate login.';
  end if;
  if exists (select 1 from public.game_players where user_id = v_user) then
    raise exception 'That account holds a realm in a game. The Overlord never runs or plays games: use a separate login.';
  end if;
  if exists (select 1 from public.game_masters where user_id = v_user) then
    raise exception 'That account is a Game Master, or has been offered GM. The Overlord never runs or plays games: use a separate login.';
  end if;
  select user_id into v_current from public.site_admins;
  if v_current = v_user then
    return 'Overlord already set';
  end if;
  if v_current is not null and not coalesce(p_replace, false) then
    raise exception 'An Overlord is already set. To hand the role over, run again with replace: yes.';
  end if;
  insert into public.site_admins (one, user_id) values (true, v_user)
    on conflict (one) do update set user_id = excluded.user_id, since = now();
  return 'Overlord set';
end
$function$;

REVOKE ALL ON FUNCTION "public"."kc_set_overlord"(text, boolean) FROM PUBLIC;

REVOKE ALL ON FUNCTION "public"."kc_set_overlord"(text, boolean) FROM "anon";

REVOKE ALL ON FUNCTION "public"."kc_set_overlord"(text, boolean) FROM "authenticated";

REVOKE ALL ON FUNCTION "public"."kc_set_overlord"(text, boolean) FROM "service_role";
