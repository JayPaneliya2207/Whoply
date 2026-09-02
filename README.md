# Whoply

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
npm run seed      # seeds the `whoply` database with demo data
npm run dev       # http://localhost:7000

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

## Demo logins

OTP is always **123456** in dev; password is **whoply123**.

| Role | Mobile | Where |
|---|---|---|
| Retail owner (Sharma General Store) | `9000000001` | app (7200) |
| Retail cashier | `9000000002` | app (7200) |
| Wholesale owner (Gupta Distributors) | `9000000010` | app (7200) |
| Warehouse / Sales staff | `9000000011` / `9000000012` | app (7200) |
| Platform admin | `9000000099` | admin (7300) |

## Flow

Landing (7100) → **Login (OTP or password)** → onboarding (first time) → **role dashboard** (7200).
