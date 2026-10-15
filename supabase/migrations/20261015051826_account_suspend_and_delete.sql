SET local check_function_bodies = off;

DROP FUNCTION "public"."overlord_accounts"();

CREATE OR REPLACE FUNCTION public.account_delete (
  p_user uuid
)
  RETURNS void
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
begin
  if not public.is_site_admin() then
    raise exception 'Only the Overlord can delete an account.';
  end if;
  if exists (select 1 from public.site_admins where user_id = p_user) then
    raise exception 'This doesn''t work on the Overlord''s own account.';
  end if;
  if not exists (select 1 from auth.users where id = p_user) then
    raise exception 'No such account.';
  end if;
  if exists (select 1 from public.games where gm_user_id = p_user and status <> 'complete') then
    raise exception 'That account runs an unfinished game: hand it over first.';
  end if;
  if exists (select 1 from public.game_players gp join public.games g on g.id = gp.game_id
             where gp.user_id = p_user and g.status <> 'complete') then
    raise exception 'That account plays in an unfinished game: suspend it instead until the game ends.';
  end if;
  delete from public.game_message_reads where user_id = p_user;
  delete from auth.users where id = p_user;
end
$function$;

REVOKE ALL ON FUNCTION "public"."account_delete"(uuid) FROM PUBLIC, "anon";

CREATE OR REPLACE FUNCTION public.account_suspend (
  p_user  uuid,
  p_until timestamp with time zone
)
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

REVOKE ALL ON FUNCTION "public"."account_suspend"(uuid, timestamp WITH time zone) FROM PUBLIC, "anon";

CREATE OR REPLACE FUNCTION public.account_unsuspend (
  p_user uuid
)
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

REVOKE ALL ON FUNCTION "public"."account_unsuspend"(uuid) FROM PUBLIC, "anon";

CREATE OR REPLACE FUNCTION public.overlord_accounts()
  RETURNS TABLE (
    user_id         uuid,
    name            text,
    email           text,
    joined          timestamp with time zone,
    last_sign_in    timestamp with time zone,
    gm_status       text,
    games_run       integer,
    games_played    integer,
    suspended_until timestamp with time zone
  )
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

REVOKE ALL ON FUNCTION "public"."overlord_accounts"() FROM PUBLIC, "anon";

GRANT EXECUTE ON FUNCTION "public"."account_delete"(uuid) TO "authenticated";

REVOKE ALL ON FUNCTION "public"."account_delete"(uuid) FROM "postgres";

GRANT EXECUTE ON FUNCTION "public"."account_delete"(uuid) TO "postgres";

GRANT EXECUTE ON FUNCTION "public"."account_delete"(uuid) TO "service_role";

GRANT EXECUTE ON FUNCTION "public"."account_suspend"(uuid, timestamp WITH time zone) TO "authenticated";

REVOKE ALL ON FUNCTION "public"."account_suspend"(uuid, timestamp WITH time zone) FROM "postgres";

GRANT EXECUTE ON FUNCTION "public"."account_suspend"(uuid, timestamp WITH time zone) TO "postgres";

GRANT EXECUTE ON FUNCTION "public"."account_suspend"(uuid, timestamp WITH time zone) TO "service_role";

GRANT EXECUTE ON FUNCTION "public"."account_unsuspend"(uuid) TO "authenticated";

REVOKE ALL ON FUNCTION "public"."account_unsuspend"(uuid) FROM "postgres";

GRANT EXECUTE ON FUNCTION "public"."account_unsuspend"(uuid) TO "postgres";

GRANT EXECUTE ON FUNCTION "public"."account_unsuspend"(uuid) TO "service_role";

GRANT EXECUTE ON FUNCTION "public"."overlord_accounts"() TO "authenticated";

REVOKE ALL ON FUNCTION "public"."overlord_accounts"() FROM "postgres";

GRANT EXECUTE ON FUNCTION "public"."overlord_accounts"() TO "postgres";

GRANT EXECUTE ON FUNCTION "public"."overlord_accounts"() TO "service_role";
