-- Game Masters by offer (plan step P0-32b, decision D-13): one row per account the Overlord has offered GM
-- to. accepted_at is null while the offer is open; once accepted, the account is a Game Master. Written only
-- by the gm_* functions (no API role writes it directly); an account reads its own row, the Overlord reads
-- every row. offered_by is null for the Game Masters made automatically when this went live (everyone who
-- ran a game then).
CREATE TABLE "public"."game_masters" (
  "user_id"     uuid                     NOT NULL,
  "offered_at"  timestamp with time zone NOT NULL DEFAULT now(),
  "offered_by"  uuid,
  "accepted_at" timestamp with time zone,
  CONSTRAINT "game_masters_pkey" PRIMARY KEY (user_id),
  CONSTRAINT "game_masters_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE,
  CONSTRAINT "game_masters_offered_by_fkey" FOREIGN KEY (offered_by) REFERENCES auth.users(id) ON DELETE SET NULL
);

COMMENT ON TABLE "public"."game_masters" IS 'One row per account offered Game Master by the Overlord: an open offer (accepted_at null) or a Game Master (accepted).';

ALTER TABLE "public"."game_masters"
  ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own row, or the Overlord" ON "public"."game_masters"
  FOR SELECT
  TO authenticated
  USING (((user_id = ( SELECT auth.uid() AS uid)) OR ( SELECT public.is_site_admin() AS is_site_admin)));

REVOKE ALL ON TABLE "public"."game_masters" FROM "anon";

REVOKE ALL ON TABLE "public"."game_masters" FROM "authenticated";

GRANT SELECT ON TABLE "public"."game_masters" TO "authenticated";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."game_masters" TO "service_role";

REVOKE ALL ON TABLE "public"."game_masters" FROM "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."game_masters" TO "postgres";
