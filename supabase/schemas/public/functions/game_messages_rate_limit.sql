-- At most 10 dispatches a minute and 300 a day, per player per game (P0-23, ruling D-05). A trigger on
-- game_messages, before each insert; security definer, so it counts every one of the sender's dispatches, whatever
-- they may read. The player portal shows its messages as they are. No API role calls it.
CREATE OR REPLACE FUNCTION public.game_messages_rate_limit()
  RETURNS trigger
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
declare n_minute int; n_day int;
begin
  select count(*) filter (where m.created_at > now() - interval '1 minute'), count(*)
    into n_minute, n_day
  from public.game_messages m
  where m.game_id = new.game_id and m.from_user_id = new.from_user_id and m.created_at > now() - interval '1 day';
  if n_minute >= 10 then
    raise exception 'You''re sending dispatches too quickly. Try again in a minute.' using hint = 'kc_dispatch_rate';
  end if;
  if n_day >= 300 then
    raise exception 'You''ve sent 300 dispatches in this game today, the most allowed. Try again tomorrow.' using hint = 'kc_dispatch_rate';
  end if;
  return new;
end
$function$;

REVOKE ALL ON FUNCTION "public"."game_messages_rate_limit"() FROM PUBLIC;

REVOKE ALL ON FUNCTION "public"."game_messages_rate_limit"() FROM "anon";

REVOKE ALL ON FUNCTION "public"."game_messages_rate_limit"() FROM "authenticated";

GRANT EXECUTE ON FUNCTION "public"."game_messages_rate_limit"() TO "service_role";
