DROP POLICY "gp4" ON "public"."game_players";

DROP POLICY "gp5" ON "public"."game_players";

DROP POLICY "gp6" ON "public"."game_players";

CREATE POLICY "GM writes need a Game Master (delete)" ON "public"."game_messages"
  AS RESTRICTIVE
  FOR DELETE
  TO "authenticated"
  USING ((( SELECT public.is_site_admin() AS is_site_admin) OR ( SELECT public.is_game_master() AS is_game_master)));

CREATE POLICY "gp4" ON "public"."game_players"
  FOR INSERT
  TO PUBLIC
  WITH CHECK (((game_id IN ( SELECT games.id
   FROM public.games
  WHERE (games.gm_user_id = auth.uid()))) AND ( SELECT public.is_game_master() AS is_game_master)));

CREATE POLICY "gp5" ON "public"."game_players"
  FOR UPDATE
  TO PUBLIC
  USING (((game_id IN ( SELECT games.id
   FROM public.games
  WHERE (games.gm_user_id = auth.uid()))) AND ( SELECT public.is_game_master() AS is_game_master)));

CREATE POLICY "gp6" ON "public"."game_players"
  FOR DELETE
  TO PUBLIC
  USING (((game_id IN ( SELECT games.id
   FROM public.games
  WHERE (games.gm_user_id = auth.uid()))) AND ( SELECT public.is_game_master() AS is_game_master)));

CREATE POLICY "GM writes need a Game Master (delete)" ON "public"."game_records"
  AS RESTRICTIVE
  FOR DELETE
  TO "authenticated"
  USING ((( SELECT public.is_site_admin() AS is_site_admin) OR ( SELECT public.is_game_master() AS is_game_master)));

CREATE POLICY "GM writes need a Game Master (insert)" ON "public"."game_records"
  AS RESTRICTIVE
  FOR INSERT
  TO "authenticated"
  WITH CHECK ((( SELECT public.is_site_admin() AS is_site_admin) OR ( SELECT public.is_game_master() AS is_game_master)));

CREATE POLICY "GM writes need a Game Master (update)" ON "public"."game_records"
  AS RESTRICTIVE
  FOR UPDATE
  TO "authenticated"
  USING ((( SELECT public.is_site_admin() AS is_site_admin) OR ( SELECT public.is_game_master() AS is_game_master)));

CREATE POLICY "GM writes need a Game Master (delete)" ON "public"."game_results"
  AS RESTRICTIVE
  FOR DELETE
  TO "authenticated"
  USING ((( SELECT public.is_site_admin() AS is_site_admin) OR ( SELECT public.is_game_master() AS is_game_master)));

CREATE POLICY "GM writes need a Game Master (insert)" ON "public"."game_results"
  AS RESTRICTIVE
  FOR INSERT
  TO "authenticated"
  WITH CHECK ((( SELECT public.is_site_admin() AS is_site_admin) OR ( SELECT public.is_game_master() AS is_game_master)));

CREATE POLICY "GM writes need a Game Master (update)" ON "public"."game_results"
  AS RESTRICTIVE
  FOR UPDATE
  TO "authenticated"
  USING ((( SELECT public.is_site_admin() AS is_site_admin) OR ( SELECT public.is_game_master() AS is_game_master)));

CREATE POLICY "GM writes need a Game Master (delete)" ON "public"."games"
  AS RESTRICTIVE
  FOR DELETE
  TO "authenticated"
  USING ((( SELECT public.is_site_admin() AS is_site_admin) OR ( SELECT public.is_game_master() AS is_game_master)));

CREATE POLICY "GM writes need a Game Master (update)" ON "public"."games"
  AS RESTRICTIVE
  FOR UPDATE
  TO "authenticated"
  USING ((( SELECT public.is_site_admin() AS is_site_admin) OR ( SELECT public.is_game_master() AS is_game_master)));

CREATE POLICY "GM writes need a Game Master (delete)" ON "public"."turn_events"
  AS RESTRICTIVE
  FOR DELETE
  TO "authenticated"
  USING ((( SELECT public.is_site_admin() AS is_site_admin) OR ( SELECT public.is_game_master() AS is_game_master)));

CREATE POLICY "GM writes need a Game Master (insert)" ON "public"."turn_events"
  AS RESTRICTIVE
  FOR INSERT
  TO "authenticated"
  WITH CHECK ((( SELECT public.is_site_admin() AS is_site_admin) OR ( SELECT public.is_game_master() AS is_game_master)));

CREATE POLICY "GM writes need a Game Master (update)" ON "public"."turn_events"
  AS RESTRICTIVE
  FOR UPDATE
  TO "authenticated"
  USING ((( SELECT public.is_site_admin() AS is_site_admin) OR ( SELECT public.is_game_master() AS is_game_master)));

CREATE POLICY "GM writes need a Game Master (delete)" ON "public"."turn_logs"
  AS RESTRICTIVE
  FOR DELETE
  TO "authenticated"
  USING ((( SELECT public.is_site_admin() AS is_site_admin) OR ( SELECT public.is_game_master() AS is_game_master)));

CREATE POLICY "GM writes need a Game Master (insert)" ON "public"."turn_logs"
  AS RESTRICTIVE
  FOR INSERT
  TO "authenticated"
  WITH CHECK ((( SELECT public.is_site_admin() AS is_site_admin) OR ( SELECT public.is_game_master() AS is_game_master)));

CREATE POLICY "GM writes need a Game Master (update)" ON "public"."turn_logs"
  AS RESTRICTIVE
  FOR UPDATE
  TO "authenticated"
  USING ((( SELECT public.is_site_admin() AS is_site_admin) OR ( SELECT public.is_game_master() AS is_game_master)));
