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

## Getting started

```bash
# 1. Make sure MongoDB is running locally (mongodb://localhost:27017)

# 2. Backend
cd whoply-api
npm install
npm run seed      # creates & seeds the `whoply` database with demo data
npm run dev       # http://localhost:7000

# 3. Frontends (each in its own terminal)
cd whoply-front && npm install && npm run dev   # http://localhost:7100
cd whoply-app   && npm install && npm run dev   # http://localhost:7200
cd whoply-admin && npm install && npm run dev   # http://localhost:7300
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
