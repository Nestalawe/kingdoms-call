SET local check_function_bodies = off;

CREATE OR REPLACE FUNCTION public.kc_db_version()
  RETURNS text
  LANGUAGE sql
  STABLE
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
  select max(version) from supabase_migrations.schema_migrations
$function$;

REVOKE ALL ON FUNCTION "public"."kc_db_version"() FROM PUBLIC;

GRANT EXECUTE ON FUNCTION "public"."kc_db_version"() TO "anon", "authenticated";

REVOKE ALL ON FUNCTION "public"."kc_db_version"() FROM "postgres";

GRANT EXECUTE ON FUNCTION "public"."kc_db_version"() TO "postgres";

GRANT EXECUTE ON FUNCTION "public"."kc_db_version"() TO "service_role";
