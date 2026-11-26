# Sign in and roles

Users sign in with email and password and land on the home for their role: customers on
`My requests` (`/customer`), tailors on `Open requests` (`/provider`). Signed-out visitors who open a
protected page are sent to `/login`.

## Sub-features

- `auth-login-customer` customer signs in and sees `My requests`.
- `auth-login-provider` tailor signs in and sees `Open requests`.
- `auth-logout` `Log out` in the header ends the session.
- `auth-gate` a signed-out visit to `/customer` redirects to `/login`.
- `auth-register` new account from `/register` (not scripted).

## How to get to it (user POV)

- Home page `Log in` link, or the header `Log in` link, or open `/login`.
- `Register` link on the home page, header or login form, or open `/register`.

## Driving it with drive.sh

Preconditions: baseline.

- **Customer sign-in.** Run `scripts/drive.sh sign-in`. Fills `Email` with `customer1@demo.test`,
  `Password`, presses `Sign in`. Proof `01-customer-home.png` shows heading `My requests` and header
  `Amina (customer) CUSTOMER`.
- **Tailor sign-in.** Same journey, after `Log out`, signs in as `tailor1@demo.test`. Proof
  `02-tailor-home.png` shows heading `Open requests`.
- **Gate.** Same journey, signed out, opens `/customer`. Proof `03-signed-out-redirect.png` is on
  `/login`.

## Gotchas

- Wrong password shows `Incorrect email or password.` and counts toward the 5-per-15-minute limit.
- Register: name, email, password (8+), role radio `Customer` / `Tailor (provider)`. The fake auth
  confirms email instantly (untested journey); real Supabase may require a confirmation email
  depending on the project setting.
