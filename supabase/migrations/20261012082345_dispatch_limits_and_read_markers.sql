-- Dispatch limits and read markers (plan step P0-23, ruling D-05): at most 500 characters (new dispatches only:
-- NOT VALID), 10 a minute and 300 a day per player per game; markers only for the realm you play, removed with
-- their game; the rules compare game_id as a UUID, so the indexes are used. Generated from supabase/schemas/.
-- Rules only: no data changes.

SET local check_function_bodies = off;

DROP POLICY "own game_message_reads" ON "public"."game_message_reads";

DROP POLICY "gm tidy game_messages" ON "public"."game_messages";

DROP POLICY "read game_messages" ON "public"."game_messages";

DROP POLICY "send game_messages" ON "public"."game_messages";

CREATE OR REPLACE FUNCTION public.game_messages_rate_limit()
  RETURNS TRIGGER
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
declare n_minute int; n_day int;
begin
  select count(*) filter (where m.created_at > now() - interval '1 minute'), count(*)
    into n_minute, n_day
  from public.game_messages m
  where m.game_id = new.game_id and m.from_user_id = new.from_user_id and m.created_at > now() - interval '1 day';
  if n_minute >= 10 then
    raise exception 'You''re sending dispatches too quickly. Try again in a minute.' using hint = 'kc_dispatch_rate';
  end if;
  if n_day >= 300 then
    raise exception 'You''ve sent 300 dispatches in this game today, the most allowed. Try again tomorrow.' using hint = 'kc_dispatch_rate';
  end if;
  return new;
end
$function$;

REVOKE ALL ON FUNCTION "public"."game_messages_rate_limit"() FROM PUBLIC, "anon", "authenticated";

CREATE OR REPLACE FUNCTION public.games_delete_message_reads()
  RETURNS TRIGGER
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
begin
  delete from public.game_message_reads where game_id = old.id::text;
  return old;
end
$function$;

REVOKE ALL ON FUNCTION "public"."games_delete_message_reads"() FROM PUBLIC, "anon", "authenticated";

ALTER TABLE "public"."game_messages"
  ADD CONSTRAINT "game_messages_body_len" CHECK ((char_length(body) <= 500)) NOT VALID;

CREATE INDEX game_messages_sender_idx ON public.game_messages USING btree (game_id, from_user_id, created_at);

CREATE TRIGGER game_messages_rate_limit
  BEFORE INSERT ON public.game_messages
  FOR EACH ROW
  EXECUTE FUNCTION public.game_messages_rate_limit();

CREATE TRIGGER games_delete_message_reads
  AFTER DELETE ON public.games
  FOR EACH ROW
  EXECUTE FUNCTION public.games_delete_message_reads();

CREATE POLICY "own game_message_reads" ON "public"."game_message_reads"
  FOR ALL
  TO "authenticated"
  USING ((user_id = ( SELECT auth.uid() AS uid)))
  WITH CHECK (((user_id = ( SELECT auth.uid() AS uid)) AND (EXISTS ( SELECT 1
   FROM public.game_players gp
  WHERE ((gp.game_id =
        CASE
            WHEN pg_input_is_valid(game_message_reads.game_id, 'uuid'::text) THEN (game_message_reads.game_id)::uuid
            ELSE NULL::uuid
        END) AND (gp.player_index = game_message_reads.player_index) AND (gp.user_id = ( SELECT auth.uid() AS uid)))))));

CREATE POLICY "gm tidy game_messages" ON "public"."game_messages"
  FOR DELETE
  TO "authenticated"
  USING ((EXISTS ( SELECT 1
   FROM public.games g
  WHERE ((g.id =
        CASE
            WHEN pg_input_is_valid(game_messages.game_id, 'uuid'::text) THEN (game_messages.game_id)::uuid
            ELSE NULL::uuid
        END) AND (g.gm_user_id = auth.uid())))));

CREATE POLICY "read game_messages" ON "public"."game_messages"
  FOR SELECT
  TO "authenticated"
  USING (((EXISTS ( SELECT 1
   FROM public.game_players gp
  WHERE ((gp.game_id =
        CASE
            WHEN pg_input_is_valid(game_messages.game_id, 'uuid'::text) THEN (game_messages.game_id)::uuid
            ELSE NULL::uuid
        END) AND (gp.user_id = auth.uid()) AND
          ((game_messages.scope = 'public'::text) OR (gp.player_index = game_messages.from_index) OR (gp.player_index = ANY (game_messages.to_indexes)))))) OR (EXISTS ( SELECT 1
   FROM public.games g
  WHERE ((g.id =
        CASE
            WHEN pg_input_is_valid(game_messages.game_id, 'uuid'::text) THEN (game_messages.game_id)::uuid
            ELSE NULL::uuid
        END) AND (g.gm_user_id = auth.uid()))))));

CREATE POLICY "send game_messages" ON "public"."game_messages"
  FOR INSERT
  TO "authenticated"
  WITH CHECK (((from_user_id = auth.uid()) AND (EXISTS ( SELECT 1
   FROM public.game_players gp
  WHERE ((gp.game_id =
        CASE
            WHEN pg_input_is_valid(game_messages.game_id, 'uuid'::text) THEN (game_messages.game_id)::uuid
            ELSE NULL::uuid
        END) AND (gp.user_id = auth.uid()) AND (gp.player_index = game_messages.from_index))))));

REVOKE ALL ON FUNCTION "public"."game_messages_rate_limit"() FROM "postgres";

GRANT EXECUTE ON FUNCTION "public"."game_messages_rate_limit"() TO "postgres";

GRANT EXECUTE ON FUNCTION "public"."game_messages_rate_limit"() TO "service_role";

REVOKE ALL ON FUNCTION "public"."games_delete_message_reads"() FROM "postgres";

GRANT EXECUTE ON FUNCTION "public"."games_delete_message_reads"() TO "postgres";

GRANT EXECUTE ON FUNCTION "public"."games_delete_message_reads"() TO "service_role";
