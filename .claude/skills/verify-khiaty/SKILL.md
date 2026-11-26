---
name: verify-khiaty
description: Launch a throwaway local Khiaty (Next.js tailoring marketplace) and drive its web UI in Chrome to prove a change works, with screenshots. Use before saying a Khiaty feature or bug fix is done, on every PR, or when asked to verify, smoke-test or demo Khiaty locally.
---

# verify-khiaty

Proves Khiaty behavior by using the real web UI the way a customer or tailor does. Everything runs on
this machine: a disposable Postgres, a local stand-in for Supabase Auth, and `next dev`. It never
touches the live Supabase project or https://khiaty-phi.vercel.app.

All scripts live in `.claude/skills/verify-khiaty/scripts/`. Run them from the repo root.

| Piece | Where | Port |
|---|---|---|
| Postgres 17 (Homebrew `postgresql@17`), db `khiaty_verify` | `$TMPDIR/khiaty-verify/pg` | 55432 |
| Fake Supabase Auth (`scripts/fake-auth.mjs`) | same run dir | 54399 |
| App (`next dev`) | repo checkout | 3100 |
| Evidence (gitignored) | `.verify-evidence/<journey>-<time>/` | |

Ports and dirs can be moved with `KHIATY_PG_PORT`, `KHIATY_AUTH_PORT`, `KHIATY_APP_PORT`,
`KHIATY_VERIFY_RUN`, `KHIATY_VERIFY_EVIDENCE`.

## Launch

```bash
.claude/skills/verify-khiaty/scripts/launch.sh
```

From nothing it: creates the Postgres cluster and database, runs `prisma db push` + `prisma generate`,
starts fake auth, runs `npm run db:seed` (5 demo users, 4 requests, bids, 2 orders), starts `next dev`.
Ready when it prints `READY http://127.0.0.1:3100` (the login page has rendered, not just an open port).
It refuses to start if a port is taken. First launch takes about 30 s; most of it is Next compiling.

Every setting comes from `scripts/env.sh`, which sets all Supabase and database variables to local
values. Process env wins over `.env`, so a real `.env` in the checkout is never read for these keys.
Do not create or edit `.env` for verification.

Prerequisites: `brew install postgresql@17`, Google Chrome in `/Applications`, `npm install`.

## Doctor

```bash
.claude/skills/verify-khiaty/scripts/doctor.sh
```

Read-only. Prints PASS/FAIL per check and exits non-zero on any FAIL: Postgres up, both processes
started by this run (pid files), port 3100 owned by our `next dev`, 5 demo users in fake auth,
seeded requests in the DB, the app's CSP names `127.0.0.1:54399` and not `supabase.co` (proof it talks
to the fake, not production), login page renders. Run it first whenever anything looks off.

## Drive

```bash
.claude/skills/verify-khiaty/scripts/drive.sh <journey> [--headed]
```

Journeys (Playwright via `playwright-core` + your installed Chrome, headless by default):

| Journey | Feature file | What it proves |
|---|---|---|
| `sign-in` | `features/auth.md` | customer and tailor land on their homes; signed-out user is sent to `/login` |
| `post-request` | `features/post-request.md` | customer posts a request; it shows on its page and in My requests |
| `bid-and-accept` | `features/bid-and-accept.md` | post, tailor bids, customer accepts, order page opens as Accepted |

Each prints `PASS <journey> evidence=<dir>` or `FAIL <journey>: <reason> evidence=<dir>` (with a
`failure` screenshot). Demo logins: `customer1@demo.test`, `customer2@demo.test`, `tailor1@demo.test`,
`tailor2@demo.test`, `tailor3@demo.test`; password `verify-demo-password` (local only, from `env.sh`).

Handles to use when adding journeys: form fields are `<label>`-wrapped, so `getByLabel("Title")`,
`getByLabel("Budget (USD)")`, `getByLabel("Price (USD)")`, `getByLabel("Timeline (days)")`; buttons by
role and name (`Sign in`, `Post request`, `Submit bid`, `Accept`, `Decline`, `Log out`); headings
`My requests` (customer home), `Open requests` (tailor home), `Your bid`. Add a journey as a new entry
in the `journeys` object in `scripts/drive.mjs`, and a feature file for it.

To check a stored side effect, query the local DB:

```bash
/opt/homebrew/opt/postgresql@17/bin/psql -h 127.0.0.1 -p 55432 -U postgres -d khiaty_verify \
  -c 'select title, status from "Request" order by "createdAt" desc limit 3'
```

## Evidence

Every step saves `NN-<step>.png` (full page) and `NN-<step>.aria.txt` (URL + accessibility snapshot) in
`.verify-evidence/<journey>-<time>/`. Proof standards:

- Drive the real UI path a user takes; no test-only endpoints, no direct DB writes to fake a state.
- Capture the action and the resulting state (the drive scripts screenshot before and after).
- Check side effects too: the new row in Postgres, not only what the page shows.
- In the PR, list each scenario with PASS/FAIL and the evidence paths.

## Cleanup

```bash
.claude/skills/verify-khiaty/scripts/cleanup.sh
```

Stops only the processes in this run's pid files and their children, stops Postgres, deletes the run
dir. Keeps `.verify-evidence/`. Run it after every attempt, including failed ones.

## Helpers

| Script | Use |
|---|---|
| `scripts/launch.sh` | start everything, seeded |
| `scripts/doctor.sh` | read-only health check |
| `scripts/drive.sh <journey>` | run a browser journey (wraps `drive.mjs` with `env.sh`) |
| `scripts/cleanup.sh` | tear down, keep evidence |
| `scripts/env.sh` | shared settings, sourced by the others (bash) |
| `scripts/fake-auth.mjs` | the Supabase Auth stand-in, started by `launch.sh` |

## What this cannot prove

The fake covers only Auth (sign-up, password sign-in, refresh, `getUser`, sign-out, and the admin user
calls the seed makes) and it writes the `User` profile row like the `on_auth_user_created` trigger.
These parts of Supabase are not running, so changes to them need a check against a real Supabase
(local Docker `supabase start`, never production):

- **Storage**: posting a request with a reference photo fails ("Upload failed"); photos never show.
- **Realtime**: chat on paid orders does not receive live messages.
- **RLS policies and SQL in `supabase/migrations/`**: Prisma connects as the DB owner, so RLS is not
  exercised, and the migrations are not applied (`prisma db push` builds the tables).
- **Real Supabase Auth behavior**: email confirmation, password rules, rate limits, token format.

## Gotchas

- Never run two `next dev` in one checkout (it corrupts `.next`). `launch.sh` warns if one is running;
  stop yours first. Never run `next build` while this instance is up.
- `npm run db:seed` resets all data. Relaunching after a cleanup gives a fresh seeded state.
- Login is rate limited in memory (5 tries per account per 15 min). Repeated failed logins in one run
  lock the account until `next dev` restarts.
