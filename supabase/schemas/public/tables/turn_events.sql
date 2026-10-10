CREATE TABLE "public"."turn_events" (
  "id"             bigint                   NOT NULL DEFAULT nextval('public.turn_events_id_seq'::regclass),
  "game_id"        text                     NOT NULL,
  "turn"           integer                  NOT NULL,
  "player_index"   integer                  NOT NULL,
  "is_bot"         boolean                  NOT NULL DEFAULT false,
  "bot_difficulty" text,
  "realm"          text,
  "race"           text,
  "alignment"      text,
  "orders"         jsonb,
  "pre"            jsonb,
  "post"           jsonb,
  "outcomes"       jsonb,
  "build"          text,
  "created_at"     timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "turn_events_game_id_turn_player_index_key" UNIQUE (game_id, turn, player_index),
  CONSTRAINT "turn_events_pkey" PRIMARY KEY (id)
);

ALTER TABLE "public"."turn_events"
  ENABLE ROW LEVEL SECURITY;

ALTER SEQUENCE "public"."turn_events_id_seq" OWNED BY "public"."turn_events"."id";

CREATE INDEX turn_events_game_idx ON public.turn_events USING btree (game_id, turn);

CREATE POLICY "gm rw turn_events" ON "public"."turn_events"
  FOR ALL
  TO "authenticated"
  USING (true)
  WITH CHECK (true);

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."turn_events" TO "anon", "authenticated";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."turn_events" TO "service_role";

REVOKE ALL ON TABLE "public"."turn_events" FROM "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."turn_events" TO "postgres";
