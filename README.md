# OpenPlay

Football open-play session manager. Two surfaces:

- **Public** (`/`, `/session/:id`) — no login. Players see open sessions with a live slot
  counter, register (name, contact, position, skill, team preference), submit payment
  details with optional proof image, and view published team rosters.
- **Admin** (`/admin`) — Supabase Auth login. Create/manage sessions, review registrants,
  verify/reject payments, drag-and-drop players into teams, publish rosters, print them.

Static SPA: Vite + React + TypeScript + Tailwind + `@supabase/supabase-js`. No server
runtime — **Supabase RLS is the security boundary**, not the React routes.

## Session formats

Nothing is hardcoded to a team size. Each session sets `format` (5/7/11-a-side or custom),
`players_per_team`, and `team_count`; `max_players` is a generated column
(`players_per_team × team_count`) that drives capacity, the waitlist, and team-balance
warnings everywhere.

## Setup

### 1. Create the Supabase project

1. Create a project at [supabase.com](https://supabase.com) (or `supabase init && supabase start` locally).
2. Apply the migration in `supabase/migrations/0001_init.sql`:
   - Hosted: paste into the SQL editor, or `supabase link --project-ref <ref> && supabase db push`.
   - Local: `supabase db reset` picks it up automatically.

### 2. Disable public sign-ups

Dashboard → **Authentication → Sign In / Up → disable "Allow new users to sign up"**.
Only the single admin account you create manually should exist.

Also configure **Authentication → Rate Limits** to throttle repeated failed logins
(Supabase enforces this server-side; the app adds no client-side lockout theater).

### 3. Create the shared staff account

Staff sign in with a single shared password (no email prompt). Under the hood this
still signs in to one real Supabase Auth account — that's what keeps RLS (`auth.uid()`)
as the actual security boundary.

1. Dashboard → **Authentication → Users → Add user** — email must match `VITE_ADMIN_EMAIL`
   (see step 4), password is whatever staff should type ("Auto confirm user" on).
2. Copy the user's UUID, then in the SQL editor:

   ```sql
   insert into public.admin_users (user_id) values ('<the-user-uuid>');
   ```

Admin policies check membership in `admin_users` via `is_admin()` — *not* merely
`role() = 'authenticated'` — so a stray authenticated account still has no admin access.

Once signed in, staff can change this password themselves from **Admin → Change password**
(top-right of the admin header) — no dashboard access needed after initial setup.

### 4. Configure and run the app

```bash
cp .env.example .env   # fill in VITE_SUPABASE_URL + VITE_SUPABASE_ANON_KEY + VITE_ADMIN_EMAIL
npm install
npm run dev
```

Only the anon (public) key goes in `.env`. **Never** put the service role key in this repo,
the client bundle, or any `VITE_`-prefixed variable.

## Security model

- The anon key ships to every browser; RLS policies in `0001_init.sql` are written as if
  the React app didn't exist.
- Anon can: `SELECT` non-draft sessions/teams and the narrow `public_rosters` /
  `team_preference_counts` views (no PII), `INSERT` into `players`/`payments` for open
  sessions only, and call the `register_player` RPC. No `UPDATE`/`DELETE` anywhere.
- Player rows (emails, phones) are **not** readable by anon. The public slot counter works
  off a trigger-maintained `sessions.registered_count`, so realtime never leaks player rows.
- Registration uses the `register_player()` security-definer RPC: atomic player+payment
  insert, duplicate-email check, capacity check with row lock, waitlist placement.
  A unique index on `(session_id, lower(email))` backs this at the DB level.
- Postgres check constraints re-validate everything Zod checks client-side (email format,
  phone shape, amount > 0, name/notes lengths).
- Proof-of-payment images live in the **private** `payment-proofs` bucket (5 MB,
  jpeg/png/webp enforced by bucket config). Admin views them via short-lived signed URLs.
- Admin actions (payment status changes, team assignments) are written to `audit_log`
  by security-definer triggers.

### Verifying RLS from outside the app

Test with curl and only the anon key — the acceptance criterion is that these behave the
same with the React app deleted:

```bash
export URL="https://<ref>.supabase.co" KEY="<anon-key>"

# Allowed: read open sessions
curl "$URL/rest/v1/sessions?select=*" -H "apikey: $KEY" -H "Authorization: Bearer $KEY"

# Blocked (empty result): reading players (PII)
curl "$URL/rest/v1/players?select=*" -H "apikey: $KEY" -H "Authorization: Bearer $KEY"

# Blocked (RLS error): updating a session
curl -X PATCH "$URL/rest/v1/sessions?id=eq.<session-id>" \
  -H "apikey: $KEY" -H "Authorization: Bearer $KEY" \
  -H "Content-Type: application/json" -d '{"status":"open"}'

# Blocked (RLS error): tampering with a payment
curl -X PATCH "$URL/rest/v1/payments?id=eq.<payment-id>" \
  -H "apikey: $KEY" -H "Authorization: Bearer $KEY" \
  -H "Content-Type: application/json" -d '{"status":"verified"}'
```

`SELECT` on players returns `[]` (no rows visible) and writes return a
`row-level security` error — both are passes.

## Deploy

`npm run build` produces a static `dist/`. One-command deploys:

```bash
npx vercel deploy --prod        # Vercel
npx netlify deploy --prod -d dist   # Netlify
npx wrangler pages deploy dist  # Cloudflare Pages
```

Set `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` in the host's env settings. For SPA
routing, configure a catch-all rewrite to `/index.html` (Vercel/Netlify: add a rewrite
rule; Cloudflare Pages does this automatically for single-page apps).

## Not implemented (needs a server/edge function)

- Email notifications (registration confirmation, waitlist promotion). Wire a Supabase
  Edge Function + Resend on `players` inserts/updates if wanted later.
- Weather widget and QR check-in scanning were skipped; day-of check-in exists as a
  toggle in the admin players table.
