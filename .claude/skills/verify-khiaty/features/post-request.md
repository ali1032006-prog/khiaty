# Post a request

A signed-in customer describes a tailoring job with a title, description and budget (and optionally a
reference photo). The request opens on its own page and is listed under `My requests` as `Open`.

## Sub-features

- `request-create` post title, description, budget.
- `request-list` the new request appears in `My requests` with budget and `Open`.
- `request-validate` short title or description shows the form error.
- `request-photo` reference photo upload (cannot run here: Supabase Storage).

## How to get to it (user POV)

- Customer home `/customer`, button `New request`, or open `/customer/requests/new`.

## Driving it with drive.sh

Preconditions: baseline; signed in as `customer1@demo.test` (the journey does this).

- **Open form.** Run `scripts/drive.sh post-request`. Clicks link `New request`.
- **Fill.** `Title` = `Verify: shorten a linen shirt <time>`, `Description`, `Budget (USD)` = `35`. Proof
  `01-form-filled.png`.
- **Post.** Clicks `Post request`. Lands on `/requests/<id>` with the title as heading. Proof
  `02-request-page.png`.
- **List.** Opens `/customer`; the title is a link in `My requests`, `Budget $35.00`, `Open`. Proof
  `03-my-requests-list.png`.
- **Stored.** `psql ... -c "select title, \"budgetCents\", status from \"Request\" where title like 'Verify:%'"`
  shows `3500` and `OPEN`.

## Gotchas

- Budget is entered in dollars and stored in cents.
- Only customers may post; a tailor opening `/customer/requests/new` is redirected to `/provider`.
- Attaching a photo needs Supabase Storage, which this setup does not run: expect the upload to fail.
  Verify photo changes against a real local Supabase, never production.
