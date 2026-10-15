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

-- The Overlord writes any game's turn log, as its GM does (P0-32e, D-13).
CREATE POLICY "the Overlord writes any turn log" ON "public"."turn_logs"
  FOR ALL
  TO "authenticated"
  USING (( SELECT public.is_site_admin() AS is_site_admin))
  WITH CHECK (( SELECT public.is_site_admin() AS is_site_admin));

-- Revoked GMs keep nothing (P0-32i, R-097): a GM's writes need them still to be a Game Master, or the Overlord. A
-- revoked GM's unfinished games were handed over first (gm_revoke insists), so this stops them changing their finished
-- ones. Restrictive: it narrows every other rule. Reads are untouched.
CREATE POLICY "GM writes need a Game Master (insert)" ON "public"."turn_logs"
  AS RESTRICTIVE
  FOR INSERT
  TO "authenticated"
  WITH CHECK ((( SELECT public.is_site_admin() AS is_site_admin) OR ( SELECT public.is_game_master() AS is_game_master)));

CREATE POLICY "GM writes need a Game Master (update)" ON "public"."turn_logs"
  AS RESTRICTIVE
  FOR UPDATE
  TO "authenticated"
  USING ((( SELECT public.is_site_admin() AS is_site_admin) OR ( SELECT public.is_game_master() AS is_game_master)));

CREATE POLICY "GM writes need a Game Master (delete)" ON "public"."turn_logs"
  AS RESTRICTIVE
  FOR DELETE
  TO "authenticated"
  USING ((( SELECT public.is_site_admin() AS is_site_admin) OR ( SELECT public.is_game_master() AS is_game_master)));

REVOKE ALL ON TABLE "public"."turn_logs" FROM "anon";

REVOKE ALL ON TABLE "public"."turn_logs" FROM "authenticated";

GRANT DELETE, INSERT, SELECT, UPDATE ON TABLE "public"."turn_logs" TO "authenticated";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."turn_logs" TO "service_role";

REVOKE ALL ON TABLE "public"."turn_logs" FROM "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."turn_logs" TO "postgres";
