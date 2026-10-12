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

-- Read and written only by the game's GM, or the Overlord (P0-22, ruling D-09). game_id is text with no foreign
-- key: a deleted game's leftovers are the Overlord's to clear.
CREATE POLICY "game's GM or the Overlord" ON "public"."turn_events"
  FOR ALL
  TO "authenticated"
  USING ((( SELECT public.is_site_admin() AS is_site_admin) OR (game_id IN ( SELECT (g.id)::text AS id
   FROM public.games g
  WHERE (g.gm_user_id = ( SELECT auth.uid() AS uid))))))
  WITH CHECK ((( SELECT public.is_site_admin() AS is_site_admin) OR (game_id IN ( SELECT (g.id)::text AS id
   FROM public.games g
  WHERE (g.gm_user_id = ( SELECT auth.uid() AS uid))))));

REVOKE ALL ON TABLE "public"."turn_events" FROM "anon";

REVOKE ALL ON TABLE "public"."turn_events" FROM "authenticated";

GRANT DELETE, INSERT, SELECT, UPDATE ON TABLE "public"."turn_events" TO "authenticated";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."turn_events" TO "service_role";

REVOKE ALL ON TABLE "public"."turn_events" FROM "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."turn_events" TO "postgres";
