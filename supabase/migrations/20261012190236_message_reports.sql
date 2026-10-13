-- Reported dispatches (plan step P0-24, part 1 of 3: adds only; rulings D-01, D-13g): message_reports and
-- gm_reported_messages(); the Overlord reads every dispatch (D-13 follow-up 1). Nothing on the site uses them yet;
-- the GM's own read is narrowed in part 3. Generated from supabase/schemas/. Rules only: no data changes.

SET local check_function_bodies = off;

DROP POLICY "read game_messages" ON "public"."game_messages";

CREATE TABLE "public"."message_reports" (
  "id"               bigint                   GENERATED ALWAYS AS IDENTITY NOT NULL,
  "message_id"       bigint                   NOT NULL,
  "game_id"          text                     NOT NULL,
  "reporter_index"   integer                  NOT NULL,
  "reason"           text,
  "created_at"       timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "message_reports_pkey" PRIMARY KEY (id),
  CONSTRAINT "message_reports_reason_len" CHECK (((reason IS NULL) OR (char_length(reason) <= 500))),
  "reporter_user_id" uuid                     NOT NULL DEFAULT auth.uid(),
  CONSTRAINT "message_reports_once" UNIQUE (message_id, reporter_user_id)
);

ALTER TABLE "public"."message_reports"
  ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE "public"."message_reports" FROM "anon";

REVOKE ALL ON SEQUENCE "public"."message_reports_id_seq" FROM "anon";

REVOKE ALL ON SEQUENCE "public"."message_reports_id_seq" FROM "authenticated";

CREATE OR REPLACE FUNCTION public.gm_reported_messages (
  p_game uuid
)
  RETURNS TABLE (
    report_id      bigint,
    message_id     bigint,
    game_id        text,
    turn           integer,
    from_index     integer,
    to_indexes     integer[],
    scope          text,
    body           text,
    sent_at        timestamp with time zone,
    reporter_index integer,
    reason         text,
    reported_at    timestamp with time zone
  )
  LANGUAGE sql
  STABLE
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
  select r.id, m.id, m.game_id, m.turn, m.from_index, m.to_indexes, m.scope, m.body, m.created_at,
         r.reporter_index, r.reason, r.created_at
  from public.message_reports r
  join public.game_messages m on m.id = r.message_id
  where (p_game is null or m.game_id = p_game::text)
    and (public.is_site_admin()
         or exists (select 1 from public.games g
                    where g.id::text = m.game_id and g.gm_user_id = auth.uid()
                      and not exists (select 1 from public.game_players gp where gp.game_id = g.id and gp.user_id = auth.uid())))
  order by r.created_at desc, r.id desc
$function$;

REVOKE ALL ON FUNCTION "public"."gm_reported_messages"(uuid) FROM PUBLIC, "anon";

ALTER TABLE "public"."message_reports"
  ADD CONSTRAINT "message_reports_message_id_fkey" FOREIGN KEY (message_id) REFERENCES public.game_messages(id) ON DELETE CASCADE;

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
        END) AND (g.gm_user_id = auth.uid())))) OR ( SELECT public.is_site_admin() AS is_site_admin)));

COMMENT ON TABLE "public"."message_reports" IS 'One row per dispatch a player has reported: to the game''s GM, or the Overlord when the GM plays in that game (P0-24).';

GRANT EXECUTE ON FUNCTION "public"."gm_reported_messages"(uuid) TO "authenticated";

REVOKE ALL ON FUNCTION "public"."gm_reported_messages"(uuid) FROM "postgres";

GRANT EXECUTE ON FUNCTION "public"."gm_reported_messages"(uuid) TO "postgres";

GRANT EXECUTE ON FUNCTION "public"."gm_reported_messages"(uuid) TO "service_role";

REVOKE ALL ON SEQUENCE "public"."message_reports_id_seq" FROM "postgres";

GRANT SELECT, UPDATE, USAGE ON SEQUENCE "public"."message_reports_id_seq" TO "postgres";

REVOKE ALL ON SEQUENCE "public"."message_reports_id_seq" FROM "service_role";

GRANT SELECT, UPDATE, USAGE ON SEQUENCE "public"."message_reports_id_seq" TO "service_role";

REVOKE ALL ON TABLE "public"."message_reports" FROM "authenticated";

GRANT INSERT, SELECT ON TABLE "public"."message_reports" TO "authenticated";

REVOKE ALL ON TABLE "public"."message_reports" FROM "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."message_reports" TO "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."message_reports" TO "service_role";

CREATE POLICY "own reports" ON "public"."message_reports"
  FOR SELECT
  TO "authenticated"
  USING ((reporter_user_id = ( SELECT auth.uid() AS uid)));

CREATE POLICY "report a received dispatch" ON "public"."message_reports"
  FOR INSERT
  TO "authenticated"
  WITH CHECK (((reporter_user_id = ( SELECT auth.uid() AS uid)) AND (EXISTS ( SELECT 1
   FROM public.game_players gp
  WHERE ((gp.game_id =
        CASE
            WHEN pg_input_is_valid(message_reports.game_id, 'uuid'::text) THEN (message_reports.game_id)::uuid
            ELSE NULL::uuid
        END) AND (gp.player_index = message_reports.reporter_index) AND (gp.user_id = ( SELECT auth.uid() AS uid))))) AND (EXISTS ( SELECT 1
   FROM public.game_messages m
  WHERE
    ((m.id = message_reports.message_id) AND (m.game_id = message_reports.game_id) AND (m.from_user_id <> ( SELECT auth.uid() AS uid)) AND ((m.scope = 'public'::text) OR
    (message_reports.reporter_index = ANY (m.to_indexes))))))));
