CREATE TABLE "public"."turn_logs" (
  "id"           uuid                     NOT NULL DEFAULT extensions.uuid_generate_v4(),
  "game_id"      uuid                     NOT NULL,
  "player_index" integer                  NOT NULL,
  "turn"         integer                  NOT NULL,
  "entries"      jsonb                    NOT NULL DEFAULT '[]'::jsonb,
  "created_at"   timestamp with time zone DEFAULT now(),
  CONSTRAINT "turn_logs_game_id_fkey" FOREIGN KEY (game_id) REFERENCES public.games(id) ON DELETE CASCADE,
  CONSTRAINT "turn_logs_pkey" PRIMARY KEY (id)
);

ALTER TABLE "public"."turn_logs"
  ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tl1" ON "public"."turn_logs"
  FOR ALL
  TO PUBLIC
  USING ((game_id IN ( SELECT games.id
   FROM public.games
  WHERE (games.gm_user_id = auth.uid()))));

CREATE POLICY "tl2" ON "public"."turn_logs"
  FOR SELECT
  TO PUBLIC
  USING (true);

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."turn_logs" TO "anon", "authenticated";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."turn_logs" TO "service_role";

REVOKE ALL ON TABLE "public"."turn_logs" FROM "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."turn_logs" TO "postgres";
