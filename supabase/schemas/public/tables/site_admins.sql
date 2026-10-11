-- The Overlord (plan step P0-32a, decision D-13): at most one account, above all others. Set only by
-- kc_set_overlord(), run by the Overlord workflow (.github/workflows/overlord.yml) or the staging seed; no
-- API role can read or change this table. Later steps' rules ask public.is_site_admin().
CREATE TABLE "public"."site_admins" (
  "one"     boolean                  NOT NULL DEFAULT true,
  "user_id" uuid                     NOT NULL,
  "since"   timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "site_admins_one_check" CHECK (one),
  CONSTRAINT "site_admins_pkey" PRIMARY KEY (one),
  CONSTRAINT "site_admins_user_id_key" UNIQUE (user_id),
  CONSTRAINT "site_admins_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE RESTRICT
);

ALTER TABLE "public"."site_admins"
  ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE "public"."site_admins" FROM "anon";

REVOKE ALL ON TABLE "public"."site_admins" FROM "authenticated";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."site_admins" TO "service_role";

REVOKE ALL ON TABLE "public"."site_admins" FROM "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."site_admins" TO "postgres";
