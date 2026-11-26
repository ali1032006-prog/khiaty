# Khiaty verification map

The maintained list of what a Khiaty user can do and how to prove each one through the real UI.
Read this index, then the feature file for what you changed.

## Baseline preconditions

- `scripts/launch.sh` printed `READY http://127.0.0.1:3100` and `scripts/doctor.sh` exits 0.
- Seeded state: customer1 (Amina) has 4 requests and 2 orders; tailors 1-3 have bids; password for all
  demo accounts is `verify-demo-password`.
- Never drive an instance this run did not start (doctor checks the pid files).

## Driving conventions

- Run journeys with `scripts/drive.sh <journey>`. Add new journeys to `scripts/drive.mjs`.
- Find elements by label and role name (`getByLabel`, `getByRole`), never by CSS class or position.
- Journeys create rows with unique `Verify: ...` titles, so they can run repeatedly in one launch.

## Proof and skip reporting

- Each step saves a screenshot and an accessibility snapshot in `.verify-evidence/<journey>-<time>/`.
- Pair UI proof with a DB check (`psql`, see SKILL.md) when the change writes data.
- A feature marked "not scripted" or "cannot run here" is reported as not verified, with the reason.
  Never report it as passed through a different feature's journey.

## Feature entry contract

Each feature file: H1 title, one paragraph, then `Sub-features`, `How to get to it (user POV)`,
`Driving it with drive.sh`, `Gotchas`.

## Features

- [Sign in and roles](./auth.md): `sign-in` journey. Scripted, proven.
- [Post a request](./post-request.md): `post-request` journey. Scripted, proven.
- [Bid and accept](./bid-and-accept.md): `bid-and-accept` journey. Scripted, proven.
- [Pay and move an order through stages](./pay-and-progress.md): not scripted yet.
- [Order chat](./chat.md): cannot run here (needs Supabase Realtime).
