-- The API roles keep only what the site uses (plan step P0-29). Generated from supabase/schemas/.

REVOKE ALL ON FUNCTION "public"."handle_new_user"() FROM "anon";

REVOKE ALL ON FUNCTION "public"."handle_new_user"() FROM "authenticated";

REVOKE ALL ON FUNCTION "public"."kc_transfer_games"(text[], text) FROM "anon";

REVOKE ALL ON SEQUENCE "public"."game_messages_id_seq" FROM "anon";

REVOKE ALL ON SEQUENCE "public"."game_results_id_seq" FROM "anon";

REVOKE ALL ON SEQUENCE "public"."turn_events_id_seq" FROM "anon";

REVOKE ALL ON TABLE "public"."game_message_reads" FROM "anon";

REVOKE ALL ON TABLE "public"."game_messages" FROM "anon";

REVOKE ALL ON TABLE "public"."game_players" FROM "anon";

REVOKE ALL ON TABLE "public"."game_results" FROM "anon";

REVOKE ALL ON TABLE "public"."games" FROM "anon";

REVOKE ALL ON TABLE "public"."profiles" FROM "anon";

REVOKE ALL ON TABLE "public"."turn_events" FROM "anon";

REVOKE ALL ON TABLE "public"."turn_logs" FROM "anon";

REVOKE ALL ON FUNCTION "public"."handle_new_user"() FROM PUBLIC;

REVOKE ALL ON TABLE "public"."game_message_reads" FROM "authenticated";

GRANT DELETE, INSERT, SELECT, UPDATE ON TABLE "public"."game_message_reads" TO "authenticated";

REVOKE ALL ON TABLE "public"."game_messages" FROM "authenticated";

GRANT DELETE, INSERT, SELECT, UPDATE ON TABLE "public"."game_messages" TO "authenticated";

REVOKE ALL ON TABLE "public"."game_players" FROM "authenticated";

GRANT DELETE, INSERT, SELECT, UPDATE ON TABLE "public"."game_players" TO "authenticated";

REVOKE ALL ON TABLE "public"."game_records" FROM "anon";

GRANT SELECT ON TABLE "public"."game_records" TO "anon";

REVOKE ALL ON TABLE "public"."game_records" FROM "authenticated";

GRANT DELETE, INSERT, SELECT, UPDATE ON TABLE "public"."game_records" TO "authenticated";

REVOKE ALL ON TABLE "public"."game_results" FROM "authenticated";

GRANT DELETE, INSERT, SELECT, UPDATE ON TABLE "public"."game_results" TO "authenticated";

REVOKE ALL ON TABLE "public"."games" FROM "authenticated";

GRANT DELETE, INSERT, SELECT, UPDATE ON TABLE "public"."games" TO "authenticated";

REVOKE ALL ON TABLE "public"."profiles" FROM "authenticated";

GRANT DELETE, INSERT, SELECT, UPDATE ON TABLE "public"."profiles" TO "authenticated";

REVOKE ALL ON TABLE "public"."turn_events" FROM "authenticated";

GRANT DELETE, INSERT, SELECT, UPDATE ON TABLE "public"."turn_events" TO "authenticated";

REVOKE ALL ON TABLE "public"."turn_logs" FROM "authenticated";

GRANT DELETE, INSERT, SELECT, UPDATE ON TABLE "public"."turn_logs" TO "authenticated";
