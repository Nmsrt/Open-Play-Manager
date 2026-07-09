# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev       # start dev server (Vite)
npm run build     # tsc -b type-check, then vite build to dist/
npm run preview   # preview the production build
```

No lint or test scripts are configured. Type errors surface via `npm run build` (`tsc -b`).

Local Supabase (optional, for DB work):

```bash
supabase init && supabase start
supabase db reset   # applies supabase/migrations/*.sql in order
```

## Architecture

Static SPA: Vite + React + TypeScript + Tailwind + `@supabase/supabase-js`. **No server
runtime** — there is no backend code to write; all business logic that needs to be trusted
lives in Postgres (RLS policies, check constraints, security-definer RPCs/triggers) under
`supabase/migrations/`. Treat the React app as fully public/untrusted client code.

### Two surfaces, one app

- **Public** (`src/pages/public/`, routes `/` and `/session/:id`) — no auth. Players view
  open sessions, register, submit payment proof, view published rosters.
- **Admin** (`src/pages/admin/`, routes under `/admin`) — behind `ProtectedRoute` (Supabase
  Auth session check) and `AdminLayout`. Manage sessions, verify payments, build teams,
  publish rosters, print them.

`src/App.tsx` lazy-loads the entire admin surface (including `dnd-kit`) so public visitors —
mostly on phones at the pitch — never download it. If `VITE_SUPABASE_URL`/`VITE_SUPABASE_ANON_KEY`
are missing, the app renders a setup screen instead of querying (`isSupabaseConfigured` in
`src/lib/supabase.ts`) — don't throw at module load, it blanks the page.

### Session sizing is data-driven, not hardcoded

`sessions.format`, `players_per_team`, and `team_count` are independent columns;
`max_players` is a generated column (`players_per_team × team_count`). Capacity, waitlist,
and team-balance logic everywhere reads these fields rather than assuming a fixed format —
see `PLAYERS_PER_TEAM_OPTIONS` in `src/lib/types.ts` for what the admin UI currently exposes
(5-a-side and freeform `custom` remain valid at the DB/API level even though the admin form
doesn't expose them).

### Security boundary is Postgres, not React

- Anon key ships to the browser; RLS in `supabase/migrations/0001_init.sql` is written
  assuming the React app doesn't exist. When changing access rules, edit the migration/RLS
  policy, not client-side checks.
- Registration goes through the `register_player()` security-definer RPC (atomic
  player+payment insert, duplicate-email check, capacity check with row lock, waitlist
  placement) — don't reimplement this as separate client-side inserts.
- Player PII (email, phone) is not selectable by anon. The public slot counter reads a
  trigger-maintained `sessions.registered_count`, not the `players` table.
- Admin membership is `admin_users` + `is_admin()`, not merely "authenticated" — staff sign
  in to one shared real Supabase Auth account (email must match `VITE_ADMIN_EMAIL`).
- Payment proof images live in the private `payment-proofs` bucket; admin views them via
  short-lived signed URLs, never public URLs.
- New migrations go in `supabase/migrations/` as additive, numbered files (`0004_*.sql`) —
  don't edit already-applied migrations.

### Key files

- `src/lib/types.ts` — all domain types (`Session`, `Player`, `Payment`, `Team`,
  `TeamAssignment`, view rows) and shared enums/option lists. Start here when touching data
  shapes.
- `src/lib/validation.ts` — Zod schemas mirroring the Postgres check constraints; keep both
  in sync when changing a validated field.
- `src/lib/supabase.ts` — client init and `isSupabaseConfigured`.
- `src/components/ui/` — small local UI primitives (button, dialog, table, etc.), not an
  external library.
