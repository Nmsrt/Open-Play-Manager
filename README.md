<div align="center">

<!-- Replace with your project logo or banner -->
<img src="https://via.placeholder.com/120x120.png?text=LOGO" alt="Project Logo" width="120" height="120" />

<h1>OpenPlay</h1>

<p><em>Football open-play session manager — a static SPA for running pickup/open-play sessions, built with React, TypeScript, and Supabase.</em></p>

[![License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![Version](https://img.shields.io/badge/version-2.0.0-green.svg)](https://github.com/Nmsrt/Open-Play-Manager/releases)
[![Build Status](https://img.shields.io/github/actions/workflow/status/Nmsrt/Open-Play-Manager/ci.yml?branch=main)](https://github.com/Nmsrt/Open-Play-Manager/actions)
[![Issues](https://img.shields.io/github/issues/Nmsrt/Open-Play-Manager)](https://github.com/Nmsrt/Open-Play-Manager/issues)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](CONTRIBUTING.md)

</div>

---

## Table of Contents

- [Overview](#overview)
- [Features](#features)
- [Tech Stack](#tech-stack)
- [Getting Started](#getting-started)
  - [Prerequisites](#prerequisites)
  - [Installation](#installation)
- [Session Formats](#session-formats)
- [Security Model](#security-model)
  - [Verifying RLS from outside the app](#verifying-rls-from-outside-the-app)
- [Deploy](#deploy)
- [Project Structure](#project-structure)
- [Not Implemented](#not-implemented)
- [License](#license)
- [Contact](#contact)

---

## Overview

OpenPlay is a static single-page app for managing football (soccer) open-play sessions. It
has two surfaces: a public side where players see open sessions, register, and submit
payment proof; and an admin side where staff verify payments, drag-and-drop players into
balanced teams, and publish/print rosters.

There is **no server runtime** — all business logic that needs to be trusted (capacity
checks, waitlist placement, payment verification, admin membership) lives in Postgres via
Supabase RLS policies, check constraints, and security-definer RPCs/triggers. The React app
is treated as fully public, untrusted client code.

---

## Features

- ✅ **Public session browsing** — Live slot counter, no login required.
- ✅ **Player registration** — Name, contact, position, skill, team preference; optional
  payment proof image upload.
- ✅ **Admin dashboard** — Supabase Auth login; create/manage sessions, review registrants.
- ✅ **Payment verification** — Admins verify or reject submitted payments before a player
  is confirmed.
- ✅ **Drag-and-drop team builder** — Assign players into balanced teams (`dnd-kit`).
- ✅ **Published rosters** — Publish and print final team rosters for players to view.
- ✅ **Data-driven session sizing** — Format, players-per-team, and team count are columns,
  not hardcoded assumptions.
- 🔜 **Email notifications** — Registration confirmation / waitlist promotion (needs an
  edge function).

---

## Tech Stack

| Layer | Technology |
|---|---|
| Language | [TypeScript](https://www.typescriptlang.org/) |
| Framework | [React 18](https://react.dev/) |
| Build tool | [Vite 6](https://vitejs.dev/) |
| Styling | [Tailwind CSS 4](https://tailwindcss.com/) |
| Backend | [Supabase](https://supabase.com/) (Postgres, Auth, Storage, RLS) |
| Forms/validation | `react-hook-form` + `zod` |
| Drag-and-drop | `@dnd-kit` |
| UI primitives | `@radix-ui` (local wrappers in `src/components/ui/`) |

---

## Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) `>= 18`
- A [Supabase](https://supabase.com/) project (hosted, or `supabase init && supabase start` locally)

### Installation

1. **Clone the repository:**
   ```bash
   git clone https://github.com/Nmsrt/Open-Play-Manager.git
   cd Open-Play-Manager
   ```

2. **Create the Supabase project and apply the migration:**
   - Create a project at [supabase.com](https://supabase.com), or run Supabase locally.
   - Apply `supabase/migrations/0001_init.sql` — hosted: paste into the SQL editor or
     `supabase link --project-ref <ref> && supabase db push`; local: `supabase db reset`
     picks it up automatically.

3. **Disable public sign-ups** — Dashboard → **Authentication → Sign In / Up → disable
   "Allow new users to sign up"**. Only the single admin account you create manually should
   exist. Also configure **Authentication → Rate Limits** to throttle failed logins.

4. **Create the shared staff account** — staff sign in with one shared password, backed by
   a single real Supabase Auth account (keeps `auth.uid()` as the actual RLS boundary):
   - Dashboard → **Authentication → Users → Add user** — email must match `VITE_ADMIN_EMAIL`,
     password is whatever staff should type, "Auto confirm user" on.
   - Copy the user's UUID, then in the SQL editor:
     ```sql
     insert into public.admin_users (user_id) values ('<the-user-uuid>');
     ```
   - Staff can change this password themselves later from **Admin → Change password** — no
     dashboard access needed after initial setup.

5. **Configure and run the app:**
   ```bash
   cp .env.example .env   # fill in VITE_SUPABASE_URL + VITE_SUPABASE_ANON_KEY + VITE_ADMIN_EMAIL
   npm install
   npm run dev
   ```

   Only the anon (public) key goes in `.env`. **Never** put the service role key in this
   repo, the client bundle, or any `VITE_`-prefixed variable.

---

## Session Formats

Nothing is hardcoded to a team size. Each session sets `format` (5/7/11-a-side or custom),
`players_per_team`, and `team_count`; `max_players` is a generated column
(`players_per_team × team_count`) that drives capacity, the waitlist, and team-balance
warnings everywhere.

---

## Security Model

- The anon key ships to every browser; RLS policies in `0001_init.sql` are written as if
  the React app didn't exist.
- Anon can: `SELECT` non-draft sessions/teams and the narrow `public_rosters` /
  `team_preference_counts` views (no PII), `INSERT` into `players`/`payments` for open
  sessions only, and call the `register_player` RPC. No `UPDATE`/`DELETE` anywhere.
- Player rows (emails, phones) are **not** readable by anon. The public slot counter works
  off a trigger-maintained `sessions.registered_count`, so realtime never leaks player rows.
- Registration uses the `register_player()` security-definer RPC: atomic player+payment
  insert, duplicate-email check, capacity check with row lock, waitlist placement. A unique
  index on `(session_id, lower(email))` backs this at the DB level.
- Postgres check constraints re-validate everything Zod checks client-side (email format,
  phone shape, amount > 0, name/notes lengths).
- Proof-of-payment images live in the **private** `payment-proofs` bucket (5 MB,
  jpeg/png/webp enforced by bucket config). Admin views them via short-lived signed URLs.
- Admin actions (payment status changes, team assignments) are written to `audit_log` by
  security-definer triggers.

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

---

## Deploy

`npm run build` produces a static `dist/`. One-command deploys:

```bash
npx vercel deploy --prod            # Vercel
npx netlify deploy --prod -d dist   # Netlify
npx wrangler pages deploy dist      # Cloudflare Pages
```

Set `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` in the host's env settings. For SPA
routing, configure a catch-all rewrite to `/index.html` (Vercel/Netlify: add a rewrite
rule; Cloudflare Pages does this automatically for single-page apps).

---

## Project Structure

```
Open-Play-Manager/
├── src/
│   ├── pages/
│   │   ├── public/            # Public routes: /, /session/:id
│   │   └── admin/             # Admin routes, behind ProtectedRoute
│   ├── components/ui/         # Local UI primitives (button, dialog, table, etc.)
│   └── lib/
│       ├── types.ts           # Domain types and shared enums/option lists
│       ├── validation.ts      # Zod schemas mirroring Postgres check constraints
│       └── supabase.ts        # Supabase client init and isSupabaseConfigured
├── supabase/
│   └── migrations/            # Additive, numbered SQL migrations (0001_init.sql, ...)
├── .env.example
└── README.md
```

---

## Not Implemented

- Email notifications (registration confirmation, waitlist promotion) — needs a Supabase
  Edge Function + Resend on `players` inserts/updates.
- Weather widget and QR check-in scanning were skipped; day-of check-in exists as a toggle
  in the admin players table.

---

## License

This project is open-source and available for personal use and inspiration.

---

## Contact

**Neo Monserrat** — neo.monserrat@gmail.com

Project Link: [https://github.com/Nmsrt/Open-Play-Manager](https://github.com/Nmsrt/Open-Play-Manager)

---

<div align="center">
  <sub>Built with ❤️ by <a href="https://github.com/Nmsrt">Nmsrt</a></sub>
</div>
