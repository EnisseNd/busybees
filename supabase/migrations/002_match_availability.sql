-- Hour-level free time for an open match. Safe to run more than once.
-- Run it in the Supabase SQL editor after 001_trays_and_calendar.sql.
--
-- Calendars stay private. This function is the only way another student can
-- see a schedule, and only if you share an open match. It returns busy
-- blocks with the event name removed. The app turns those into hours.

create or replace function public.strip_busy(raw jsonb)
returns jsonb
language plpgsql
immutable
as $$
declare
  item jsonb;
  out jsonb := '[]'::jsonb;
  day text;
  start_min integer;
  end_min integer;
begin
  if jsonb_typeof(raw) is distinct from 'array' then
    return out;
  end if;

  for item in select value from jsonb_array_elements(raw)
  loop
    begin
      day := item->>'date';
      start_min := trunc((item->>'start')::numeric)::integer;
      end_min := trunc((item->>'end')::numeric)::integer;
    exception
      when others then
        continue;
    end;

    if day is null or day !~ '^\d{4}-\d{2}-\d{2}$' then
      continue;
    end if;
    if start_min < 0 or end_min > 1440 or end_min <= start_min then
      continue;
    end if;

    out := out || jsonb_build_array(
      jsonb_build_object('date', day, 'start', start_min, 'end', end_min)
    );
  end loop;

  return out;
end;
$$;

revoke all on function public.strip_busy(jsonb) from public, anon, authenticated;

create or replace function public.match_availability(target_match uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  match_row public.matches;
  other uuid;
  you_raw jsonb;
  them_raw jsonb;
begin
  if uid is null then
    raise exception 'Sign in required';
  end if;

  select * into match_row from public.matches where id = target_match;
  if not found then
    raise exception 'Match not found';
  end if;

  if match_row.user_id = uid then
    other := match_row.matched_user_id;
  elsif match_row.matched_user_id = uid then
    other := match_row.user_id;
  else
    raise exception 'Not a participant';
  end if;

  if match_row.status = 'closed' then
    return jsonb_build_object('closed', true);
  end if;

  select events into you_raw from public.calendars where user_id = uid;
  select events into them_raw from public.calendars where user_id = other;

  return jsonb_build_object(
    'youConnected', you_raw is not null,
    'themConnected', them_raw is not null,
    'you', public.strip_busy(you_raw),
    'them', public.strip_busy(them_raw)
  );
end;
$$;

revoke all on function public.match_availability(uuid) from public, anon;
grant execute on function public.match_availability(uuid) to authenticated;
