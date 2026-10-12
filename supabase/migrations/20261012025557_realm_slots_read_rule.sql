-- A realm's slot (its orders and its report) is read only by the player who holds it and by the game's GM
-- (plan step P0-21, Unit B contract). Other realms are seen through get_game_slots (P0-20). Generated from
-- supabase/schemas/; the drop and the create run in one transaction.

DROP POLICY "gp1" ON "public"."game_players";

CREATE POLICY "gp1" ON "public"."game_players"
  FOR SELECT
  TO "authenticated"
  USING (((user_id = ( SELECT auth.uid() AS uid)) OR ( SELECT public.is_game_gm(game_players.game_id) AS is_game_gm)));
