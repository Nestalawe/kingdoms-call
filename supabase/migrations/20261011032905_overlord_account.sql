SET local check_function_bodies = off;

CREATE TABLE "public"."site_admins" (
  "one"     boolean                  NOT NULL DEFAULT true,
  "user_id" uuid                     NOT NULL,
  "since"   timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "site_admins_one_check" CHECK (one),
  CONSTRAINT "site_admins_pkey" PRIMARY KEY (one),
  CONSTRAINT "site_admins_user_id_key" UNIQUE (user_id)
);

ALTER TABLE "public"."site_admins"
  ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE "public"."site_admins" FROM "anon", "authenticated";

CREATE OR REPLACE FUNCTION public.is_site_admin()
  RETURNS boolean
  LANGUAGE sql
  STABLE
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
  select exists (select 1 from public.site_admins where user_id = auth.uid())
$function$;

REVOKE ALL ON FUNCTION "public"."is_site_admin"() FROM PUBLIC, "anon";

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
  -- P0-32b adds: refuse an account that's a Game Master (a game_masters row).
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

REVOKE ALL ON FUNCTION "public"."kc_set_overlord"(text, boolean) FROM PUBLIC, "anon", "authenticated", "service_role";

ALTER TABLE "public"."site_admins"
  ADD CONSTRAINT "site_admins_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE RESTRICT;

GRANT EXECUTE ON FUNCTION "public"."is_site_admin"() TO "authenticated";

REVOKE ALL ON FUNCTION "public"."is_site_admin"() FROM "postgres";

GRANT EXECUTE ON FUNCTION "public"."is_site_admin"() TO "postgres";

GRANT EXECUTE ON FUNCTION "public"."is_site_admin"() TO "service_role";

REVOKE ALL ON FUNCTION "public"."kc_set_overlord"(text, boolean) FROM "postgres";

GRANT EXECUTE ON FUNCTION "public"."kc_set_overlord"(text, boolean) TO "postgres";

REVOKE ALL ON TABLE "public"."site_admins" FROM "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."site_admins" TO "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."site_admins" TO "service_role";
