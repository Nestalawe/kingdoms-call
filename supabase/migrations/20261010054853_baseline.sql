SET local check_function_bodies = off;

CREATE SEQUENCE "public"."game_messages_id_seq" AS bigint INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1 NO CYCLE;

CREATE SEQUENCE "public"."game_results_id_seq" AS bigint INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1 NO CYCLE;

CREATE SEQUENCE "public"."turn_events_id_seq" AS bigint INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1 NO CYCLE;

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

CREATE TABLE "public"."game_players" (
  "id"                uuid                     NOT NULL DEFAULT extensions.uuid_generate_v4(),
  "game_id"           uuid                     NOT NULL,
  "user_id"           uuid,
  "player_index"      integer                  NOT NULL,
  "display_name"      text                     NOT NULL,
  "invite_code"       text                     DEFAULT substr(md5((random())::text), 0, 9),
  "orders_submitted"  boolean                  NOT NULL DEFAULT false,
  "turn_report"       jsonb,
  "orders"            jsonb,
  "last_submitted_at" timestamp with time zone,
  "created_at"        timestamp with time zone DEFAULT now(),
  CONSTRAINT "game_players_invite_code_key" UNIQUE (invite_code),
  CONSTRAINT "game_players_pkey" PRIMARY KEY (id)
);

ALTER TABLE "public"."game_players"
  ENABLE ROW LEVEL SECURITY;

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

CREATE TABLE "public"."game_results" (
  "id"             bigint                   NOT NULL DEFAULT nextval('public.game_results_id_seq'::regclass),
  "game_id"        text                     NOT NULL,
  "game_name"      text,
  "player_index"   integer                  NOT NULL,
  "is_bot"         boolean                  NOT NULL DEFAULT false,
  "bot_difficulty" text,
  "realm"          text,
  "race"           text,
  "alignment"      text,
  "rank"           integer,
  "score"          integer,
  "winner"         boolean                  NOT NULL DEFAULT false,
  "victory"        text,
  "turns"          integer,
  "out_turn"       integer,
  "out_how"        text,
  "setup"          jsonb,
  "final"          jsonb,
  "build"          text,
  "created_at"     timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "game_results_game_id_player_index_key" UNIQUE (game_id, player_index),
  CONSTRAINT "game_results_pkey" PRIMARY KEY (id)
);

ALTER TABLE "public"."game_results"
  ENABLE ROW LEVEL SECURITY;

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
  CONSTRAINT "games_pkey" PRIMARY KEY (id)
);

ALTER TABLE "public"."games"
  ENABLE ROW LEVEL SECURITY;

CREATE TABLE "public"."profiles" (
  "id"         uuid                     NOT NULL,
  "email"      text,
  "name"       text,
  "created_at" timestamp with time zone DEFAULT now(),
  CONSTRAINT "profiles_pkey" PRIMARY KEY (id)
);

ALTER TABLE "public"."profiles"
  ENABLE ROW LEVEL SECURITY;

CREATE TABLE "public"."turn_events" (
  "id"             bigint                   NOT NULL DEFAULT nextval('public.turn_events_id_seq'::regclass),
  "game_id"        text                     NOT NULL,
  "turn"           integer                  NOT NULL,
  "player_index"   integer                  NOT NULL,
  "is_bot"         boolean                  NOT NULL DEFAULT false,
  "bot_difficulty" text,
  "realm"          text,
  "race"           text,
  "alignment"      text,
  "orders"         jsonb,
  "pre"            jsonb,
  "post"           jsonb,
  "outcomes"       jsonb,
  "build"          text,
  "created_at"     timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "turn_events_game_id_turn_player_index_key" UNIQUE (game_id, turn, player_index),
  CONSTRAINT "turn_events_pkey" PRIMARY KEY (id)
);

ALTER TABLE "public"."turn_events"
  ENABLE ROW LEVEL SECURITY;

