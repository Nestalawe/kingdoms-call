CREATE TABLE "public"."games" (
  "id"          uuid                     NOT NULL DEFAULT extensions.uuid_generate_v4(),
  "name"        text                     NOT NULL,
  "gm_user_id"  uuid,
  "status"      text                     NOT NULL DEFAULT 'setup'::text,
  "turn"        integer                  NOT NULL DEFAULT 1,
  "max_turns"   integer                  NOT NULL DEFAULT 12,
  "game_state"  jsonb,
  "created_at"  timestamp with time zone DEFAULT now(),
  "updated_at"  timestamp with time zone DEFAULT now(),
  "max_players" integer                  NOT NULL DEFAULT 4,
  "meta"        jsonb,
  -- The GM's switch "Block eliminated realms from sending dispatches" (P0-25, ruling R-075): off, an eliminated or
  -- conceded realm may still post publicly until the game ends; on, it may not post at all. Enforced on screen for now.
  "block_eliminated_msgs" boolean          NOT NULL DEFAULT false,
  CONSTRAINT "games_gm_user_id_fkey" FOREIGN KEY (gm_user_id) REFERENCES auth.users(id) ON DELETE SET NULL,
  CONSTRAINT "games_pkey" PRIMARY KEY (id)
);

COMMENT ON TABLE "public"."games" IS 'One row per game: its settings, turn and status, the world (game_state) and a light summary of it (meta).';

ALTER TABLE "public"."games"
  ENABLE ROW LEVEL SECURITY;

-- Who reads a game (P2-16, ruling D-10): its GM, its players, and the Overlord (the Overlord's rule below); and, while
-- it's in setup, any signed-in account if it's public, or an invited one if it's private. game_state holds JSON as
-- text inside jsonb (the portals write JSON.stringify), or older rows an object: both are read, as get_game_slots
-- does; text that isn't valid JSON reads as a public game.
CREATE POLICY "read games: its GM, its players, and open games in setup" ON "public"."games"
  FOR SELECT
  TO "authenticated"
  USING
    (((gm_user_id = ( SELECT auth.uid() AS uid)) OR public.is_game_member(id) OR ((status = 'setup'::text) AND
    ((COALESCE((CASE jsonb_typeof(game_state) WHEN 'string'::text THEN CASE WHEN pg_input_is_valid((game_state #>>
    '{}'::text[]), 'jsonb'::text) THEN ((game_state #>> '{}'::text[]))::jsonb ELSE NULL::jsonb END ELSE game_state END
    ->> 'visibility'::text), 'public'::text) <> 'private'::text) OR (COALESCE((CASE jsonb_typeof(game_state) WHEN
    'string'::text THEN CASE WHEN pg_input_is_valid((game_state #>> '{}'::text[]), 'jsonb'::text) THEN ((game_state #>>
    '{}'::text[]))::jsonb ELSE NULL::jsonb END ELSE game_state END -> 'invited'::text), '[]'::jsonb) ? (( SELECT
    auth.uid() AS uid))::text)))));

CREATE POLICY "g1" ON "public"."games"
  FOR ALL
  TO PUBLIC
  USING ((gm_user_id = auth.uid()));

-- Only Game Masters create games, in their own name, and the Overlord creates none (P0-32d, D-13). Restrictive:
-- it narrows every other rule that would allow an insert.
CREATE POLICY "only Game Masters create games" ON "public"."games"
  AS RESTRICTIVE
  FOR INSERT
  TO "authenticated"
  WITH CHECK (((gm_user_id = ( SELECT auth.uid() AS uid)) AND ( SELECT public.is_game_master() AS is_game_master) AND (NOT ( SELECT public.is_site_admin() AS is_site_admin))));

-- The Overlord is Master GM of every game (P0-32e, D-13): reads, saves and deletes any game. Creates none (the rule
-- above).
CREATE POLICY "the Overlord reads every game" ON "public"."games"
  FOR SELECT
  TO "authenticated"
  USING (( SELECT public.is_site_admin() AS is_site_admin));

CREATE POLICY "the Overlord saves any game" ON "public"."games"
  FOR UPDATE
  TO "authenticated"
  USING (( SELECT public.is_site_admin() AS is_site_admin))
  WITH CHECK (( SELECT public.is_site_admin() AS is_site_admin));

-- A save never changes who runs the game (P0-32e): a game is handed over only through reassign_game, which checks the
-- new GM. game_gm reads the game as it was before the save. A GM's own rule already kept them as its GM; this stops
-- the Overlord. Restrictive: it narrows every other rule that would allow a save.
CREATE POLICY "a save keeps the game's GM" ON "public"."games"
  AS RESTRICTIVE
  FOR UPDATE
  TO "authenticated"
  USING (true)
  WITH CHECK ((NOT (gm_user_id IS DISTINCT FROM public.game_gm(id))));

-- Revoked GMs keep nothing (P0-32i, R-097): a GM's writes need them still to be a Game Master, or the Overlord. A
-- revoked GM's unfinished games were handed over first (gm_revoke insists), so this stops them changing their finished
-- ones. Restrictive: it narrows every other rule. Reads are untouched.
CREATE POLICY "GM writes need a Game Master (update)" ON "public"."games"
  AS RESTRICTIVE
  FOR UPDATE
  TO "authenticated"
  USING ((( SELECT public.is_site_admin() AS is_site_admin) OR ( SELECT public.is_game_master() AS is_game_master)));

CREATE POLICY "GM writes need a Game Master (delete)" ON "public"."games"
  AS RESTRICTIVE
  FOR DELETE
  TO "authenticated"
  USING ((( SELECT public.is_site_admin() AS is_site_admin) OR ( SELECT public.is_game_master() AS is_game_master)));

CREATE POLICY "the Overlord deletes any game" ON "public"."games"
  FOR DELETE
  TO "authenticated"
  USING (( SELECT public.is_site_admin() AS is_site_admin));

-- Deleting a game removes its Dispatches read markers (P0-23): game_message_reads has no foreign key, and the GM
-- can't read them.
CREATE TRIGGER "games_delete_message_reads" AFTER DELETE ON "public"."games"
  FOR EACH ROW EXECUTE FUNCTION public.games_delete_message_reads();

-- Deleting a game deletes its dispatches, private ones too, which its GM can't see (P0-24).
CREATE TRIGGER "games_delete_messages" AFTER DELETE ON "public"."games"
  FOR EACH ROW EXECUTE FUNCTION public.games_delete_messages();

REVOKE ALL ON TABLE "public"."games" FROM "anon";

REVOKE ALL ON TABLE "public"."games" FROM "authenticated";

GRANT DELETE, INSERT, SELECT, UPDATE ON TABLE "public"."games" TO "authenticated";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."games" TO "service_role";

REVOKE ALL ON TABLE "public"."games" FROM "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."games" TO "postgres";
