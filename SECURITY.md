# Whoply — security and scale

What protects Whoply today, what to check before going live, and what is not
done yet. No software is "unhackable"; this file is here so the gaps are known
and not a surprise.

## What is in place

### Sign-in and sessions
- Passwords are stored hashed (bcrypt). OTP codes are random in production.
- Guessing is slowed down: 5 wrong passwords lock a login for 15 minutes; an
  address with 30 failed sign-ins in 15 minutes is refused; OTP sends are
  limited (`utils/loginGuard.ts`).
- Every request is checked against a server-side session, so signing out,
  a password reset, switching a login off or suspending a business ends access
  at once — a copied token stops working (`middleware/auth.middleware.ts`).
- Roles: owner, manager, cashier, warehouse, sales rep, accountant — each API
  route names the permission it needs (`utils/permissions.ts`). Platform admins
  have their own roles — super, support, billing, viewer
  (`utils/adminAccess.ts`). The checks are on the server; the screens only hide
  what a role can't use.
- Every business sees only its own data: every query is scoped by the signed-in
  user's business.
- The admin panel keeps an activity log of every change (who, what, when) for
  180 days. Passwords and message text are never written to it.

### Requests (`middleware/security.middleware.ts`)
- **Request limit**: at most `RATE_LIMIT_PER_MIN` (default 1500) requests a
  minute from one network address; 120 a minute for the public routes; 100 a
  minute for sign-in routes. Over the limit → `429` with `Retry-After`.
- **Small bodies**: 1 MB per request; 12 MB only for the few routes that carry
  photos. Larger → `413`.
- **No operator keys**: a request whose JSON contains MongoDB operators
  (`$ne`, `$gt`, `$where`…) or prototype keys (`__proto__`) is refused. This is
  how NoSQL injection is attempted; no route expects such keys.
- **Checked input**: money, quantities, GSTINs, mobiles, dates and text lengths
  are validated on the server. Pictures must be PNG / JPG / WebP data URLs (or
  an https link) under a size limit — no SVG, no script URLs.
- Search text is escaped before it is used in a database pattern.
- The public contact form has a hidden bot field, a 5-an-hour limit per address
  and strict validation.

### Responses and browser protections
- Errors never include stack traces outside development. Server faults (5xx)
  are written to the server log.
- The API sends security headers (helmet): no MIME sniffing, HSTS, no
  `X-Powered-By`. In production only the Whoply sites may call it (CORS).
- The three websites send `X-Frame-Options`, `X-Content-Type-Options`,
  `Referrer-Policy` and a `Permissions-Policy` (camera only in the app, for
  barcode scanning).
- HTTPS everywhere on the live server (Caddy, automatic certificates).

### Staying up
- A query that runs longer than `DB_QUERY_TIMEOUT_MS` (default 30 s) is stopped
  and the request answers "busy, try again" (`503`) instead of piling up.
- A fixed database connection pool (`DB_POOL_SIZE`, default 20).
- Lists are paged (at most 100 rows a request); the scheduled jobs work in
  bulk, under a lock, so two API copies never send reminders twice.
- A crash-level error is logged and the API restarts (Docker `restart:
  unless-stopped`); on a deploy it finishes open requests before stopping.
- `GET /api/health` answers `503` when the database is not connected; the
  Docker health check uses it.
- Daily automatic backups, kept for 7–14 days (`npm run backup` / `restore`).
- Money and stock changes are single atomic database updates, so two people
  pressing the same button at the same moment can't double-count.

### Checks that run on every push (GitHub CI)
- 22 API test groups (900+ checks), including `tests/security.mjs` (injection,
  body size, pictures, headers, request limit) and `tests/access.mjs` (admin
  roles, lock-out rules, activity log, contact form).
- Production builds of the three sites, a full Docker deploy over HTTPS, and
  `npm audit` on what the live server runs (also every Monday).

## Load test

    cd whoply-api
    npm run seed            # demo data — never on the live database
    npm run test:load       # 50 users for 20 seconds
    USERS=200 SECONDS=30 npm run test:load

Each "user" sends requests without pausing, so 50 of them stand for far more
real people. On the development PC (everything on one machine, unbuilt code):
50 users → about 100 requests a second, no failures, 95% answered within about
1 second; 200 users → no failures and no crash, but answers slow to 2–3
seconds. Run it against the live server (with a copy of the data) to know the
real numbers before a big launch.

When one server is not enough:
1. Give MongoDB its own machine (MongoDB Atlas) — the plan in `DEPLOY.md`.
2. Run two or more API containers behind Caddy. Sessions, locks and counters
   are in the database, so this works as is. The request limit is counted per
   API copy.
3. Raise `DB_POOL_SIZE` together with the database's connection limit.

## Before going live — checklist

- [ ] `JWT_SECRET` is long and random (`openssl rand -hex 48`) and only in
      `deploy/.env` on the server. Never commit `deploy/.env`.
- [ ] `TRUST_PROXY=1` is set (it is in `deploy/docker-compose.yml`). Without it
      every visitor shares one address for the limits; the API warns at start.
- [ ] The first admin is made with `npm run setup:prod` and a strong password.
      Demo logins (`whoply123`) exist only in test data — `seed` and `db:clear`
      refuse to run in production.
- [ ] MongoDB accepts connections only from the server (Atlas IP access list),
      with its own strong password.
- [ ] Backups are copied off the server regularly, and one restore was tried.
- [ ] Each person who uses the admin panel has their own login with the
      smallest role that fits (Access control page). Remove logins of people
      who leave.
- [ ] Company details and legal pages are filled in (`whoply-front/src/lib/legal.ts`).
- [ ] An uptime monitor watches `https://api.<domain>/api/health`.

## Not done yet (know the gaps)

- No second factor (OTP app) for admin logins.
- Sign-in tokens are kept in the browser's storage, so a script-injection bug
  in a page could read them. React escapes everything shown, and pictures and
  text are checked on the way in, but a strict Content-Security-Policy is not
  set yet.
- The request limit is per server and per address; it is not protection
  against a large distributed flood. Put Cloudflare (or similar) in front for
  that.
- No independent security test (penetration test) has been done. Do one before
  handling many paying customers.
- WhatsApp and SMS are not sent automatically yet (no provider account).

## Reporting a problem

If you find a security problem, write to the support contact in the admin
Settings page. Please do not post it publicly before it is fixed.
