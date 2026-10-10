CREATE TABLE "public"."game_records" (
  "game_id"       text                     NOT NULL,
  "game_name"     text,
  "gm_user_id"    uuid,
  "started_at"    timestamp with time zone,
  "finished_at"   timestamp with time zone,
  "turns"         integer,
  "winner_realm"  text,
  "winner_player" text,
  "winner_is_bot" boolean,
  "victory"       text,
  "setup"         jsonb,
  "standings"     jsonb,
  "records"       jsonb,
  "totals"        jsonb,
  "note"          text,
  "hidden"        boolean                  NOT NULL DEFAULT false,
  "build"         text,
  "created_at"    timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "game_records_pkey" PRIMARY KEY (game_id)
);

ALTER TABLE "public"."game_records"
  ENABLE ROW LEVEL SECURITY;

CREATE POLICY "gm write game_records" ON "public"."game_records"
  FOR ALL
  TO "authenticated"
  USING ((EXISTS ( SELECT 1
   FROM public.games g
  WHERE (g.gm_user_id = auth.uid()))))
  WITH CHECK ((EXISTS ( SELECT 1
   FROM public.games g
  WHERE (g.gm_user_id = auth.uid()))));

CREATE POLICY "read game_records" ON "public"."game_records"
  FOR SELECT
  TO "anon", "authenticated"
  USING (true);

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."game_records" TO "anon", "authenticated";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."game_records" TO "service_role";

REVOKE ALL ON TABLE "public"."game_records" FROM "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."game_records" TO "postgres";
