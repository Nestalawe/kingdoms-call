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

-- Written by the game's GM, or the Overlord (P0-22, ruling D-09). A record outlives its game: once the game is
-- deleted, the GM named on the record keeps it (to edit, hide or remove). A record is written only for a game
-- that exists.
CREATE POLICY "write game_records: the game's GM or the Overlord" ON "public"."game_records"
  FOR INSERT
  TO "authenticated"
  WITH CHECK ((( SELECT public.is_site_admin() AS is_site_admin) OR (game_id IN ( SELECT (g.id)::text AS id
   FROM public.games g
  WHERE (g.gm_user_id = ( SELECT auth.uid() AS uid))))));

CREATE POLICY "edit game_records: its GM or the Overlord" ON "public"."game_records"
  FOR UPDATE
  TO "authenticated"
  USING ((( SELECT public.is_site_admin() AS is_site_admin) OR (game_id IN ( SELECT (g.id)::text AS id
   FROM public.games g
  WHERE (g.gm_user_id = ( SELECT auth.uid() AS uid)))) OR ((gm_user_id = ( SELECT auth.uid() AS uid)) AND (NOT (EXISTS ( SELECT 1
   FROM public.games g
  WHERE ((g.id)::text = game_records.game_id)))))))
  WITH CHECK ((( SELECT public.is_site_admin() AS is_site_admin) OR (game_id IN ( SELECT (g.id)::text AS id
   FROM public.games g
  WHERE (g.gm_user_id = ( SELECT auth.uid() AS uid)))) OR ((gm_user_id = ( SELECT auth.uid() AS uid)) AND (NOT (EXISTS ( SELECT 1
   FROM public.games g
  WHERE ((g.id)::text = game_records.game_id)))))));

CREATE POLICY "remove game_records: its GM or the Overlord" ON "public"."game_records"
  FOR DELETE
  TO "authenticated"
  USING ((( SELECT public.is_site_admin() AS is_site_admin) OR (game_id IN ( SELECT (g.id)::text AS id
   FROM public.games g
  WHERE (g.gm_user_id = ( SELECT auth.uid() AS uid)))) OR ((gm_user_id = ( SELECT auth.uid() AS uid)) AND (NOT (EXISTS ( SELECT 1
   FROM public.games g
  WHERE ((g.id)::text = game_records.game_id)))))));

-- Revoked GMs keep nothing (P0-32i, R-097): a GM's writes need them still to be a Game Master, or the Overlord. A
-- revoked GM's unfinished games were handed over first (gm_revoke insists), so this stops them changing their finished
-- ones. Restrictive: it narrows every other rule. Reads (public) are untouched.
CREATE POLICY "GM writes need a Game Master (insert)" ON "public"."game_records"
  AS RESTRICTIVE
  FOR INSERT
  TO "authenticated"
  WITH CHECK ((( SELECT public.is_site_admin() AS is_site_admin) OR ( SELECT public.is_game_master() AS is_game_master)));

CREATE POLICY "GM writes need a Game Master (update)" ON "public"."game_records"
  AS RESTRICTIVE
  FOR UPDATE
  TO "authenticated"
  USING ((( SELECT public.is_site_admin() AS is_site_admin) OR ( SELECT public.is_game_master() AS is_game_master)));

CREATE POLICY "GM writes need a Game Master (delete)" ON "public"."game_records"
  AS RESTRICTIVE
  FOR DELETE
  TO "authenticated"
  USING ((( SELECT public.is_site_admin() AS is_site_admin) OR ( SELECT public.is_game_master() AS is_game_master)));

CREATE POLICY "read game_records" ON "public"."game_records"
  FOR SELECT
  TO "anon", "authenticated"
  USING (true);

REVOKE ALL ON TABLE "public"."game_records" FROM "anon";

REVOKE ALL ON TABLE "public"."game_records" FROM "authenticated";

GRANT DELETE, INSERT, SELECT, UPDATE ON TABLE "public"."game_records" TO "authenticated";

GRANT SELECT ON TABLE "public"."game_records" TO "anon";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."game_records" TO "service_role";

REVOKE ALL ON TABLE "public"."game_records" FROM "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."game_records" TO "postgres";
