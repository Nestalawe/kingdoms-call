CREATE TABLE "public"."game_results" (
  "id"             bigint                   NOT NULL DEFAULT nextval('public.game_results_id_seq'::regclass),
  "game_id"        text                     NOT NULL,
  "game_name"      text,
  "player_index"   integer                  NOT NULL,
  "is_bot"         boolean                  NOT NULL DEFAULT false,
  "bot_difficulty" text,
  "realm"          text,
  "race"           text,
  "alignment"      text,
  "rank"           integer,
  "score"          integer,
  "winner"         boolean                  NOT NULL DEFAULT false,
  "victory"        text,
  "turns"          integer,
  "out_turn"       integer,
  "out_how"        text,
  "setup"          jsonb,
  "final"          jsonb,
  "build"          text,
  "created_at"     timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "game_results_game_id_player_index_key" UNIQUE (game_id, player_index),
  CONSTRAINT "game_results_pkey" PRIMARY KEY (id)
);

ALTER TABLE "public"."game_results"
  ENABLE ROW LEVEL SECURITY;

ALTER SEQUENCE "public"."game_results_id_seq" OWNED BY "public"."game_results"."id";

CREATE POLICY "gm rw game_results" ON "public"."game_results"
  FOR ALL
  TO "authenticated"
  USING (true)
  WITH CHECK (true);

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."game_results" TO "anon", "authenticated";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."game_results" TO "service_role";

REVOKE ALL ON TABLE "public"."game_results" FROM "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."game_results" TO "postgres";
