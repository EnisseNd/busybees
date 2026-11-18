-- Tray profiles, imported calendars, and a suggested plan on each match.
-- Safe to run more than once. Run it in the Supabase SQL editor after schema.sql.

-- A first name and a five-item tray, both visible to people you are matched with
-- (the existing users_select_related policy already covers that).
alter table public.users add column if not exists first_name text;
alter table public.users add column if not exists tray jsonb not null default '[]'::jsonb;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'users_first_name_length') then
    alter table public.users
      add constraint users_first_name_length
      check (first_name is null or char_length(first_name) between 1 and 40);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'users_tray_shape') then
    alter table public.users
      add constraint users_tray_shape
      check (
        jsonb_typeof(tray) = 'array'
        and jsonb_array_length(tray) <= 5
        and pg_column_size(tray) <= 600000
      );
  end if;
end $$;

-- Students cannot update their users row directly (college, year and email stay
-- fixed). This function changes only the caller's first name and tray.
create or replace function public.save_tray(p_first_name text, p_tray jsonb)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then
    raise exception 'Sign in required';
  end if;

  update public.users
    set first_name = nullif(btrim(p_first_name), ''),
        tray = coalesce(p_tray, '[]'::jsonb)
    where id = uid;

  if not found then
    raise exception 'Profile not found';
  end if;
end;
$$;

revoke all on function public.save_tray(text, jsonb) from public, anon;
grant execute on function public.save_tray(text, jsonb) to authenticated;

-- Imported calendar events. Private: only the owner can read the table. The
-- weekly match job reads it with the service role. Migration 002 adds
-- match_availability, which shows hour-level free time to someone you have an
-- open match with. Event names are not part of that view.
create table if not exists public.calendars (
  user_id uuid primary key references public.users (id) on delete cascade,
  events jsonb not null default '[]'::jsonb,
  source text not null default 'ics',
  updated_at timestamptz not null default now(),
  constraint calendars_events_shape check (
    jsonb_typeof(events) = 'array' and pg_column_size(events) <= 1000000
  )
);

alter table public.calendars enable row level security;
revoke all on table public.calendars from public, anon, authenticated;
grant select, insert, update, delete on table public.calendars to authenticated;

drop policy if exists calendars_select_own on public.calendars;
create policy calendars_select_own
  on public.calendars for select to authenticated
  using (user_id = auth.uid());

drop policy if exists calendars_insert_own on public.calendars;
create policy calendars_insert_own
  on public.calendars for insert to authenticated
  with check (user_id = auth.uid());

drop policy if exists calendars_update_own on public.calendars;
create policy calendars_update_own
  on public.calendars for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists calendars_delete_own on public.calendars;
create policy calendars_delete_own
  on public.calendars for delete to authenticated
  using (user_id = auth.uid());

-- { "date": "2026-11-19", "hour": 12, "activity": "Lunch", "place": "Saybrook dining hall" }
alter table public.matches add column if not exists plan jsonb;
