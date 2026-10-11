-- The database's version (P0-34): the newest migration applied to it. Every page that uses the database
-- calls this before its first read, and stops with "The game is being updated" if it's older than the page
-- needs (KC_DB_MIN). Signed-out visitors call it too (the Hall of Fame). Not private: the migrations are
-- in the public repo.
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

REVOKE ALL ON FUNCTION "public"."kc_db_version"() FROM "anon";

REVOKE ALL ON FUNCTION "public"."kc_db_version"() FROM "authenticated";

GRANT EXECUTE ON FUNCTION "public"."kc_db_version"() TO "anon";

GRANT EXECUTE ON FUNCTION "public"."kc_db_version"() TO "authenticated";

GRANT EXECUTE ON FUNCTION "public"."kc_db_version"() TO "service_role";
