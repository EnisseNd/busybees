# Busy Bees

Platonic friend matching for Yale, with an optional study-buddy path. Matches drop once a week. Chat stays on the site and opens only after both people tap Interested.

<img src="docs/banner/stagehand.svg" width="100%" alt="Stagehand: hear and see a room before you book it">

# Busy Bees


## Stack

- Next.js 16 (App Router, TypeScript, Cache Components)
- Supabase Auth, Postgres, and Realtime
- Tailwind CSS

## Setup

1. Create a Supabase project.
2. In the SQL editor, run [`supabase/schema.sql`](supabase/schema.sql) once.
3. In Authentication → Providers, enable Email. For local testing you can turn off “Confirm email”.
4. In Authentication → URL configuration, set the site URL to `http://localhost:3000` and add `http://localhost:3000/auth/callback` to the redirect allow list.
5. Copy `.env.example` to `.env.local` and fill in the project URL, publishable key, secret key, and `CRON_SECRET`.
6. Install and run:

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). Sign-up accepts `@yale.edu` only. The database trigger stores residential college and class year and rejects anything else.

Set the `NEXT_PUBLIC_*` values before `npm run dev` or `npm run build`. Next inlines them, so a build made without them will keep treating Supabase as unconfigured. Restart the dev server after changing `.env.local`.

## Weekly matches

Friend scores live in [`lib/matching.ts`](lib/matching.ts): `scoreFriendMatch`, `scoreStudyMatch`, and `generateWeeklyMatches`. The cron route calls the generator with the service-role key, which bypasses row-level security. Running it again for the same week does not reset interest or chat.

```bash
curl -X POST http://localhost:3000/api/cron/matches \
  -H "Authorization: Bearer $CRON_SECRET"
```

Point a scheduler at that URL for Mondays at 9:00am America/New_York. `GET` works too, for schedulers that cannot POST. The secret stays in the header.

Each person can receive up to three friend matches. Study matches are a separate list and only include students who opted in.

## Chat

A match row is shared by the pair. Chat unlocks when both responses are `interested` and `status` is `mutual`. The thread uses Supabase Realtime and polls every few seconds so it still updates if replication is off. The schema adds `messages` to the realtime publication.

## Project map

```
app/
  page.tsx                 Login and signup
  questionnaire/page.tsx   Multi-step form
  matches/page.tsx         Friends and study-buddy tabs
  chat/[matchId]/page.tsx  On-site messages
  auth/callback/route.ts   Magic-link return
  api/cron/matches/route.ts
  actions/                 Auth, questionnaire, interest, messages
components/                Forms, match board, chat
lib/
  matching.ts              Scores and weekly generation
  questionnaire.ts         Answer validation
  auth.ts                  Current user
  supabase/                Browser, server, and service-role clients
proxy.ts                   Refreshes the Supabase session
supabase/schema.sql
```

## Notes

- Prompts are saved on the questionnaire and are not shown to a match. The card uses the generated “why you matched” line.
- Questionnaires are private. The match job is the only reader of other people’s answers.
- Profiles expose college and class year to someone you are already matched with. The UI does not show email.
- `user_response` and `matched_response` sit beside `status` so each person can decide independently. One status column cannot store both decisions, and chat needs a single match id.
