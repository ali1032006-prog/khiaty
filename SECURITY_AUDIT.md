# Khiaty Security Audit

**Date:** 2026-11-11
**Method:** `owasp-security` skill (agamm/claude-code-owasp @ 1ae29cb), OWASP Top 10:2025, ASVS 5.0.
**Scope:** The full Next.js app (`app/`, `lib/`, `middleware.ts`), the Supabase SQL in `supabase/migrations/`,
the seed script, dependencies (`npm audit`), and git history (checked for leaked secrets: none found).
**Commit audited:** `e1d1e65`

No LLM or agent features exist in this app, so the LLM and Agentic lists do not apply.

## Trust boundaries (step 1 of the workflow)

| Entry point | Who reaches it | Where authorization happens |
|---|---|---|
| Server Actions in `lib/actions/*` (login, register, requests, bids, payments, chat, orders, reviews) | Any browser; most require a signed-in user | Each action calls `requireUser` / `requireRole` from `lib/auth.ts` and then checks ownership against the database |
| Pages under `app/` | Any browser | Each page calls `requireUser` / `requireRole` and checks ownership |
| `POST /api/payments/callback` | **Anyone, no session** | Per-payment secret stored on the `Payment` row |
| Supabase REST and Realtime, reached directly from the browser with the public anon key | Anyone | Row Level Security (every table enabled; one SELECT policy on `Message`) |
| Supabase Auth, reached directly from the browser | Anyone | Supabase; the `on_auth_user_created` trigger creates the profile row |
| Supabase Storage bucket `reference-photos` | Only the server (service role) | Private bucket; the app mints 5-minute signed URLs after its own check |
| `middleware.ts` | Every request | Refreshes tokens only; it does not enforce auth (pages and actions do) |

## Summary

| # | Severity | Finding | Location |
|---|---|---|---|
| 1 | Medium | Server builds its own URL from the `Host` header and POSTs the payment secret to it (SSRF, secret exfiltration) | `lib/actions/payments.ts:26` |
| 2 | Medium | Login brute-force protection depends on Supabase's per-IP limits, but all logins come from the server's IP | `lib/actions/auth.ts:21` |
| 3 | Low | Registration reveals whether an email is already registered and echoes raw provider errors | `lib/actions/auth.ts:54` |
| 4 | Low | A failed payment can never be retried; the order is stuck forever | `app/api/payments/callback/route.ts:37`, `app/pay/[paymentId]/page.tsx:17` |
| 5 | Low | Payment secret stored in plaintext and compared with `!==` | `app/api/payments/callback/route.ts:25` |
| 6 | Low | Upload type trusted from the browser's declared MIME type | `lib/storage.ts:19` |
| 7 | Low | No security headers; framework advertised via `X-Powered-By` | `next.config.ts` |
| 8 | Low | Auth cookies readable by page JavaScript (`httpOnly: false`) | `lib/supabase/server.ts`, `middleware.ts` (library default) |
| 9 | Low | Sign-up validation can be bypassed by calling Supabase Auth directly | `supabase/migrations/0002_auth_rls_realtime.sql:13` |
| 10 | Low | No security event logging | project-wide |
| 11 | Info | Transitive PostCSS advisories through `next` | `package.json` |
| 12 | Info | Operational footguns: seed deletes every auth user; `placeBid` swallows all DB errors; admin client has no server-only guard | `prisma/seed.ts:48`, `lib/actions/bids.ts:50`, `lib/supabase/admin.ts` |

What was checked and found sound: ownership checks on every bid, order, payment, chat and review action;
blind bidding (provider queries fetch only a count plus their own bid); the order state machine as the single
writer of `Order.status`; atomic bid acceptance guarded by unique constraints; RLS deny-by-default with the
`Message` policy backed by a `SECURITY DEFINER` helper; the trigger function not executable via REST;
private storage with signed URLs; Prisma parameterization (no raw SQL); React output encoding (no
`dangerouslySetInnerHTML`); Next.js Server Action origin checks against CSRF; no secrets in git history;
`.env` ignored and `.env.example` free of secrets.

---

## Findings

### 1. [Medium] Payment callback origin built from request headers (CWE-918 SSRF, CWE-441, OWASP A01:2025 Broken Access Control)

```
Location:   lib/actions/payments.ts:26
Path:       HTTP Host / X-Forwarded-Proto headers -> origin string -> fetch(`${origin}/api/payments/callback`)
            with body { paymentId, secret: payment.callbackSecret, ... }
Impact:     Any signed-in customer with a pending payment can make the server send an HTTP POST, carrying
            that payment's secret, to a host of their choosing. Two consequences: (a) the server performs
            requests to arbitrary hosts, including internal ones such as cloud metadata or private services
            (fixed path and method limit what can be done, but a POST with JSON still lands); (b) the
            payment secret leaves the system, so a real gateway integration built on this pattern would let
            the attacker confirm payments without paying. In this simulation the customer can already
            "pay" for free, so the practical impact today is the SSRF.
Confidence: Confirmed. `curl -H "Host: attacker.example:9999" http://localhost:3000/login` returns 200, so
            the app accepts any Host. Behind a reverse proxy that rewrites Host the attack needs the proxy
            to forward the header; verify your deployment.
