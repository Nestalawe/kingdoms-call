-- Is the signed-in account the Overlord (P0-32a)? For later steps' rules, written as
-- `(select public.is_site_admin())` so it's evaluated once per query. Signed-in accounts only.
CREATE OR REPLACE FUNCTION public.is_site_admin()
  RETURNS boolean
  LANGUAGE sql
  STABLE
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
  select exists (select 1 from public.site_admins where user_id = auth.uid())
$function$;

REVOKE ALL ON FUNCTION "public"."is_site_admin"() FROM PUBLIC;

REVOKE ALL ON FUNCTION "public"."is_site_admin"() FROM "anon";

REVOKE ALL ON FUNCTION "public"."is_site_admin"() FROM "authenticated";

GRANT EXECUTE ON FUNCTION "public"."is_site_admin"() TO "authenticated";

GRANT EXECUTE ON FUNCTION "public"."is_site_admin"() TO "service_role";
