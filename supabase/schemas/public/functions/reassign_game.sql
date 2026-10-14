-- The Overlord hands a game to another Game Master (P0-32e, D-13f), e.g. before revoking its GM (gm_revoke insists).
-- Changes only the game's GM: the new GM's portal picks the game up, and the old GM's can no longer save it, so a
-- turn can't be resolved twice. Refuses anyone but the Overlord, a new GM who isn't a Game Master (an open offer
-- isn't enough) or is the Overlord, and a game that doesn't exist.
CREATE OR REPLACE FUNCTION public.reassign_game(p_game uuid, p_new_gm uuid)
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

REVOKE ALL ON FUNCTION "public"."reassign_game"(uuid, uuid) FROM PUBLIC;

REVOKE ALL ON FUNCTION "public"."reassign_game"(uuid, uuid) FROM "anon";

REVOKE ALL ON FUNCTION "public"."reassign_game"(uuid, uuid) FROM "authenticated";

GRANT EXECUTE ON FUNCTION "public"."reassign_game"(uuid, uuid) TO "authenticated";

GRANT EXECUTE ON FUNCTION "public"."reassign_game"(uuid, uuid) TO "service_role";
