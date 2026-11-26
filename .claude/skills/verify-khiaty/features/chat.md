# Order chat

The customer and tailor of a paid (or later) order message each other on the order page; new messages
arrive live through Supabase Realtime.

## Sub-features

- `chat-gate` before payment the page shows `Chat unlocks after the order is paid.`
- `chat-send` a party sends a message (server action writes the row).
- `chat-live` the other party sees it without reloading (Realtime).

## How to get to it (user POV)

- `/orders/<id>` → `Chat` section, on an order that is `Paid` or later.

## Driving it with drive.sh

Cannot run here. Supabase Realtime is not part of this setup, so `chat-live` cannot be proven, and the
page's live connection to `127.0.0.1:54399` fails. `chat-gate` is visible in
`bid-and-accept/05-order-created.png`. Verify chat changes against a real local Supabase
(`supabase start` with Docker), never production.

## Gotchas

- Realtime delivery is filtered by the RLS policy on `Message`; RLS is not exercised by Prisma here.
