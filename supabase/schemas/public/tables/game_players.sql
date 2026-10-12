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

-- One realm per slot number in a game (P0-20). The join form picks the next free number by reading the game's
-- slots; a tab that can't see them would otherwise take a number twice.
CREATE UNIQUE INDEX game_players_one_per_number ON public.game_players USING btree (game_id, player_index);

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

-- The Overlord never holds a realm (P0-32d, D-13): no slot is added or changed to be theirs. Rows for other
-- accounts and bot rows (no account) are untouched. Restrictive: it narrows every other rule.
CREATE POLICY "the Overlord holds no realm (insert)" ON "public"."game_players"
  AS RESTRICTIVE
  FOR INSERT
  TO "authenticated"
  WITH CHECK (((user_id IS DISTINCT FROM ( SELECT auth.uid() AS uid)) OR (NOT ( SELECT public.is_site_admin() AS is_site_admin))));

CREATE POLICY "the Overlord holds no realm (update)" ON "public"."game_players"
  AS RESTRICTIVE
  FOR UPDATE
  TO "authenticated"
  USING (true)
  WITH CHECK (((user_id IS DISTINCT FROM ( SELECT auth.uid() AS uid)) OR (NOT ( SELECT public.is_site_admin() AS is_site_admin))));

REVOKE ALL ON TABLE "public"."game_players" FROM "anon";

REVOKE ALL ON TABLE "public"."game_players" FROM "authenticated";

GRANT DELETE, INSERT, SELECT, UPDATE ON TABLE "public"."game_players" TO "authenticated";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."game_players" TO "service_role";

REVOKE ALL ON TABLE "public"."game_players" FROM "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."game_players" TO "postgres";
