-- The Overlord corrects a player's name on the Hall of Fame (P0-22, ruling D-11). The name only, trimmed, never
-- blank; the board reads names live, so it changes on every game they've played. A function rather than an access
-- rule, so nothing but the name can change and only for the Overlord.
CREATE OR REPLACE FUNCTION public.rename_player(p_user uuid, p_name text)
  RETURNS void
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
begin
  if not public.is_site_admin() then
    raise exception 'Only the Overlord renames players.';
  end if;
  if coalesce(btrim(p_name), '') = '' then
    raise exception 'A player needs a name.';
  end if;
  update public.profiles set name = btrim(p_name) where id = p_user;
  if not found then
    raise exception 'No such player.';
  end if;
end
$function$;

REVOKE ALL ON FUNCTION "public"."rename_player"(uuid, text) FROM PUBLIC;

REVOKE ALL ON FUNCTION "public"."rename_player"(uuid, text) FROM "anon";

REVOKE ALL ON FUNCTION "public"."rename_player"(uuid, text) FROM "authenticated";

GRANT EXECUTE ON FUNCTION "public"."rename_player"(uuid, text) TO "authenticated";

GRANT EXECUTE ON FUNCTION "public"."rename_player"(uuid, text) TO "service_role";
