CREATE TABLE "public"."game_players" (
  "id"                uuid                     NOT NULL DEFAULT extensions.uuid_generate_v4(),
  "game_id"           uuid                     NOT NULL,
  "user_id"           uuid,
  "player_index"      integer                  NOT NULL,
  "display_name"      text                     NOT NULL,
  "invite_code"       text                     DEFAULT substr(md5((random())::text), 0, 9),
  "orders_submitted"  boolean                  NOT NULL DEFAULT false,
  "turn_report"       jsonb,
  "orders"            jsonb,
  "last_submitted_at" timestamp with time zone,
  "created_at"        timestamp with time zone DEFAULT now(),
  CONSTRAINT "game_players_invite_code_key" UNIQUE (invite_code),
  CONSTRAINT "game_players_pkey" PRIMARY KEY (id),
  CONSTRAINT "game_players_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE SET NULL,
  CONSTRAINT "game_players_game_id_fkey" FOREIGN KEY (game_id) REFERENCES public.games(id) ON DELETE CASCADE
);

ALTER TABLE "public"."game_players"
  ENABLE ROW LEVEL SECURITY;

CREATE UNIQUE INDEX game_players_one_per_user ON public.game_players USING btree (game_id, user_id);

CREATE POLICY "gp1" ON "public"."game_players"
  FOR SELECT
  TO PUBLIC
  USING (true);

CREATE POLICY "gp2" ON "public"."game_players"
  FOR INSERT
  TO PUBLIC
  WITH CHECK ((user_id = auth.uid()));

CREATE POLICY "gp3" ON "public"."game_players"
  FOR UPDATE
  TO PUBLIC
  USING ((user_id = auth.uid()));

CREATE POLICY "gp4" ON "public"."game_players"
  FOR INSERT
  TO PUBLIC
  WITH CHECK ((game_id IN ( SELECT games.id
   FROM public.games
  WHERE (games.gm_user_id = auth.uid()))));

CREATE POLICY "gp5" ON "public"."game_players"
  FOR UPDATE
  TO PUBLIC
  USING ((game_id IN ( SELECT games.id
   FROM public.games
  WHERE (games.gm_user_id = auth.uid()))));

CREATE POLICY "gp6" ON "public"."game_players"
  FOR DELETE
  TO PUBLIC
  USING ((game_id IN ( SELECT games.id
   FROM public.games
  WHERE (games.gm_user_id = auth.uid()))));

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."game_players" TO "anon", "authenticated";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."game_players" TO "service_role";

REVOKE ALL ON TABLE "public"."game_players" FROM "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."game_players" TO "postgres";
