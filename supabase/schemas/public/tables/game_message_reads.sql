CREATE TABLE "public"."game_message_reads" (
  "game_id"      text                     NOT NULL,
  "player_index" integer                  NOT NULL,
  "user_id"      uuid                     NOT NULL,
  "reads"        jsonb                    NOT NULL DEFAULT '{}'::jsonb,
  "updated_at"   timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "game_message_reads_pkey" PRIMARY KEY (game_id, player_index)
);

ALTER TABLE "public"."game_message_reads"
  ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own game_message_reads" ON "public"."game_message_reads"
  FOR ALL
  TO "authenticated"
  USING ((user_id = auth.uid()))
  WITH CHECK ((user_id = auth.uid()));

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."game_message_reads" TO "anon", "authenticated";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."game_message_reads" TO "service_role";

REVOKE ALL ON TABLE "public"."game_message_reads" FROM "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."game_message_reads" TO "postgres";
