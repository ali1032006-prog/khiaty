# Khiaty

A small two-sided tailoring marketplace: customers post requests, tailors bid blind, the customer accepts and pays, chat unlocks, the order moves through stages, and the customer reviews.

## Run it

```bash
npm install
npm run dev
```

The first `npm run dev` creates the SQLite database, applies migrations and seeds demo data. Open http://localhost:3000.

Useful scripts:

| Command | What it does |
|---|---|
| `npm run dev` | Start the app (sets up the DB on first run) |
| `npm run db:seed` | Reset all data back to the demo state |
| `npm run build` | Production build (also typechecks and lints) |

## Demo accounts

Password for every account: `password123`

| Email | Role |
|---|---|
| customer1@demo.test | Customer (Amina) |
| customer2@demo.test | Customer (Omar) |
| tailor1@demo.test | Provider (Layla's Atelier) |
| tailor2@demo.test | Provider (Hassan Bespoke) |
| tailor3@demo.test | Provider (Nour Stitchworks) |

## Stack

Next.js 15 (App Router, Server Actions), Prisma + SQLite, Tailwind, Zod, bcryptjs, Server-Sent Events for chat. No external services.

## Where the rules live

| Rule | File |
|---|---|
| Sessions, `requireUser`, `requireRole` | `lib/auth.ts` |
| Create request (customers only), photo upload | `lib/actions/requests.ts`, `lib/uploads.ts` |
| Place / revise bids, accept / decline | `lib/actions/bids.ts` |
| Blind bidding (provider query returns only a count) | `app/requests/[id]/page.tsx` (`ProviderBids`), `app/provider/page.tsx` |
| Order state machine, who may transition | `lib/orders/stateMachine.ts` |
| Payment callback verification | `app/api/payments/callback/route.ts` |
| Chat gating (paid or later, parties only) | `lib/actions/chat.ts`, `app/api/orders/[id]/messages/stream/route.ts` |
| Reviews (completed orders, once) | `lib/actions/reviews.ts` |
| Photo access control | `app/api/uploads/[name]/route.ts` |

Append-only tables: `BidRevision`, `OrderEvent`, `Message`, `Review`.
