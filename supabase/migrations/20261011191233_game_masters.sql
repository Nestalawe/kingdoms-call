SET local check_function_bodies = off;

CREATE TABLE "public"."game_masters" (
  "user_id"     uuid                     NOT NULL,
  "offered_at"  timestamp with time zone NOT NULL DEFAULT now(),
  "offered_by"  uuid,
  "accepted_at" timestamp with time zone,
  CONSTRAINT "game_masters_pkey" PRIMARY KEY (user_id)
);

ALTER TABLE "public"."game_masters"
  ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE "public"."game_masters" FROM "anon";

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

REVOKE ALL ON FUNCTION "public"."gm_accept_offer"() FROM PUBLIC, "anon";

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

REVOKE ALL ON FUNCTION "public"."gm_decline_offer"() FROM PUBLIC, "anon";

CREATE OR REPLACE FUNCTION public.gm_offer (
  p_user uuid
)
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

REVOKE ALL ON FUNCTION "public"."gm_offer"(uuid) FROM PUBLIC, "anon";

CREATE OR REPLACE FUNCTION public.gm_revoke (
  p_user uuid
)
  RETURNS void
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
begin
  if not public.is_site_admin() then
    raise exception 'Only the Overlord can revoke a Game Master.';
  end if;
  if not exists (select 1 from public.game_masters where user_id = p_user and accepted_at is not null) then
    raise exception 'That account isn''t a Game Master.';
  end if;
  if exists (select 1 from public.games where gm_user_id = p_user and status <> 'complete') then
    raise exception 'That Game Master runs an unfinished game: hand it over first.';
  end if;
  delete from public.game_masters where user_id = p_user;
end
$function$;

REVOKE ALL ON FUNCTION "public"."gm_revoke"(uuid) FROM PUBLIC, "anon";

CREATE OR REPLACE FUNCTION public.gm_withdraw_offer (
  p_user uuid
)
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

REVOKE ALL ON FUNCTION "public"."gm_withdraw_offer"(uuid) FROM PUBLIC, "anon";

CREATE OR REPLACE FUNCTION public.is_game_master()
  RETURNS boolean
  LANGUAGE sql
  STABLE
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
  select exists (select 1 from public.game_masters where user_id = auth.uid() and accepted_at is not null)
$function$;

REVOKE ALL ON FUNCTION "public"."is_game_master"() FROM PUBLIC, "anon";

CREATE OR REPLACE FUNCTION public.kc_set_overlord (
  p_email   text,
  p_replace boolean DEFAULT false
)
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

CREATE OR REPLACE FUNCTION public.overlord_accounts()
  RETURNS TABLE (
    user_id      uuid,
    name         text,
    email        text,
    joined       timestamp with time zone,
    last_sign_in timestamp with time zone,
    gm_status    text,
    games_run    integer,
    games_played integer
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
           (select count(distinct gp.game_id)::int from public.game_players gp where gp.user_id = u.id)
    from auth.users u
    left join public.profiles p on p.id = u.id
    left join public.game_masters gm on gm.user_id = u.id
    order by u.created_at;
end
$function$;

REVOKE ALL ON FUNCTION "public"."overlord_accounts"() FROM PUBLIC, "anon";

ALTER TABLE "public"."game_masters"
  ADD CONSTRAINT "game_masters_offered_by_fkey" FOREIGN KEY (offered_by) REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE "public"."game_masters"
  ADD CONSTRAINT "game_masters_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

CREATE POLICY "own row, or the Overlord" ON "public"."game_masters"
  FOR SELECT
  TO "authenticated"
  USING (((user_id = ( SELECT auth.uid() AS uid)) OR ( SELECT public.is_site_admin() AS is_site_admin)));

COMMENT ON TABLE "public"."game_masters" IS 'One row per account offered Game Master by the Overlord: an open offer (accepted_at null) or a Game Master (accepted).';

GRANT EXECUTE ON FUNCTION "public"."gm_accept_offer"() TO "authenticated";

REVOKE ALL ON FUNCTION "public"."gm_accept_offer"() FROM "postgres";

GRANT EXECUTE ON FUNCTION "public"."gm_accept_offer"() TO "postgres";

GRANT EXECUTE ON FUNCTION "public"."gm_accept_offer"() TO "service_role";

GRANT EXECUTE ON FUNCTION "public"."gm_decline_offer"() TO "authenticated";

REVOKE ALL ON FUNCTION "public"."gm_decline_offer"() FROM "postgres";

GRANT EXECUTE ON FUNCTION "public"."gm_decline_offer"() TO "postgres";

GRANT EXECUTE ON FUNCTION "public"."gm_decline_offer"() TO "service_role";

GRANT EXECUTE ON FUNCTION "public"."gm_offer"(uuid) TO "authenticated";

REVOKE ALL ON FUNCTION "public"."gm_offer"(uuid) FROM "postgres";

GRANT EXECUTE ON FUNCTION "public"."gm_offer"(uuid) TO "postgres";

GRANT EXECUTE ON FUNCTION "public"."gm_offer"(uuid) TO "service_role";

GRANT EXECUTE ON FUNCTION "public"."gm_revoke"(uuid) TO "authenticated";

REVOKE ALL ON FUNCTION "public"."gm_revoke"(uuid) FROM "postgres";

GRANT EXECUTE ON FUNCTION "public"."gm_revoke"(uuid) TO "postgres";

GRANT EXECUTE ON FUNCTION "public"."gm_revoke"(uuid) TO "service_role";

GRANT EXECUTE ON FUNCTION "public"."gm_withdraw_offer"(uuid) TO "authenticated";

REVOKE ALL ON FUNCTION "public"."gm_withdraw_offer"(uuid) FROM "postgres";

GRANT EXECUTE ON FUNCTION "public"."gm_withdraw_offer"(uuid) TO "postgres";

GRANT EXECUTE ON FUNCTION "public"."gm_withdraw_offer"(uuid) TO "service_role";

GRANT EXECUTE ON FUNCTION "public"."is_game_master"() TO "authenticated";

REVOKE ALL ON FUNCTION "public"."is_game_master"() FROM "postgres";

GRANT EXECUTE ON FUNCTION "public"."is_game_master"() TO "postgres";

GRANT EXECUTE ON FUNCTION "public"."is_game_master"() TO "service_role";

GRANT EXECUTE ON FUNCTION "public"."overlord_accounts"() TO "authenticated";

REVOKE ALL ON FUNCTION "public"."overlord_accounts"() FROM "postgres";

GRANT EXECUTE ON FUNCTION "public"."overlord_accounts"() TO "postgres";

GRANT EXECUTE ON FUNCTION "public"."overlord_accounts"() TO "service_role";

REVOKE ALL ON TABLE "public"."game_masters" FROM "authenticated";

GRANT SELECT ON TABLE "public"."game_masters" TO "authenticated";

REVOKE ALL ON TABLE "public"."game_masters" FROM "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."game_masters" TO "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."game_masters" TO "service_role";
