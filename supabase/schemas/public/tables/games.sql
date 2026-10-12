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

COMMENT ON TABLE "public"."games" IS 'One row per game: its settings, turn and status, the world (game_state) and a light summary of it (meta).';

ALTER TABLE "public"."games"
  ENABLE ROW LEVEL SECURITY;

CREATE POLICY "read games (gm, public, or invited to private setup)" ON "public"."games"
  FOR SELECT
  TO "authenticated"
  USING
    (((gm_user_id = auth.uid()) OR (status <> 'setup'::text) OR (COALESCE((game_state ->> 'visibility'::text), 'public'::text) <> 'private'::text) OR ((game_state ->
    'invited'::text) ? (auth.uid())::text)));

CREATE POLICY "allow_read_games" ON "public"."games"
  FOR SELECT
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

-- Only Game Masters create games, in their own name, and the Overlord creates none (P0-32d, D-13). Restrictive:
-- it narrows every other rule that would allow an insert.
CREATE POLICY "only Game Masters create games" ON "public"."games"
  AS RESTRICTIVE
  FOR INSERT
  TO "authenticated"
  WITH CHECK (((gm_user_id = ( SELECT auth.uid() AS uid)) AND ( SELECT public.is_game_master() AS is_game_master) AND (NOT ( SELECT public.is_site_admin() AS is_site_admin))));

-- Deleting a game removes its Dispatches read markers (P0-23): game_message_reads has no foreign key, and the GM
-- can't read them.
CREATE TRIGGER "games_delete_message_reads" AFTER DELETE ON "public"."games"
  FOR EACH ROW EXECUTE FUNCTION public.games_delete_message_reads();

REVOKE ALL ON TABLE "public"."games" FROM "anon";

REVOKE ALL ON TABLE "public"."games" FROM "authenticated";

GRANT DELETE, INSERT, SELECT, UPDATE ON TABLE "public"."games" TO "authenticated";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."games" TO "service_role";

REVOKE ALL ON TABLE "public"."games" FROM "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."games" TO "postgres";
