# Khiaty

A small two-sided tailoring marketplace: customers post requests, tailors bid blind, the customer accepts and pays, chat unlocks, the order moves through stages, and the customer reviews.

## Run it

Backed by a Supabase project (Postgres, Auth, Realtime, Storage). You need its secrets in `.env`
(copy `.env.example`): the database password (Dashboard -> Connect) and the `service_role` key
(Dashboard -> Project Settings -> API Keys). Then:

```bash
npm install
npm run setup   # once: pushes the Prisma schema and seeds demo accounts + data
npm run dev
```

Open http://localhost:3000. For new sign-ups to log in immediately, turn off
"Confirm email" under Authentication -> Sign In / Providers -> Email in the dashboard.

| Command | What it does |
|---|---|
| `npm run setup` | Sync schema to Postgres, generate the client, seed |
| `npm run db:seed` | Reset all data (and demo auth users) back to the demo state |
| `npm run dev` | Start the app |
| `npm run build` | Production build (also typechecks and lints) |

Supabase-specific SQL (profile trigger, RLS, Realtime publication, storage bucket) lives in
`supabase/migrations/` and is applied to the project already; `0001_schema.sql` mirrors the Prisma schema.

## Demo accounts

Every account uses the `DEMO_PASSWORD` you set in `.env`. When running locally, the login page shows it; the deployed site does not.

| Email | Role |
|---|---|
| customer1@demo.test | Customer (Amina) |
| customer2@demo.test | Customer (Omar) |
| tailor1@demo.test | Provider (Layla's Atelier) |
| tailor2@demo.test | Provider (Hassan Bespoke) |
| tailor3@demo.test | Provider (Nour Stitchworks) |

## Stack

Next.js 15 (App Router, Server Actions), Prisma on Supabase Postgres, Supabase Auth (`@supabase/ssr`), Supabase Realtime for chat, Supabase Storage for photos, Tailwind, Zod.

## Where the rules live

| Rule | File |
|---|---|
| Sign in / sign up / sign out (Supabase Auth) | `lib/actions/auth.ts`, `middleware.ts` |
| `requireUser`, `requireRole` (auth user -> User row with role) | `lib/auth.ts` |
| Profile creation on sign-up, RLS, Realtime publication | `supabase/migrations/0002_auth_rls_realtime.sql` |
| Create request (customers only), photo upload to private bucket | `lib/actions/requests.ts`, `lib/storage.ts` |
| Place / revise bids, accept / decline | `lib/actions/bids.ts` |
| Blind bidding (provider query returns only a count) | `app/requests/[id]/page.tsx` (`ProviderBids`), `app/provider/page.tsx` |
| Order state machine, who may transition | `lib/orders/stateMachine.ts` |
| Payment callback verification | `app/api/payments/callback/route.ts` |
| Chat gating (paid or later, parties only) | `lib/actions/chat.ts` (writes), RLS policy on `Message` (Realtime reads) |
| Reviews (completed orders, once) | `lib/actions/reviews.ts` |
| Photo access control (signed URL only after page-level check) | `app/requests/[id]/page.tsx`, `lib/storage.ts` |

Append-only tables: `BidRevision`, `OrderEvent`, `Message`, `Review`.
