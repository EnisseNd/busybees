-- SocialSync schema
-- Run once in the Supabase SQL editor (it runs as a privileged role).
--
-- Chat is one row per unordered pair. user_id is the lower uuid and
-- matched_user_id is the higher one, so the same two people are not stored
-- twice. Each person records a response. status becomes mutual only when
-- both are interested, and messages are readable only then.
--
-- user_response and matched_response are extra columns. A single status
-- cannot remember two decisions.

create extension if not exists pgcrypto;

create table public.users (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null unique,
  college text not null,
  class_year integer not null,
  created_at timestamptz not null default now(),
  constraint users_email_yale check (email ~* '^[^@[:space:]]+@yale\.edu$'),
  constraint users_class_year_range check (class_year between 2020 and 2040),
  constraint users_college_known check (
    college in (
      'Benjamin Franklin',
      'Berkeley',
      'Branford',
      'Davenport',
      'Ezra Stiles',
      'Grace Hopper',
      'Jonathan Edwards',
      'Morse',
      'Pauli Murray',
      'Pierson',
      'Saybrook',
      'Silliman',
      'Timothy Dwight',
      'Trumbull'
    )
  )
);

create table public.questionnaires (
  user_id uuid primary key references public.users (id) on delete cascade,
  answers jsonb not null default '{}'::jsonb,
  looking_for_study_buddy boolean not null default false,
  updated_at timestamptz not null default now()
);

create table public.matches (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users (id) on delete cascade,
  matched_user_id uuid not null references public.users (id) on delete cascade,
  week_start date not null,
  match_type text not null,
  score numeric(5, 2) not null,
  why_matched text not null,
  status text not null default 'pending',
  user_response text not null default 'pending',
  matched_response text not null default 'pending',
  created_at timestamptz not null default now(),
  constraint matches_type check (match_type in ('friend', 'study')),
  constraint matches_score check (score >= 0 and score <= 100),
  constraint matches_status check (status in ('pending', 'mutual', 'closed')),
  constraint matches_user_response check (user_response in ('pending', 'interested', 'passed')),
  constraint matches_matched_response check (matched_response in ('pending', 'interested', 'passed')),
  constraint matches_why_length check (char_length(why_matched) between 1 and 400),
  constraint matches_distinct_users check (user_id <> matched_user_id),
  constraint matches_canonical_order check (user_id::text < matched_user_id::text),
  constraint matches_pair_week unique (user_id, matched_user_id, week_start, match_type)
);

create table public.messages (
  id uuid primary key default gen_random_uuid(),
  match_id uuid not null references public.matches (id) on delete cascade,
  sender_id uuid not null references public.users (id) on delete cascade,
  content text not null,
  created_at timestamptz not null default now(),
  constraint messages_content_length check (char_length(content) between 1 and 2000)
);

create index matches_user_week_idx on public.matches (user_id, week_start desc);
create index matches_matched_week_idx on public.matches (matched_user_id, week_start desc);
create index messages_match_created_idx on public.messages (match_id, created_at);

-- Profile row is created from the sign-up metadata. A non-Yale email or a
-- missing college fails the whole auth insert, so the account is not created.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  college_value text;
  year_value integer;
begin
  if new.email is null or new.email !~* '^[^@[:space:]]+@yale\.edu$' then
    raise exception 'SocialSync is limited to @yale.edu addresses';
  end if;

  college_value := nullif(trim(new.raw_user_meta_data ->> 'college'), '');
  year_value := nullif(new.raw_user_meta_data ->> 'class_year', '')::integer;

  if college_value is null or year_value is null then
    raise exception 'Residential college and class year are required';
  end if;

  insert into public.users (id, email, college, class_year)
  values (new.id, lower(new.email), college_value, year_value);

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists questionnaires_touch_updated_at on public.questionnaires;
create trigger questionnaires_touch_updated_at
  before update on public.questionnaires
  for each row execute function public.touch_updated_at();

-- Students cannot update match rows directly. This function records only the
-- caller's response, then sets status to mutual or closed.
create or replace function public.respond_to_match(target_match uuid, response text)
returns public.matches
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  row public.matches;
begin
  if uid is null then
    raise exception 'Sign in required';
  end if;

  if response not in ('interested', 'passed') then
    raise exception 'Response must be interested or passed';
  end if;

  select * into row from public.matches where id = target_match;
  if not found then
    raise exception 'Match not found';
  end if;

  if row.user_id = uid then
    update public.matches
      set user_response = response
      where id = target_match
      returning * into row;
  elsif row.matched_user_id = uid then
    update public.matches
      set matched_response = response
      where id = target_match
      returning * into row;
  else
    raise exception 'Not a participant';
  end if;

  if row.user_response = 'passed' or row.matched_response = 'passed' then
    update public.matches set status = 'closed' where id = target_match returning * into row;
  elsif row.user_response = 'interested' and row.matched_response = 'interested' then
    update public.matches set status = 'mutual' where id = target_match returning * into row;
  else
    update public.matches set status = 'pending' where id = target_match returning * into row;
  end if;

  return row;
end;
$$;

revoke all on function public.handle_new_user() from public, anon, authenticated;
revoke all on function public.touch_updated_at() from public, anon, authenticated;
revoke all on function public.respond_to_match(uuid, text) from public, anon;
grant execute on function public.respond_to_match(uuid, text) to authenticated;

alter table public.users enable row level security;
alter table public.questionnaires enable row level security;
alter table public.matches enable row level security;
alter table public.messages enable row level security;

revoke all on table public.users from public, anon, authenticated;
revoke all on table public.questionnaires from public, anon, authenticated;
revoke all on table public.matches from public, anon, authenticated;
revoke all on table public.messages from public, anon, authenticated;

grant select on table public.users to authenticated;
grant select, insert, update on table public.questionnaires to authenticated;
grant select on table public.matches to authenticated;
grant select, insert on table public.messages to authenticated;

-- A student can read their own profile and the college/year of someone they
-- have already been matched with. Email stays off the match cards in the app.
create policy users_select_related
  on public.users
  for select
  to authenticated
  using (
    id = auth.uid()
    or exists (
      select 1
      from public.matches
      where
        (matches.user_id = auth.uid() and matches.matched_user_id = users.id)
        or (matches.matched_user_id = auth.uid() and matches.user_id = users.id)
    )
  );

create policy questionnaires_select_own
  on public.questionnaires
  for select
  to authenticated
  using (user_id = auth.uid());

create policy questionnaires_insert_own
  on public.questionnaires
  for insert
  to authenticated
  with check (user_id = auth.uid());

create policy questionnaires_update_own
  on public.questionnaires
  for update
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy matches_select_participant
  on public.matches
  for select
  to authenticated
  using (user_id = auth.uid() or matched_user_id = auth.uid());

-- Messages exist only after both people tap Interested.
create policy messages_select_mutual
  on public.messages
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.matches
      where
        matches.id = messages.match_id
        and matches.status = 'mutual'
        and (matches.user_id = auth.uid() or matches.matched_user_id = auth.uid())
    )
  );

create policy messages_insert_mutual
  on public.messages
  for insert
  to authenticated
  with check (
    sender_id = auth.uid()
    and exists (
      select 1
      from public.matches
      where
        matches.id = messages.match_id
        and matches.status = 'mutual'
        and (matches.user_id = auth.uid() or matches.matched_user_id = auth.uid())
    )
  );

do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'messages'
  ) then
    alter publication supabase_realtime add table public.messages;
  end if;
end $$;
