-- The Overlord revokes a Game Master (P0-32b). Refused while that account runs any game that isn't complete,
-- archived or not: the Overlord hands those games over first (D-13f; reassign_game, P0-32e). Revoking
-- deletes the row.
CREATE OR REPLACE FUNCTION public.gm_revoke(p_user uuid)
  RETURNS void
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
begin
  if not public.is_site_admin() then
    raise exception 'Only the Overlord can revoke a Game Master.';
  end if;
  if not exists (select 1 from public.game_masters where user_id = p_user and accepted_at is not null) then
    raise exception 'That account isn''t a Game Master.';
  end if;
  if exists (select 1 from public.games where gm_user_id = p_user and status <> 'complete') then
    raise exception 'That Game Master runs an unfinished game: hand it over first.';
  end if;
  delete from public.game_masters where user_id = p_user;
end
$function$;

REVOKE ALL ON FUNCTION "public"."gm_revoke"(uuid) FROM PUBLIC;

REVOKE ALL ON FUNCTION "public"."gm_revoke"(uuid) FROM "anon";

REVOKE ALL ON FUNCTION "public"."gm_revoke"(uuid) FROM "authenticated";

GRANT EXECUTE ON FUNCTION "public"."gm_revoke"(uuid) TO "authenticated";

GRANT EXECUTE ON FUNCTION "public"."gm_revoke"(uuid) TO "service_role";