CREATE TABLE "public"."turn_logs" (
  "id"           uuid                     NOT NULL DEFAULT extensions.uuid_generate_v4(),
  "game_id"      uuid                     NOT NULL,
  "player_index" integer                  NOT NULL,
  "turn"         integer                  NOT NULL,
  "entries"      jsonb                    NOT NULL DEFAULT '[]'::jsonb,
  "created_at"   timestamp with time zone DEFAULT now(),
  CONSTRAINT "turn_logs_pkey" PRIMARY KEY (id)
);

ALTER TABLE "public"."turn_logs"
  ENABLE ROW LEVEL SECURITY;

ALTER SEQUENCE "public"."game_messages_id_seq" OWNED BY "public"."game_messages"."id";

ALTER SEQUENCE "public"."game_results_id_seq" OWNED BY "public"."game_results"."id";

ALTER SEQUENCE "public"."turn_events_id_seq" OWNED BY "public"."turn_events"."id";

CREATE OR REPLACE FUNCTION public.handle_new_user()
  RETURNS TRIGGER
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
  AS $function$
begin
  insert into profiles (id, email, name)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email,'@',1))
  );
  return new;
end;
$function$;

CREATE OR REPLACE FUNCTION public.kc_transfer_games (
  p_game_ids     text[],
  p_new_gm_email text
)
  RETURNS integer
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
  AS $function$
declare
  v_new uuid;
  v_n   integer;
begin
  if auth.uid() is null then
    raise exception 'Not signed in';
  end if;
  select id into v_new from auth.users
   where lower(email) = lower(trim(p_new_gm_email)) limit 1;
  if v_new is null then
    raise exception 'No account is registered with the email %', trim(p_new_gm_email);
  end if;
  if v_new = auth.uid() then
    raise exception 'That is the account you are signed in as';
  end if;
  update public.games
     set gm_user_id = v_new
   where id::text = any(p_game_ids)
     and gm_user_id = auth.uid();   -- only games the caller owns can move
  get diagnostics v_n = row_count;
  return v_n;
end;
$function$;

ALTER TABLE "public"."game_players"
  ADD CONSTRAINT "game_players_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE "public"."games"
  ADD CONSTRAINT "games_gm_user_id_fkey" FOREIGN KEY (gm_user_id) REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE "public"."game_players"
  ADD CONSTRAINT "game_players_game_id_fkey" FOREIGN KEY (game_id) REFERENCES public.games(id) ON DELETE CASCADE;

ALTER TABLE "public"."profiles"
  ADD CONSTRAINT "profiles_id_fkey" FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE "public"."turn_logs"
  ADD CONSTRAINT "turn_logs_game_id_fkey" FOREIGN KEY (game_id) REFERENCES public.games(id) ON DELETE CASCADE;

CREATE INDEX game_messages_game_idx ON public.game_messages USING btree (game_id, id);

CREATE UNIQUE INDEX game_players_one_per_user ON public.game_players USING btree (game_id, user_id);

CREATE INDEX turn_events_game_idx ON public.turn_events USING btree (game_id, turn);

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

CREATE POLICY "own game_message_reads" ON "public"."game_message_reads"
  FOR ALL
  TO "authenticated"
  USING ((user_id = auth.uid()))
  WITH CHECK ((user_id = auth.uid()));

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

CREATE POLICY "gp1" ON "public"."game_players"
  FOR SELECT
  TO PUBLIC
  USING (true);

CREATE POLICY "gp2" ON "public"."game_players"
  FOR INSERT
  TO PUBLIC
  WITH CHECK ((user_id = auth.uid()));

CREATE POLICY "gp3" ON "public"."game_players"
  FOR UPDATE
  TO PUBLIC
  USING ((user_id = auth.uid()));

CREATE POLICY "gp4" ON "public"."game_players"
  FOR INSERT
  TO PUBLIC
  WITH CHECK ((game_id IN ( SELECT games.id
   FROM public.games
  WHERE (games.gm_user_id = auth.uid()))));

