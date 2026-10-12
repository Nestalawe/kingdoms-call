CREATE TABLE "public"."game_message_reads" (
  "game_id"      text                     NOT NULL,
  "player_index" integer                  NOT NULL,
  "user_id"      uuid                     NOT NULL,
  "reads"        jsonb                    NOT NULL DEFAULT '{}'::jsonb,
  "updated_at"   timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "game_message_reads_pkey" PRIMARY KEY (game_id, player_index)
);

ALTER TABLE "public"."game_message_reads"
  ENABLE ROW LEVEL SECURITY;

-- A player keeps markers only for the realm they play (P0-23). Deleting a game removes its markers
-- (games_delete_message_reads): nobody else reads them, the GM included, since their keys show who talks privately.
CREATE POLICY "own game_message_reads" ON "public"."game_message_reads"
  FOR ALL
  TO "authenticated"
  USING ((user_id = ( SELECT auth.uid() AS uid)))
  WITH CHECK (((user_id = ( SELECT auth.uid() AS uid)) AND (EXISTS ( SELECT 1
   FROM public.game_players gp
  WHERE ((gp.game_id = CASE WHEN pg_input_is_valid(game_message_reads.game_id, 'uuid'::text) THEN (game_message_reads.game_id)::uuid ELSE NULL::uuid END) AND (gp.player_index = game_message_reads.player_index) AND (gp.user_id = ( SELECT auth.uid() AS uid)))))));

REVOKE ALL ON TABLE "public"."game_message_reads" FROM "anon";

REVOKE ALL ON TABLE "public"."game_message_reads" FROM "authenticated";

GRANT DELETE, INSERT, SELECT, UPDATE ON TABLE "public"."game_message_reads" TO "authenticated";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."game_message_reads" TO "service_role";

REVOKE ALL ON TABLE "public"."game_message_reads" FROM "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."game_message_reads" TO "postgres";
