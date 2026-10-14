SET local check_function_bodies = off;

CREATE OR REPLACE FUNCTION public.game_gm (
  p_game uuid
)
  RETURNS uuid
  LANGUAGE sql
  STABLE
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
  select gm_user_id from public.games where id = p_game
$function$;

REVOKE ALL ON FUNCTION "public"."game_gm"(uuid) FROM PUBLIC, "anon";

CREATE OR REPLACE FUNCTION public.get_game_slots (
  p_games uuid[]
)
  RETURNS TABLE (
    game_id          uuid,
    player_index     integer,
    is_bot           boolean,
    orders_submitted boolean,
    alignment        text
  )
  LANGUAGE sql
  STABLE
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
  -- game_state and turn_report hold JSON as text inside jsonb (the portals write JSON.stringify), or older
  -- rows an object: both are read; text that isn't valid JSON reads as nothing.
  select s.game_id, s.player_index, s.user_id is null, s.orders_submitted,
         case when g.status = 'setup' then rpt.v -> 'playerSetup' ->> 'alignment' end
  from public.games g
  cross join lateral (select case jsonb_typeof(g.game_state)
                               when 'string' then case when pg_input_is_valid(g.game_state #>> '{}', 'jsonb')
                                                       then (g.game_state #>> '{}')::jsonb end
                               else g.game_state end as v) cfg
  join public.game_players s on s.game_id = g.id
  cross join lateral (select case jsonb_typeof(s.turn_report)
                               when 'string' then case when pg_input_is_valid(s.turn_report #>> '{}', 'jsonb')
                                                       then (s.turn_report #>> '{}')::jsonb end
                               else s.turn_report end as v) rpt
  where g.id = any (p_games)
    and (g.gm_user_id = auth.uid()
         or public.is_site_admin()
         or exists (select 1 from public.game_players m where m.game_id = g.id and m.user_id = auth.uid())
         or (g.status = 'setup'
             and (coalesce(cfg.v ->> 'visibility', 'public') <> 'private'
                  or coalesce(cfg.v -> 'invited', '[]'::jsonb) ? (auth.uid())::text)))
  order by s.game_id, s.player_index
$function$;

CREATE OR REPLACE FUNCTION public.reassign_game (
  p_game   uuid,
  p_new_gm uuid
)
  RETURNS void
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
begin
  if not public.is_site_admin() then
    raise exception 'Only the Overlord can hand a game over.';
  end if;
  if exists (select 1 from public.site_admins where user_id = p_new_gm) then
    raise exception 'The Overlord doesn''t run games.';
  end if;
  if not exists (select 1 from public.game_masters where user_id = p_new_gm and accepted_at is not null) then
    raise exception 'That account isn''t a Game Master.';
  end if;
  update public.games set gm_user_id = p_new_gm where id = p_game;
  if not found then
    raise exception 'No such game.';
  end if;
end
$function$;

REVOKE ALL ON FUNCTION "public"."reassign_game"(uuid, uuid) FROM PUBLIC, "anon";

CREATE POLICY "the Overlord tidies game_messages" ON "public"."game_messages"
  FOR DELETE
  TO "authenticated"
  USING (( SELECT public.is_site_admin() AS is_site_admin));

CREATE POLICY "the Overlord adds bot realms" ON "public"."game_players"
  FOR INSERT
  TO "authenticated"
  WITH CHECK ((( SELECT public.is_site_admin() AS is_site_admin) AND (user_id IS NULL)));

CREATE POLICY "the Overlord changes any realm" ON "public"."game_players"
  FOR UPDATE
  TO "authenticated"
  USING (( SELECT public.is_site_admin() AS is_site_admin))
  WITH CHECK (( SELECT public.is_site_admin() AS is_site_admin));

CREATE POLICY "the Overlord reads every realm" ON "public"."game_players"
  FOR SELECT
  TO "authenticated"
  USING (( SELECT public.is_site_admin() AS is_site_admin));

CREATE POLICY "the Overlord removes any realm" ON "public"."game_players"
  FOR DELETE
  TO "authenticated"
  USING (( SELECT public.is_site_admin() AS is_site_admin));

CREATE POLICY "a save keeps the game's GM" ON "public"."games"
  AS RESTRICTIVE
  FOR UPDATE
  TO "authenticated"
  USING (true)
  WITH CHECK ((NOT (gm_user_id IS DISTINCT FROM public.game_gm(id))));

CREATE POLICY "the Overlord deletes any game" ON "public"."games"
  FOR DELETE
  TO "authenticated"
  USING (( SELECT public.is_site_admin() AS is_site_admin));

CREATE POLICY "the Overlord reads every game" ON "public"."games"
  FOR SELECT
  TO "authenticated"
  USING (( SELECT public.is_site_admin() AS is_site_admin));

CREATE POLICY "the Overlord saves any game" ON "public"."games"
  FOR UPDATE
  TO "authenticated"
  USING (( SELECT public.is_site_admin() AS is_site_admin))
  WITH CHECK (( SELECT public.is_site_admin() AS is_site_admin));

CREATE POLICY "the Overlord writes any turn log" ON "public"."turn_logs"
  FOR ALL
  TO "authenticated"
  USING (( SELECT public.is_site_admin() AS is_site_admin))
  WITH CHECK (( SELECT public.is_site_admin() AS is_site_admin));

GRANT EXECUTE ON FUNCTION "public"."game_gm"(uuid) TO "authenticated";

REVOKE ALL ON FUNCTION "public"."game_gm"(uuid) FROM "postgres";

GRANT EXECUTE ON FUNCTION "public"."game_gm"(uuid) TO "postgres";

GRANT EXECUTE ON FUNCTION "public"."game_gm"(uuid) TO "service_role";

GRANT EXECUTE ON FUNCTION "public"."reassign_game"(uuid, uuid) TO "authenticated";

REVOKE ALL ON FUNCTION "public"."reassign_game"(uuid, uuid) FROM "postgres";

GRANT EXECUTE ON FUNCTION "public"."reassign_game"(uuid, uuid) TO "postgres";

GRANT EXECUTE ON FUNCTION "public"."reassign_game"(uuid, uuid) TO "service_role";