```

**Why it is a risk, simply:** The server asks the browser "what is my own address?" and believes the
answer. A browser (or curl) can say anything. Never derive your own origin from request headers.

**Fix:** Do not make an HTTP round-trip to yourself at all. Call the confirmation logic directly as a
function, or if you want to keep the "webhook" shape, use a configured absolute URL:

```ts
// lib/actions/payments.ts
const origin = process.env.APP_URL;            // e.g. http://localhost:3000, set in .env
if (!origin) throw new Error("APP_URL is not set");
const res = await fetch(`${origin}/api/payments/callback`, { ... });
```

Better still, extract the body of the callback route into `lib/payments/confirm.ts` and call it from both
the route and the simulated gateway, so no network hop and no secret ever leave the process.

### 2. [Medium] Credential brute force limited only by Supabase's per-IP limits, shared by all users (CWE-307, OWASP A07:2025 Authentication Failures, ASVS 6.3.1)

```
Location:   lib/actions/auth.ts:21
Path:       POST login form (unlimited) -> server action -> supabase.auth.signInWithPassword from the server
Impact:     The app has no rate limit, lockout or CAPTCHA of its own. Supabase Auth rate-limits sign-in
            attempts per source IP, but every attempt arrives from the app server's IP, so the limit is
            shared by all users: an attacker gets the whole quota for guessing, and once they exhaust it
            every legitimate user is locked out of sign-in for the window (denial of service).
Confidence: Needs verification. Check Authentication -> Rate Limits in the Supabase dashboard for the
            current sign-in quota; the sharing-by-IP problem is confirmed by the code path regardless.
```

**Fix:** Add per-account and per-client throttling in the action (for example a small `LoginAttempt`
table or an in-memory token bucket keyed by email and by `x-forwarded-for`), return the same generic
error, and log the event. Forward the real client IP to Supabase if your deployment supports it.

### 3. [Low] Account enumeration and raw provider error on registration (CWE-204, OWASP A07:2025)

```
Location:   lib/actions/auth.ts:54
Path:       register form -> supabase.auth.signUp -> error.message returned verbatim to the browser
Impact:     With email confirmation off, Supabase answers "User already registered", so anyone can test
            whether an email has an account. Other provider messages (password policy text, internal
            errors) are also shown as-is.
Confidence: Confirmed by code; message text depends on the project's confirmation setting.
```

**Fix:** Map provider errors to your own generic text, for example "If that email is new, your account was
created. Otherwise, log in." Log the real message server-side.

### 4. [Low] A failed payment permanently blocks the order (CWE-754, OWASP A10:2025 Mishandling of Exceptional Conditions)

```
Location:   app/api/payments/callback/route.ts:37 and app/pay/[paymentId]/page.tsx:17
Path:       callback with status FAILED -> Payment.status = FAILED -> pay page redirects away because
            status != PENDING, callback rejects because status != PENDING
Impact:     After one failed attempt the customer can never pay; the order stays at ACCEPTED forever.
            Only the customer (or the gateway) can trigger it, so this is a reliability bug, not a
            privilege problem.
Confidence: Confirmed.
```

**Fix:** Model attempts separately (one `PaymentAttempt` per try) or reset a FAILED payment to PENDING
with a fresh secret when the customer returns to the pay page.

### 5. [Low] Payment secret stored in plaintext and compared with `!==` (CWE-208, CWE-312, OWASP A04:2025 Cryptographic Failures)

```
Location:   app/api/payments/callback/route.ts:25; Payment.callbackSecret in prisma/schema.prisma
Path:       attacker-supplied body.secret -> string comparison against the stored secret
Impact:     `!==` short-circuits on the first differing byte, which in theory leaks timing. With a 256-bit
            random secret over a network this is not practically exploitable, so this is defense in depth.
            Storing the secret in plaintext means a database read (backup, SQL injection elsewhere, a leaked
            service key) is enough to forge confirmations.
Confidence: Confirmed pattern; no practical exploit path.
```

**Fix:** Store `sha256(secret)` and compare with `crypto.timingSafeEqual` on equal-length buffers.

### 6. [Low] Upload type taken from the browser's declared MIME type (CWE-434, OWASP A01:2025 File Handling)

```
Location:   lib/storage.ts:19
Path:       multipart upload -> file.type (set by the browser, attacker-controlled) -> allowlist -> bucket
Impact:     Any bytes can be stored as long as the client labels them image/png, image/jpeg or image/webp.
            The bucket also enforces the same allowlist and serves the file with that fixed content type,
            so a browser will not execute it as HTML; the residual risk is malformed images reaching
            other viewers' decoders. Size is capped at 3 MB in both places.
