# Bid and accept

Tailors see open requests and place a blind bid (price, timeline, note); they never see other bids.
The customer sees all bids on the request and accepts one, which creates an order in `Accepted` state.

## Sub-features

- `bid-place` tailor submits price, timeline, note.
- `bid-blind` a tailor's request page shows only their own bid (`Your bid`).
- `bid-revise` tailor revises a bid the customer declined (`Submit revision`, not scripted).
- `bid-accept` customer presses `Accept`; order page opens as `Accepted` with `Pay $<amount>`.
- `bid-decline` customer presses `Decline` (not scripted).

## How to get to it (user POV)

- Tailor: `/provider` → request link under `Open requests` → bid form.
- Customer: `/customer` → request link → `Bids (n)` → `Accept` or `Decline`.

## Driving it with drive.sh

Preconditions: baseline.

- **Post.** Run `scripts/drive.sh bid-and-accept`. First runs the `post-request` steps (proofs 01-03).
- **Bid.** Logs out, signs in as `tailor1@demo.test`, opens the new request, fills `Price (USD)` = `30`,
  `Timeline (days)` = `4`, `Note to customer`, presses `Submit bid`. Heading `Your bid` appears. Proof
  `04-tailor-bid-placed.png`.
- **Accept.** Logs out, signs in as `customer1@demo.test`, opens the request, presses `Accept`. Lands on
  `/orders/<id>` showing `Accepted`, `Amina (customer) ↔ Layla's Atelier · $30.00`, `Pay $30.00`, and
  history `Accepted by Amina (customer)`. Proof `05-order-created.png`.

## Gotchas

- `Accept` uses `.first()`: on a request with several bids, check the proof shows the bid you meant.
- Accepting marks the request `Awarded` and turns the other pending or declined bids `SUPERSEDED`.
