-- Reported dispatches (plan step P0-24, rulings D-01 and D-13g): a player reports a dispatch they received, so the
-- game's GM (or, when the GM holds a realm in that game, the Overlord) can see it. One report per dispatch per player;
-- deleting the dispatch deletes its reports. Read through gm_reported_messages(); a player sees their own reports.
CREATE TABLE "public"."message_reports" (
  "id"               bigint                   GENERATED ALWAYS AS IDENTITY NOT NULL,
  "message_id"       bigint                   NOT NULL,
  "game_id"          text                     NOT NULL,
  "reporter_index"   integer                  NOT NULL,
  "reporter_user_id" uuid                     NOT NULL DEFAULT auth.uid(),
  "reason"           text,
  "created_at"       timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "message_reports_pkey" PRIMARY KEY (id),
  CONSTRAINT "message_reports_message_id_fkey" FOREIGN KEY (message_id) REFERENCES public.game_messages(id) ON DELETE CASCADE,
  CONSTRAINT "message_reports_once" UNIQUE (message_id, reporter_user_id),
  CONSTRAINT "message_reports_reason_len" CHECK (((reason IS NULL) OR (char_length(reason) <= 500)))
);

COMMENT ON TABLE "public"."message_reports" IS 'One row per dispatch a player has reported: to the game''s GM, or the Overlord when the GM plays in that game (P0-24).';

ALTER TABLE "public"."message_reports"
  ENABLE ROW LEVEL SECURITY;

-- The reporter: the realm they play in that game, reporting a dispatch addressed to them (or public), not their own,
-- that they can read (the game_messages subquery runs under its read rule).
CREATE POLICY "report a received dispatch" ON "public"."message_reports"
  FOR INSERT
  TO "authenticated"
  WITH CHECK (((reporter_user_id = ( SELECT auth.uid() AS uid)) AND (EXISTS ( SELECT 1
   FROM public.game_players gp
  WHERE ((gp.game_id = CASE WHEN pg_input_is_valid(message_reports.game_id, 'uuid'::text) THEN (message_reports.game_id)::uuid ELSE NULL::uuid END) AND (gp.player_index = message_reports.reporter_index) AND (gp.user_id = ( SELECT auth.uid() AS uid))))) AND (EXISTS ( SELECT 1
   FROM public.game_messages m
  WHERE ((m.id = message_reports.message_id) AND (m.game_id = message_reports.game_id) AND (m.from_user_id <> ( SELECT auth.uid() AS uid)) AND ((m.scope = 'public'::text) OR (message_reports.reporter_index = ANY (m.to_indexes))))))));

CREATE POLICY "own reports" ON "public"."message_reports"
  FOR SELECT
  TO "authenticated"
  USING ((reporter_user_id = ( SELECT auth.uid() AS uid)));

REVOKE ALL ON TABLE "public"."message_reports" FROM "anon";

REVOKE ALL ON TABLE "public"."message_reports" FROM "authenticated";

GRANT INSERT, SELECT ON TABLE "public"."message_reports" TO "authenticated";

-- The id is an identity column, so inserting needs no right on its sequence: no API role gets any.
REVOKE ALL ON SEQUENCE "public"."message_reports_id_seq" FROM "anon";

REVOKE ALL ON SEQUENCE "public"."message_reports_id_seq" FROM "authenticated";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."message_reports" TO "service_role";

REVOKE ALL ON TABLE "public"."message_reports" FROM "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."message_reports" TO "postgres";
