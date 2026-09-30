# Whoply

[![CI](https://github.com/JayPaneliya2207/Whoply/actions/workflows/ci.yml/badge.svg)](https://github.com/JayPaneliya2207/Whoply/actions/workflows/ci.yml)

All-in-one business management for Indian **shopkeepers** and **wholesalers** — GST billing (POS),
smart inventory, udhar (credit) with reminders, dealers, bulk orders, dispatch & delivery,
sales-team tracking, expenses, and AI reorder insights.

Built as a sibling of the 1socio stack (Express 5 + TypeScript + MongoDB backend; Next.js +
Tailwind v4 + TanStack Query + Zustand + Framer Motion frontends) with its own brand and domain.

See [WHOPLY-MASTER-PLAN.md](WHOPLY-MASTER-PLAN.md) for the full plan.

## Services

| Folder | What | Port | Run |
|---|---|---|---|
| `whoply-api` | Backend REST API (Express 5, Mongoose, Zod, JWT) | 7000 | `npm run dev` |
| `whoply-front` | Marketing landing site (Next.js) | 7100 | `npm run dev` |
| `whoply-app` | Main **PWA** — shopkeeper / wholesaler / sales staff | 7200 | `npm run dev` |
| `whoply-admin` | Platform super-admin console | 7300 | `npm run dev` |

## Getting started (fresh clone / fork)

> **`.env` files are not in git** (they hold secrets). A fresh clone has none, and the
> API **will not start** without them. Step 1 is not optional.

```bash
# 1. Create the .env files (generates a JWT_SECRET for you)
node setup.mjs

# 2. Start MongoDB — pick ONE:
docker compose up -d        # easiest: no install needed
#   ...or install MongoDB Community locally and make sure it's running
#   ...or put a MongoDB Atlas URI in whoply-api/.env (MONGODB_URI=...)

# 3. Backend
cd whoply-api
npm install
npm run seed:reset   # clean database + the 3 demo logins listed below
# or: npm run seed   # full demo dataset (products, bills, dealers, orders)
npm run dev          # http://localhost:7000

# 4. Frontends (each in its own terminal)
cd whoply-front && npm install && npm run dev   # http://localhost:7100
cd whoply-app   && npm install && npm run dev   # http://localhost:7200
cd whoply-admin && npm install && npm run dev   # http://localhost:7300
```

Check the API is alive: <http://localhost:7000/api/health>

### Testing from a phone / another PC (same Wi-Fi)

`localhost` on a phone means *the phone itself*, so the app can't reach your API.
Point everything at your machine's LAN IP instead:

```bash
node setup.mjs --lan     # detects your IP and writes it into every .env
```

Then restart the dev servers and open `http://<your-ip>:7200` on the phone.
On Windows, allow Node.js through the firewall for ports **7000** and **7200**
when prompted (that prompt is the usual reason LAN access "just hangs").

### Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| `❌ Invalid environment variables: { JWT_SECRET: [...] }` then exits | No `.env`, or `JWT_SECRET` shorter than 32 chars | `node setup.mjs` |
| `MongoServerError` / `ECONNREFUSED 127.0.0.1:27017` | MongoDB isn't running | `docker compose up -d` |
| App loads but every request fails with a **CORS** error | `NODE_ENV=production` in `whoply-api/.env` — CORS switches to a domain allowlist | set `NODE_ENV=development` |
| Frontend shows "Network Error" | `NEXT_PUBLIC_API_URL` wrong, or API not on :7000 | check `whoply-app/.env.local`; restart after editing |
| Works on your PC, not from phone | Using `localhost`, or firewall | `node setup.mjs --lan` + allow the firewall prompt |
| Login says "No account found" | Database not seeded | `cd whoply-api && npm run seed` |

### Working on an existing database

After pulling changes that touch the schema, build new indexes + backfills:

```bash
cd whoply-api && npm run migrate
```

### Tests

```bash
cd whoply-api
npm run test:all        # full feature + edge/staff/admin suites (resets the DB)
npm run test:explain    # confirms hot queries are index-backed
```

GitHub runs the same suites, plus a production build of all four, on every push and pull
request ([.github/workflows/ci.yml](.github/workflows/ci.yml)). A red ❌ on a PR means
something broke — open the check to see which test failed.

## Backups

The API backs up the whole database by itself once a day: it checks at start-up and every hour,
and saves when the last backup is 23+ hours old (so a PC that's off at night still gets one).
Backups go to `backups/<database>/whoply-YYYY-MM-DD_HHmm/` (next to the API folder, not in git)
and the newest 7 are kept. Nothing extra to install — no `mongodump` needed.

```bash
cd whoply-api
npm run backup                                   # back up now
npm run restore                                  # list the backups
npm run restore -- whoply-2026-09-30_0215 --into mongodb://localhost:27017/whoply_check   # look inside safely
npm run restore -- whoply-2026-09-30_0215 --drop # put the live database back to that backup
```

- Restore never overwrites data unless you add `--drop`, and with `--drop` it first backs up
  what it is about to replace.
- **Keep a copy somewhere else.** A backup on the same disk as the database is lost with the
  disk: point `BACKUP_DIR` at another drive or a synced folder (Google Drive, OneDrive), or copy
  the `backups` folder off the machine now and then.
- Settings in `whoply-api/.env`: `BACKUP_DIR` (folder, or `off`), `BACKUP_KEEP` (how many).
- Backups hold customer names and phone numbers — keep them private.

## Going live (production build)

All four build and run in production mode (`next build` / `tsc`). On the server:

```bash
# API — needs whoply-api/.env with the production values below
cd whoply-api && npm ci && npm run build
npm run migrate:prod    # after every deploy (safe to re-run); uses the build, no dev tools needed
npm start               # node dist/server.js

# Each front-end — set its NEXT_PUBLIC_* values BEFORE building (they are baked in)
cd whoply-app && npm ci && npm run build && npm start      # same for whoply-front, whoply-admin
```

Checklist:

- **API `.env`**: `NODE_ENV=production`, the real `MONGODB_URI`, a **new** `JWT_SECRET` (never the dev one),
  and `APP_URL` / `ADMIN_URL` / `FRONT_URL` set to the real `https://` domains — they are the CORS
  allowlist, so any other site is refused.
- **Front-ends**: `NEXT_PUBLIC_API_URL=https://api.yourdomain.com/api` (landing also
  `NEXT_PUBLIC_APP_URL`). Changing them means building again.
- **HTTPS**: the app only installs and opens offline (service worker) over `https://`.
- **Behind nginx / a load balancer**: set `TRUST_PROXY=1` in the API `.env`, so sign-in limits
  count each visitor's own address (5 wrong tries lock an account for 15 minutes; 30 failed
  sign-ins from one address in 15 minutes pause that address; OTP: one per 30 s, 5 an hour).
- **Linux servers are case-sensitive**: an import must match the file name exactly
  (`priceList.controller.js`, not `pricelist…`) — Windows hides this mistake.
- **Backups**: on MongoDB Atlas, turn on Atlas's own backups too. On your own server, set
  `BACKUP_DIR` to a disk other than the database's (`npm run backup:prod` / `restore:prod`
  use the build).
- **OTP login**: production makes a real random code, but no SMS provider is connected yet, so
  nobody receives it. Use password login until one is added.

## Demo logins

OTP is always **123456** in dev; password is **whoply123**.

| Role | Mobile | Where |
|---|---|---|
| **Shopkeeper** (retail owner) | `9000000001` | app (7200) |
| **Wholesaler** (wholesale owner) | `9000000010` | app (7200) |
| **Platform admin** | `9000000099` | admin (7300) |

`npm run seed:reset` creates exactly these three on an empty database — start here.
`npm run seed` instead loads a full demo dataset (products, bills, dealers, orders)
and adds extra staff accounts you can view under **Staff** in the app.

## Flow

Landing (7100) → **Login (OTP or password)** → onboarding (first time) → **role dashboard** (7200).
