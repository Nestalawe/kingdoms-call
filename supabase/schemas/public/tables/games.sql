CREATE TABLE "public"."games" (
  "id"          uuid                     NOT NULL DEFAULT extensions.uuid_generate_v4(),
  "name"        text                     NOT NULL,
  "gm_user_id"  uuid,
  "status"      text                     NOT NULL DEFAULT 'setup'::text,
  "turn"        integer                  NOT NULL DEFAULT 1,
  "max_turns"   integer                  NOT NULL DEFAULT 12,
  "game_state"  jsonb,
  "created_at"  timestamp with time zone DEFAULT now(),
  "updated_at"  timestamp with time zone DEFAULT now(),
  "max_players" integer                  NOT NULL DEFAULT 4,
  "meta"        jsonb,
  CONSTRAINT "games_gm_user_id_fkey" FOREIGN KEY (gm_user_id) REFERENCES auth.users(id) ON DELETE SET NULL,
  CONSTRAINT "games_pkey" PRIMARY KEY (id)
);

ALTER TABLE "public"."games"
  ENABLE ROW LEVEL SECURITY;

CREATE POLICY "read games (gm, public, or invited to private setup)" ON "public"."games"
  FOR SELECT
  TO "authenticated"
  USING
    (((gm_user_id = auth.uid()) OR (status <> 'setup'::text) OR (COALESCE((game_state ->> 'visibility'::text), 'public'::text) <> 'private'::text) OR ((game_state ->
    'invited'::text) ? (auth.uid())::text)));

CREATE POLICY "allow_insert_games" ON "public"."games"
  FOR INSERT
  TO "anon", "authenticated"
  WITH CHECK (true);

CREATE POLICY "allow_read_games" ON "public"."games"
  FOR SELECT
  TO "anon", "authenticated"
  USING (true);

CREATE POLICY "allow_update_games" ON "public"."games"
  FOR UPDATE
  TO "anon", "authenticated"
  USING (true);

CREATE POLICY "anyone_can_read_games" ON "public"."games"
  FOR SELECT
  TO "anon", "authenticated"
  USING (true);

CREATE POLICY "g1" ON "public"."games"
  FOR ALL
  TO PUBLIC
  USING ((gm_user_id = auth.uid()));

CREATE POLICY "g2" ON "public"."games"
  FOR SELECT
  TO PUBLIC
  USING ((status = 'setup'::text));

CREATE POLICY "g3" ON "public"."games"
  FOR SELECT
  TO PUBLIC
  USING (true);

CREATE POLICY "gm_can_insert_games" ON "public"."games"
  FOR INSERT
  TO "anon", "authenticated"
  WITH CHECK (true);

CREATE POLICY "gm_can_update_own_games" ON "public"."games"
  FOR UPDATE
  TO "anon", "authenticated"
  USING (true);

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."games" TO "anon", "authenticated";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."games" TO "service_role";

REVOKE ALL ON TABLE "public"."games" FROM "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."games" TO "postgres";
