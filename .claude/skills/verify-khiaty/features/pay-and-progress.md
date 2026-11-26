# Pay and move an order through stages

The customer pays an accepted order on the simulated `MockPay` page; the order then moves
`Paid → In progress → Delivered → Completed` as the tailor and customer press the stage button, and
the customer can leave a review once it is completed.

## Sub-features

- `pay-succeed` `Pay $<amount>` on the MockPay page marks the order `Paid`.
- `pay-fail` the failure button leaves the order unpaid.
- `order-advance` the stage button on `/orders/<id>` moves to the next status.
- `order-review` review form after `Completed`.

## How to get to it (user POV)

- Order page `/orders/<id>` → `Pay $<amount>` → `/pay/<paymentId>` (MockPay) → back to the order.
- Seeded order `Replace zipper on leather jacket` (Paid) and `Patch and reinforce denim knees` (Delivered).

## Driving it with drive.sh

Not scripted yet. Report as not verified. To add it: extend `bid-and-accept` in `scripts/drive.mjs`:
press `Pay $30.00`, on MockPay press the `Pay $30.00` button (`name="outcome" value="succeed"`), then
assert the order shows `Paid`, and check `select status from "Order"` in psql.

## Gotchas

- Chat unlocks at `Paid`, but live delivery needs Realtime (see chat.md).
