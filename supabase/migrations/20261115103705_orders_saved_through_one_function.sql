SET local check_function_bodies = off;

CREATE OR REPLACE FUNCTION public.submit_orders (
  p_game      uuid,
  p_for_turn  integer,
  p_orders    jsonb,
  p_submitted boolean
)
  RETURNS void
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
declare
  -- The late-orders rule (R-184) refuses orders submitted after the deadline. Whether a draft, the order of the
  -- heroes and Revise follow it waits for the maintainers (question 80); until they rule, they do.
  drafts_and_revise_close_at_the_deadline constant boolean := true;
  -- The longest orders saved, in bytes: far above any realm's (the balance matrix's longest are about 1.5 KB).
  longest_orders constant integer := 262144;
  v_realm uuid;
  v_status text;
  v_turn integer;
  v_meta jsonb;
  v_mode jsonb;
  v_deadline timestamptz;
  v_sent jsonb;
begin
  if p_orders is null and p_submitted is null then
    raise exception 'There is nothing to save.';
  end if;
  if p_orders is null and p_submitted then
    raise exception 'Send the orders to submit them.';
  end if;

  select id into v_realm from public.game_players where game_id = p_game and user_id = auth.uid();
  if v_realm is null then
    raise exception 'You hold no realm in this game.';
  end if;

  select status, turn, meta into v_status, v_turn, v_meta from public.games where id = p_game;
  if v_status is distinct from 'active' then
    raise exception 'This game isn''t running: orders are sent only while it is.';
  end if;
  if p_for_turn is distinct from v_turn then
    raise exception 'These orders are for turn %, but the game is on turn %: reload to see the current turn.',
      coalesce(p_for_turn::text, 'none'), v_turn;
  end if;

  v_mode := (case jsonb_typeof(v_meta)
               when 'string' then case when pg_input_is_valid(v_meta #>> '{}', 'jsonb') then (v_meta #>> '{}')::jsonb end
               else v_meta end) -> 'turnMode';
  if jsonb_typeof(v_mode) = 'object' and v_mode ->> 'mode' = 'deadline'
     and pg_input_is_valid(v_mode ->> 'nextDeadlineAt', 'timestamptz') then
    v_deadline := (v_mode ->> 'nextDeadlineAt')::timestamptz;
  end if;
  if now() >= v_deadline and (p_submitted or drafts_and_revise_close_at_the_deadline) then
    raise exception 'This turn''s deadline has passed: orders can no longer be sent or changed.';
  end if;

  if p_orders is not null then
    if octet_length(p_orders::text) > longest_orders then
      raise exception 'These orders are too long to save.';
    end if;
    v_sent := case jsonb_typeof(p_orders)
                when 'string' then case when pg_input_is_valid(p_orders #>> '{}', 'jsonb') then (p_orders #>> '{}')::jsonb end
                else p_orders end;
    if jsonb_typeof(v_sent) is distinct from 'object' then
      raise exception 'Orders are saved as the order form writes them.';
    end if;
    if jsonb_typeof(v_sent -> 'forTurn') is distinct from 'number' or v_sent -> 'forTurn' <> to_jsonb(p_for_turn) then
      raise exception 'These orders don''t name this turn: reload to see the current turn.';
    end if;
  end if;

  update public.game_players
     set orders            = coalesce(p_orders, orders),
         orders_submitted  = coalesce(p_submitted, orders_submitted),
         last_submitted_at = case when p_submitted then now() else last_submitted_at end
   where id = v_realm;
end
$function$;

REVOKE ALL ON FUNCTION "public"."submit_orders"(uuid, integer, jsonb, boolean) FROM PUBLIC, "anon";

GRANT EXECUTE ON FUNCTION "public"."submit_orders"(uuid, integer, jsonb, boolean) TO "authenticated";

REVOKE ALL ON FUNCTION "public"."submit_orders"(uuid, integer, jsonb, boolean) FROM "postgres";

GRANT EXECUTE ON FUNCTION "public"."submit_orders"(uuid, integer, jsonb, boolean) TO "postgres";

GRANT EXECUTE ON FUNCTION "public"."submit_orders"(uuid, integer, jsonb, boolean) TO "service_role";
