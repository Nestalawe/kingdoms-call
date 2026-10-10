CREATE TABLE "public"."game_messages" (
  "id"           bigint                   NOT NULL DEFAULT nextval('public.game_messages_id_seq'::regclass),
  "game_id"      text                     NOT NULL,
  "turn"         integer,
  "from_index"   integer                  NOT NULL,
  "from_user_id" uuid                     NOT NULL DEFAULT auth.uid(),
  "to_indexes"   integer[]                NOT NULL DEFAULT '{}'::integer[],
  "scope"        text                     NOT NULL DEFAULT 'private'::text,
  "body"         text                     NOT NULL,
  "created_at"   timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "game_messages_pkey" PRIMARY KEY (id),
  CONSTRAINT "game_messages_scope_ck" CHECK ((scope = ANY (ARRAY['public'::text, 'private'::text]))),
  CONSTRAINT "game_messages_to_ck" CHECK (((scope = 'public'::text) OR (COALESCE(array_length(to_indexes, 1), 0) >= 1)))
);

ALTER TABLE "public"."game_messages"
  ENABLE ROW LEVEL SECURITY;

ALTER SEQUENCE "public"."game_messages_id_seq" OWNED BY "public"."game_messages"."id";

CREATE INDEX game_messages_game_idx ON public.game_messages USING btree (game_id, id);

CREATE POLICY "gm tidy game_messages" ON "public"."game_messages"
  FOR DELETE
  TO "authenticated"
  USING ((EXISTS ( SELECT 1
   FROM public.games g
  WHERE (((g.id)::text = game_messages.game_id) AND (g.gm_user_id = auth.uid())))));

CREATE POLICY "read game_messages" ON "public"."game_messages"
  FOR SELECT
  TO "authenticated"
  USING (((EXISTS ( SELECT 1
   FROM public.game_players gp
  WHERE
    (((gp.game_id)::text = game_messages.game_id) AND (gp.user_id = auth.uid()) AND ((game_messages.scope = 'public'::text) OR (gp.player_index = game_messages.from_index) OR
    (gp.player_index = ANY (game_messages.to_indexes)))))) OR (EXISTS ( SELECT 1
   FROM public.games g
  WHERE (((g.id)::text = game_messages.game_id) AND (g.gm_user_id = auth.uid()))))));

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."game_messages" TO "anon", "authenticated";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."game_messages" TO "service_role";

CREATE POLICY "send game_messages" ON "public"."game_messages"
  FOR INSERT
  TO "authenticated"
  WITH CHECK (((from_user_id = auth.uid()) AND (EXISTS ( SELECT 1
   FROM public.game_players gp
  WHERE (((gp.game_id)::text = game_messages.game_id) AND (gp.user_id = auth.uid()) AND (gp.player_index = game_messages.from_index))))));

REVOKE ALL ON TABLE "public"."game_messages" FROM "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."game_messages" TO "postgres";