Confidence: Confirmed; impact limited by the bucket configuration.
```

**Fix:** Sniff the magic bytes before upload (for example with the `file-type` package) and reject
mismatches.

### 7. [Low] No security headers; framework disclosed (CWE-693, OWASP A02:2025 Security Misconfiguration)

```
Location:   next.config.ts
Path:       every response
Impact:     No Content-Security-Policy, Strict-Transport-Security, X-Content-Type-Options,
            Referrer-Policy or frame-ancestors. None of these is itself an exploit, but combined with
            finding 8 a single XSS bug anywhere would give an attacker the session. `X-Powered-By: Next.js`
            is sent.
Confidence: Confirmed with curl.
```

**Fix:** In `next.config.ts` set `poweredByHeader: false` and add a `headers()` entry with the values in the
skill's reference table. Start CSP in report-only mode.

### 8. [Low] Auth cookies readable by page JavaScript (CWE-1004, OWASP A07:2025)

```
Location:   lib/supabase/server.ts, middleware.ts (uses @supabase/ssr defaults: httpOnly: false)
Path:       any script running in the page -> document.cookie -> access and refresh tokens
Impact:     If an XSS bug were ever introduced, the tokens could be stolen rather than merely used in place.
            This is the library's default because the browser client (used here for Realtime chat) reads
            the session from cookies. No XSS sink exists in the app today.
Confidence: Confirmed library default; defense-in-depth.
```

**Fix:** Accept the trade-off consciously and compensate with a strict CSP (finding 7). Alternatively, keep
the browser signed out of Supabase entirely and have the server mint a short-lived Realtime token.

### 9. [Low] Sign-up validation can be bypassed by calling Supabase Auth directly (CWE-20, OWASP A05:2025 Injection / A07)

```
Location:   supabase/migrations/0002_auth_rls_realtime.sql:13 (trigger), Supabase project auth settings
Path:       browser with the public anon key -> supabase.auth.signUp({ password, options.data })
            -> trigger inserts name/role into "User"
Impact:     The Zod rules in lib/actions/auth.ts (name <= 80 chars, password >= 8) only apply to the form.
            A direct call can register with a 6-character password (Supabase default minimum) or a
            multi-megabyte name. Role is limited to the enum by the cast, and the app never trusts
            user_metadata after sign-up, so there is no privilege escalation.
Confidence: Confirmed by reading the trigger and the client capabilities.
```

**Fix:** Set the minimum password length (and the breached-password check if available) in Authentication
-> Policies; in the trigger use `left(..., 80)` for the name. Keep reading role from the `User` table only.

### 10. [Low] No security event logging (OWASP A09:2025, ASVS 16.3.x)

```
Location:   project-wide (e.g. lib/actions/bids.ts:100, app/api/payments/callback/route.ts:26)
Impact:     Failed authorization (another user's bid, wrong payment secret, locked chat) returns silently.
            Nobody would notice an attacker probing ids. Supabase logs sign-in failures on its side only.
Confidence: Confirmed.
```

**Fix:** Log a structured line (who, what, which id, outcome) on every denied action and every callback
rejection; keep user-supplied text out of the log line.

### 11. [Info] Transitive PostCSS advisories through `next` (OWASP A03:2025 Software Supply Chain)

`npm audit --omit=dev` reports four high and one moderate advisory in the copy of PostCSS bundled inside
`next@15.5.29`. They concern build-time processing of CSS and source maps you author, not attacker input,
so this is not exploitable here. The fix npm offers is a major upgrade to Next 16. Track it; upgrade when
convenient. The lockfile is committed and `next`, `react` and `react-dom` are pinned exactly.

### 12. [Info] Operational footguns (not vulnerabilities)

- `prisma/seed.ts:48` deletes **every** auth user in the project, not only demo accounts. Fine for a
  dedicated demo project; dangerous if the project is ever shared. Filter by the `@demo.test` domain.
- `lib/actions/bids.ts:50` catches every database error and reports "You already have a bid". An outage
  would be mis-reported. Catch only Prisma error `P2002`.
- `lib/supabase/admin.ts` should start with `import "server-only"` so an accidental client import fails
  at build time instead of silently producing an unusable client.
- Role is read from the `User` table, never from `user_metadata`. Keep it that way: users can edit their
  own metadata through the public Auth API.

---

## Recommended first fix

**Finding 1, the Host-header SSRF in `lib/actions/payments.ts`.**

Plainly: the server asks the incoming request "what is my address?" and then sends the payment secret
there. A request can lie about that. It is the only finding where an ordinary signed-in user can make the
server do something outside its own boundary, it is confirmed with a one-line curl, and the fix is small
and teaches a rule that applies everywhere: configuration tells you your own URL, requests never do. The
cleanest fix also removes the self-call entirely, which shrinks the attack surface rather than patching it.

Second choice if you prefer an auth topic: finding 3 (registration enumeration), a ten-line change.