CREATE POLICY "gp5" ON "public"."game_players"
  FOR UPDATE
  TO PUBLIC
  USING ((game_id IN ( SELECT games.id
   FROM public.games
  WHERE (games.gm_user_id = auth.uid()))));

CREATE POLICY "gp6" ON "public"."game_players"
  FOR DELETE
  TO PUBLIC
  USING ((game_id IN ( SELECT games.id
   FROM public.games
  WHERE (games.gm_user_id = auth.uid()))));

CREATE POLICY "gm write game_records" ON "public"."game_records"
  FOR ALL
  TO "authenticated"
  USING ((EXISTS ( SELECT 1
   FROM public.games g
  WHERE (g.gm_user_id = auth.uid()))))
  WITH CHECK ((EXISTS ( SELECT 1
   FROM public.games g
  WHERE (g.gm_user_id = auth.uid()))));

CREATE POLICY "read game_records" ON "public"."game_records"
  FOR SELECT
  TO "anon", "authenticated"
  USING (true);

CREATE POLICY "gm rw game_results" ON "public"."game_results"
  FOR ALL
  TO "authenticated"
  USING (true)
  WITH CHECK (true);

CREATE POLICY "read games (gm, public, or invited to private setup)" ON "public"."games"
  FOR SELECT
  TO "authenticated"
  USING
    (((gm_user_id = auth.uid()) OR (status <> 'setup'::text) OR (COALESCE((game_state ->> 'visibility'::text), 'public'::text) <> 'private'::text) OR ((game_state ->
    'invited'::text) ? (auth.uid())::text)));

CREATE POLICY "allow_insert_games" ON "public"."games"
  FOR INSERT
  TO "anon", "authenticated"
  WITH CHECK (true);

CREATE POLICY "allow_read_games" ON "public"."games"
  FOR SELECT
  TO "anon", "authenticated"
  USING (true);

CREATE POLICY "allow_update_games" ON "public"."games"
  FOR UPDATE
  TO "anon", "authenticated"
  USING (true);

CREATE POLICY "anyone_can_read_games" ON "public"."games"
  FOR SELECT
  TO "anon", "authenticated"
  USING (true);

CREATE POLICY "g1" ON "public"."games"
  FOR ALL
  TO PUBLIC
  USING ((gm_user_id = auth.uid()));

CREATE POLICY "g2" ON "public"."games"
  FOR SELECT
  TO PUBLIC
  USING ((status = 'setup'::text));

CREATE POLICY "g3" ON "public"."games"
  FOR SELECT
  TO PUBLIC
  USING (true);

CREATE POLICY "gm_can_insert_games" ON "public"."games"
  FOR INSERT
  TO "anon", "authenticated"
  WITH CHECK (true);

CREATE POLICY "gm_can_update_own_games" ON "public"."games"
  FOR UPDATE
  TO "anon", "authenticated"
  USING (true);

CREATE POLICY "profiles: self read, GMs read all" ON "public"."profiles"
  FOR SELECT
  TO "authenticated"
  USING (((id = auth.uid()) OR (EXISTS ( SELECT 1
   FROM public.games g
  WHERE (g.gm_user_id = auth.uid())))));

CREATE POLICY "signed-in users can read profiles" ON "public"."profiles"
  FOR SELECT
  TO "authenticated"
  USING (true);

CREATE POLICY "p1" ON "public"."profiles"
  FOR ALL
  TO PUBLIC
  USING ((id = auth.uid()));

CREATE POLICY "gm rw turn_events" ON "public"."turn_events"
  FOR ALL
  TO "authenticated"
  USING (true)
  WITH CHECK (true);

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

GRANT EXECUTE ON FUNCTION "public"."handle_new_user"() TO PUBLIC, "anon", "authenticated";

REVOKE ALL ON FUNCTION "public"."handle_new_user"() FROM "postgres";

GRANT EXECUTE ON FUNCTION "public"."handle_new_user"() TO "postgres";

GRANT EXECUTE ON FUNCTION "public"."handle_new_user"() TO "service_role";

