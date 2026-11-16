-- A player's realm changes only through the orders function, submit_orders (plan step P2-05): the order form saves
-- through it since #620. Players' rule for changing their realm now lets them reach it and refuses every change, with
-- an error, so a page opened before #620 says its save failed instead of showing unsaved orders as sent. A later pull
-- request removes that rule once no such page remains. The GM's and the Overlord's rules for realms, and the table's
-- grants, stay. Access rules only; no data changes.
--
-- Rollback (safe to run twice):
--   DROP POLICY IF EXISTS "a player changes their realm only through the orders function" ON "public"."game_players";
--   DROP POLICY IF EXISTS "gp3" ON "public"."game_players";
--   CREATE POLICY "gp3" ON "public"."game_players" FOR UPDATE TO PUBLIC USING ((user_id = auth.uid()));

DROP POLICY "gp3" ON "public"."game_players";

CREATE POLICY "a player changes their realm only through the orders function" ON "public"."game_players"
  FOR UPDATE
  TO PUBLIC
  USING ((user_id = auth.uid()))
  WITH CHECK (false);
