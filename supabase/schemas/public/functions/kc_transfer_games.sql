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

GRANT EXECUTE ON FUNCTION "public"."kc_transfer_games"(text[], text) TO "anon", "authenticated";

GRANT EXECUTE ON FUNCTION "public"."kc_transfer_games"(text[], text) TO "service_role";

REVOKE ALL ON FUNCTION "public"."kc_transfer_games"(text[], text) FROM PUBLIC;

REVOKE ALL ON FUNCTION "public"."kc_transfer_games"(text[], text) FROM "postgres";

GRANT EXECUTE ON FUNCTION "public"."kc_transfer_games"(text[], text) TO "postgres";
