-- The API roles keep only what the site uses (written by hand: the schema generator doesn't carry
-- privilege changes; supabase/schemas/ states the same grants).

-- Signed out (anon): nothing, except reading the Hall of Fame.
REVOKE ALL ON TABLE
  "public"."games", "public"."game_players", "public"."turn_logs", "public"."profiles",
  "public"."turn_events", "public"."game_results", "public"."game_records",
  "public"."game_messages", "public"."game_message_reads"
  FROM "anon";
GRANT SELECT ON TABLE "public"."game_records" TO "anon";

REVOKE ALL ON SEQUENCE
  "public"."turn_events_id_seq", "public"."game_results_id_seq", "public"."game_messages_id_seq"
  FROM "anon";

REVOKE EXECUTE ON FUNCTION "public"."kc_transfer_games"(text[], text) FROM "anon";

-- Signed in (authenticated): read and write through the access rules; nothing else.
REVOKE TRUNCATE, TRIGGER, REFERENCES, MAINTAIN ON TABLE
  "public"."games", "public"."game_players", "public"."turn_logs", "public"."profiles",
  "public"."turn_events", "public"."game_results", "public"."game_records",
  "public"."game_messages", "public"."game_message_reads"
  FROM "authenticated";

-- The sign-up trigger's function runs only as the trigger; nobody calls it.
REVOKE ALL ON FUNCTION "public"."handle_new_user"() FROM PUBLIC, "anon", "authenticated";