REVOKE ALL ON FUNCTION "public"."kc_transfer_games"(text[], text) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION "public"."kc_transfer_games"(text[], text) TO "anon", "authenticated";

REVOKE ALL ON FUNCTION "public"."kc_transfer_games"(text[], text) FROM "postgres";

GRANT EXECUTE ON FUNCTION "public"."kc_transfer_games"(text[], text) TO "postgres";

GRANT EXECUTE ON FUNCTION "public"."kc_transfer_games"(text[], text) TO "service_role";

GRANT SELECT, UPDATE, USAGE ON SEQUENCE "public"."game_messages_id_seq" TO "anon", "authenticated";

REVOKE ALL ON SEQUENCE "public"."game_messages_id_seq" FROM "postgres";

GRANT SELECT, UPDATE, USAGE ON SEQUENCE "public"."game_messages_id_seq" TO "postgres";

GRANT SELECT, UPDATE, USAGE ON SEQUENCE "public"."game_messages_id_seq" TO "service_role";

GRANT SELECT, UPDATE, USAGE ON SEQUENCE "public"."game_results_id_seq" TO "anon", "authenticated";

REVOKE ALL ON SEQUENCE "public"."game_results_id_seq" FROM "postgres";

GRANT SELECT, UPDATE, USAGE ON SEQUENCE "public"."game_results_id_seq" TO "postgres";

GRANT SELECT, UPDATE, USAGE ON SEQUENCE "public"."game_results_id_seq" TO "service_role";

GRANT SELECT, UPDATE, USAGE ON SEQUENCE "public"."turn_events_id_seq" TO "anon", "authenticated";

REVOKE ALL ON SEQUENCE "public"."turn_events_id_seq" FROM "postgres";

GRANT SELECT, UPDATE, USAGE ON SEQUENCE "public"."turn_events_id_seq" TO "postgres";

GRANT SELECT, UPDATE, USAGE ON SEQUENCE "public"."turn_events_id_seq" TO "service_role";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."game_message_reads" TO "anon", "authenticated";

REVOKE ALL ON TABLE "public"."game_message_reads" FROM "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."game_message_reads" TO "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."game_message_reads" TO "service_role";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."game_messages" TO "anon", "authenticated";

REVOKE ALL ON TABLE "public"."game_messages" FROM "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."game_messages" TO "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."game_messages" TO "service_role";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."game_players" TO "anon", "authenticated";

REVOKE ALL ON TABLE "public"."game_players" FROM "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."game_players" TO "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."game_players" TO "service_role";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."game_records" TO "anon", "authenticated";

REVOKE ALL ON TABLE "public"."game_records" FROM "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."game_records" TO "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."game_records" TO "service_role";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."game_results" TO "anon", "authenticated";

REVOKE ALL ON TABLE "public"."game_results" FROM "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."game_results" TO "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."game_results" TO "service_role";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."games" TO "anon", "authenticated";

REVOKE ALL ON TABLE "public"."games" FROM "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."games" TO "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."games" TO "service_role";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."profiles" TO "anon", "authenticated";

REVOKE ALL ON TABLE "public"."profiles" FROM "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."profiles" TO "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."profiles" TO "service_role";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."turn_events" TO "anon", "authenticated";

REVOKE ALL ON TABLE "public"."turn_events" FROM "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."turn_events" TO "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."turn_events" TO "service_role";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."turn_logs" TO "anon", "authenticated";

REVOKE ALL ON TABLE "public"."turn_logs" FROM "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."turn_logs" TO "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."turn_logs" TO "service_role";

CREATE POLICY "send game_messages" ON "public"."game_messages"
  FOR INSERT
  TO "authenticated"
  WITH CHECK (((from_user_id = auth.uid()) AND (EXISTS ( SELECT 1
   FROM public.game_players gp
  WHERE (((gp.game_id)::text = game_messages.game_id) AND (gp.user_id = auth.uid()) AND (gp.player_index = game_messages.from_index))))));
