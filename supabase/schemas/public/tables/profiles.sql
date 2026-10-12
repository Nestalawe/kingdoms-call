CREATE TABLE "public"."profiles" (
  "id"         uuid                     NOT NULL,
  "email"      text,
  "name"       text,
  "created_at" timestamp with time zone DEFAULT now(),
  CONSTRAINT "profiles_id_fkey" FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE,
  CONSTRAINT "profiles_pkey" PRIMARY KEY (id)
);

ALTER TABLE "public"."profiles"
  ENABLE ROW LEVEL SECURITY;

CREATE POLICY "profiles: self read, GMs read all" ON "public"."profiles"
  FOR SELECT
  TO "authenticated"
  USING (((id = auth.uid()) OR (EXISTS ( SELECT 1
   FROM public.games g
  WHERE (g.gm_user_id = auth.uid())))));

CREATE POLICY "signed-in users can read profiles" ON "public"."profiles"
  FOR SELECT
  TO "authenticated"
  USING (true);

-- An account creates and renames its own profile; nobody deletes one through the API (P0-31).
CREATE POLICY "own profile: create" ON "public"."profiles"
  FOR INSERT
  TO "authenticated"
  WITH CHECK ((id = ( SELECT auth.uid() AS uid)));

CREATE POLICY "own profile: rename" ON "public"."profiles"
  FOR UPDATE
  TO "authenticated"
  USING ((id = ( SELECT auth.uid() AS uid)))
  WITH CHECK ((id = ( SELECT auth.uid() AS uid)));

REVOKE ALL ON TABLE "public"."profiles" FROM "anon";

REVOKE ALL ON TABLE "public"."profiles" FROM "authenticated";

GRANT INSERT, UPDATE ON TABLE "public"."profiles" TO "authenticated";

-- Signed-in accounts read a profile's id, name and joined date, never its email, their own included (P0-31,
-- ruling D-08): a column privilege, since a row rule can't hide one column. An account's own email comes from
-- its sign-in session.
GRANT SELECT ("id", "name", "created_at") ON TABLE "public"."profiles" TO "authenticated";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."profiles" TO "service_role";

REVOKE ALL ON TABLE "public"."profiles" FROM "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."profiles" TO "postgres";
