-- The Overlord deletes an account (P0-32h, R-097, D-13 follow-up 2). Refused while it runs an unfinished game (hand
-- it over first: reassign_game) or plays in one (suspend it instead until the game ends: account_suspend). Then the
-- sign-in account goes, and with it its profile and its Game Master row (their foreign keys cascade) and its
-- Dispatches read markers (no foreign key: deleted here). Its finished games stay: its realm slots with no account,
-- a game it ran with no GM; its dispatches and Hall of Fame records stay too. Refuses anyone but the Overlord, the
-- Overlord's own account and an account that doesn't exist.
CREATE OR REPLACE FUNCTION public.account_delete(p_user uuid)
  RETURNS void
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
begin
  if not public.is_site_admin() then
    raise exception 'Only the Overlord can delete an account.';
  end if;
  if exists (select 1 from public.site_admins where user_id = p_user) then
    raise exception 'This doesn''t work on the Overlord''s own account.';
  end if;
  if not exists (select 1 from auth.users where id = p_user) then
    raise exception 'No such account.';
  end if;
  if exists (select 1 from public.games where gm_user_id = p_user and status <> 'complete') then
    raise exception 'That account runs an unfinished game: hand it over first.';
  end if;
  if exists (select 1 from public.game_players gp join public.games g on g.id = gp.game_id
             where gp.user_id = p_user and g.status <> 'complete') then
    raise exception 'That account plays in an unfinished game: suspend it instead until the game ends.';
  end if;
  delete from public.game_message_reads where user_id = p_user;
  delete from auth.users where id = p_user;
end
$function$;

REVOKE ALL ON FUNCTION "public"."account_delete"(uuid) FROM PUBLIC;

REVOKE ALL ON FUNCTION "public"."account_delete"(uuid) FROM "anon";

REVOKE ALL ON FUNCTION "public"."account_delete"(uuid) FROM "authenticated";

GRANT EXECUTE ON FUNCTION "public"."account_delete"(uuid) TO "authenticated";

GRANT EXECUTE ON FUNCTION "public"."account_delete"(uuid) TO "service_role";
