-- Emails readable only through the sign-in session; profiles never deleted through the API (plan step P0-31,
-- ruling D-08). Generated from supabase/schemas/. Needs the site from P0-31's site PR (#59), which reads only
-- id, name and created_at.

DROP POLICY "p1" ON "public"."profiles";

CREATE POLICY "own profile: create" ON "public"."profiles"
  FOR INSERT
  TO "authenticated"
  WITH CHECK ((id = ( SELECT auth.uid() AS uid)));

CREATE POLICY "own profile: rename" ON "public"."profiles"
  FOR UPDATE
  TO "authenticated"
  USING ((id = ( SELECT auth.uid() AS uid)))
  WITH CHECK ((id = ( SELECT auth.uid() AS uid)));

REVOKE ALL ON TABLE "public"."profiles" FROM "authenticated";

REVOKE ALL ("created_at") ON TABLE "public"."profiles" FROM "authenticated";

GRANT SELECT ("created_at") ON TABLE "public"."profiles" TO "authenticated";

REVOKE ALL ("id") ON TABLE "public"."profiles" FROM "authenticated";

GRANT SELECT ("id") ON TABLE "public"."profiles" TO "authenticated";

REVOKE ALL ("name") ON TABLE "public"."profiles" FROM "authenticated";

GRANT SELECT ("name") ON TABLE "public"."profiles" TO "authenticated";

GRANT INSERT, UPDATE ON TABLE "public"."profiles" TO "authenticated";
