# Whoply — Master Plan & Build Workflow

> **One-line:** An all-in-one business-management PWA for Indian retail shopkeepers and
> wholesalers — inventory, GST billing (POS), Udhar (credit), suppliers/dealers, orders,
> dispatch, sales-team tracking, expenses, and AI-driven insights — built role-first so one
> app serves Shopkeeper, Wholesaler, and Sales Staff (Delivery & Accountant later).
>
> **Built as a ditto of the 1socio system:** same tech stack, same folder architecture, same
> auth model (landing → password/OTP login → role dashboard), same coding conventions — only
> the **idea, domain, and brand look** change. Design is kept *consistent* with 1socio's
> quality bar, **not copied**.

- **Status:** Planning approved-pending · Build not started
- **Location:** `D:\Github\Whoply`
- **Database:** `mongodb://localhost:27017/whoply` (local Mongo, created + seeded in Phase 1)
- **Date:** 2026-07-21

---

## 1. Vision & Positioning

Millions of kirana shops, garment/imitation-jewellery/toys/cutlery retailers, and B2B
wholesalers run on paper, calculators, and WhatsApp. They lose money to stockouts, forgotten
udhar, billing mistakes, and no real-time view of profit. **Whoply** turns a phone into the
shop's operating system.

- **Retail (Shopkeeper):** fast POS billing, smart inventory + expiry alerts, udhar with
  automatic WhatsApp reminders, supplier reorder, expense-to-profit tracking, loyalty.
- **Wholesale (Wholesaler/Distributor):** dealer-wise pricing, bulk order intake, warehouse
  + dispatch + delivery tracking, outstanding-payment follow-up, sales-rep route tracking,
  GST accounting.
- **One app, many roles:** each role sees only what it needs (see §5).

**Name:** *Whoply* = **Who**lesale + Sup**ply** / Ap**ply**. Trust + commerce + growth.

---

## 2. What We Reuse vs. What Changes

### Stays identical (the 1socio DNA)
| Layer | Technology (unchanged) |
|---|---|
| **Backend** | Node.js · **Express 5** · **TypeScript** (ESM, `@/` path alias) · **Mongoose/MongoDB** · **Zod** validation · JWT + bcrypt auth · Multer + Sharp + Cloudinary uploads · node-cron · Vitest |
| **Web / App** | **Next.js** (App Router) · **React 19** · **TypeScript** · **Tailwind CSS v4** · **HeroUI** · **TanStack Query** · **Zustand** · **Axios** · **Framer Motion** · **Lucide** · **next-intl / react-i18next** |
| **Mobile** | **Capacitor** (Android/iOS wrapper) **+ PWA** (installable, offline-first) |
| **Architecture** | Multi-service repo · role-based auth against separate collections · per-role sessions with device limits · controllers/routes/models/services/validators split · seed scripts |
| **Conventions** | Same folder layout, naming, `asyncHandler`/`AppError`/`sendSuccess` response helpers, env via Zod, per-role route groups |

### Changes (the Whoply identity)
- **Domain model:** Society/Resident/Guard → **Business / Product / Invoice / Dealer / Order** etc.
- **Brand look:** new name, logo, color palette, typography, illustration style (see §9).
- **Services kept:** a lean 4-service set (1socio has ~12; Whoply needs fewer — see §3).
- **PWA-first:** the main app is an installable PWA (1socio leans Capacitor-native); Whoply does both.

---

## 3. Services / Repository Layout

Four services (mirrors 1socio's `api / front / agent / admin` cores). Each is its own
folder with its own `package.json`, mirroring 1socio's internal structure exactly.

| Service | Purpose | 1socio analog | Port |
|---|---|---|---|
| **whoply-api** | Core backend — all business logic, auth, REST API | `1socio-api` | **7000** |
| **whoply-front** | Public marketing landing site (features, pricing, blog, PWA install) | `1socio-front` | **7100** |
| **whoply-app** | The main multi-role **PWA** — Shopkeeper / Wholesaler / Sales Staff | `1socio-agent`/`tenant` | **7200** |
| **whoply-admin** | Platform **super-admin** (tenants, subscriptions, plans, banners, blogs) | `1socio-saas-admin` | **7300** |

*Deferred (Phase 5+):* `whoply-delivery` (delivery-partner app), `whoply-rtc` (realtime order/
dispatch push). Not built in MVP.

---

## 4. Folder Structure (mirrors 1socio 1:1)

### whoply-api
```
whoply-api/
├─ src/
│  ├─ config/         env.ts · database.ts · redis.ts · index.ts
│  ├─ controllers/    shopkeeper/ · wholesaler/ · salesStaff/ · admin/ · shared/ · public/ · auth.controller.ts
│  ├─ routes/         shopkeeper/ · wholesaler/ · salesStaff/ · admin/ · public/ · auth.routes.ts
│  ├─ models/         Business.ts · User.ts · Product.ts · Invoice.ts … (see §7)
│  ├─ middleware/     auth.middleware.ts · role guards · error handler
│  ├─ services/       billing · inventory · udhar · dispatch · notification · whatsapp · fcm
│  ├─ validators/     Zod schemas per module
│  ├─ interfaces/     shared TS types & role enums
│  ├─ cron/           expiry-alerts · udhar-reminders · low-stock · daily-summary
│  ├─ seeds/          seed.ts (+ dummy data generators, §11)
│  ├─ utils/          asyncHandler · AppError · response · otp · token · phone
│  └─ server.ts
├─ scripts/seed.ts
├─ .env
└─ package.json
```

### whoply-app (main PWA)  &  whoply-admin  &  whoply-front
```
whoply-app/
├─ src/
│  ├─ app/
│  │  ├─ (auth)/        login · verify-otp · onboarding
│  │  ├─ (protected)/   dashboard · billing(pos) · products · inventory · customers ·
│  │  │                 udhar · suppliers · purchase-orders · expenses · reports ·
│  │  │                 dealers · orders · warehouse · dispatch · delivery ·
│  │  │                 sales-team · price-lists · finance · employees · settings
│  │  ├─ layout.tsx · manifest.ts (PWA) · sw / service-worker
│  ├─ components/  auth/ (OTPInput, LanguageSelector) · dashboard/ · layout/ · ui/ · providers/
│  ├─ stores/      auth.store.ts · cart/pos.store.ts · ui.store.ts  (Zustand)
│  ├─ lib/api/     axios client + typed endpoints (TanStack Query hooks)
│  ├─ i18n/locales en · hi · (gu/mr later)
│  └─ types/
├─ public/  icons/ · manifest · offline assets
└─ package.json
```
`whoply-front` mirrors `1socio-front` (marketing pages + `globals.css` theme).
`whoply-admin` mirrors `1socio-provider-admin`/`saas-admin`.

---

## 5. Roles & Permissions (role-first, like 1socio)

Each **Business** (tenant) is either `retail` or `wholesale`. Users belong to a Business and
carry a role. Auth is role-scoped (separate session per role), exactly as 1socio does it.

| Role | Account type | Sees |
|---|---|---|
| **Owner (Shopkeeper)** | retail | Full retail suite: POS, products, inventory, customers, udhar, suppliers, expenses, reports |
| **Owner (Wholesaler)** | wholesale | Full wholesale suite: dealers, bulk orders, warehouse, dispatch, delivery, sales-team, price-lists, finance |
| **Manager** | both | Everything except billing-sensitive finance/settings (configurable) |
| **Cashier** | retail | POS billing + customers + today's sales only |
| **Warehouse** | wholesale | Warehouse stock, pick/pack, dispatch |
| **Sales Staff** | wholesale | Order collection, shop visits, route, own customers, commission |
| **Platform Super-Admin** | platform | `whoply-admin` — all tenants, plans, subscriptions, content |
| *Delivery Partner* (Phase 5) | wholesale | Delivery tasks only |
| *Accountant* (Phase 5) | both | Reports + finance + GST only |

Dashboards are role-driven: **Shopkeeper Dashboard** and **Wholesaler Dashboard** (per the
spec) render from the same app based on `business.type` + `user.role`.

---

## 6. Feature Modules

### Shared (both roles)
Login · Profile · Notifications · Products · Inventory · Payments (multi-method) · Reports ·
**GST Invoice** · **Barcode Scanner** · AI Insights · Settings · Cloud backup / multi-device.

### Retail (Shopkeeper)
1. **Smart Inventory** — low-stock + **expiry alerts**, fast/slow movers, stock count
2. **POS Billing** — quick bill, **GST-ready invoices**, hold/resume cart, multi-payment
3. **Udhar (Credit)** — per-customer ledger, **auto WhatsApp reminders**, aging
4. **Suppliers** — reorder suggestions, purchase history, supplier payments due
5. **Expenses** — rent/electricity/salary/transport → **auto monthly profit**
6. **Customer Retention** — loyalty points, offers, WhatsApp marketing
7. **Reports** — today's sales, best/slow product, monthly profit, top customer

### Wholesale (Wholesaler)
1. **Dealer Management** — dealer-wise pricing, credit limits, outstanding, follow-up
2. **Bulk Orders** — intake from WhatsApp/phone/manual, no missed orders
3. **Warehouse** — accurate stock, pick/pack, location
4. **Purchase Planning** — reorder needs, fastest movers, cheapest supplier
5. **Dispatch & Delivery Tracking** — dispatched? received? payment pending? delayed?
6. **Outstanding Payments** — dues, reminders, follow-up
7. **Price Lists** — customer-tier pricing (Retailer A ₹95 / B ₹92 / C ₹90)
8. **GST & Accounting** — purchase/sales invoices, returns, credit notes
9. **Sales-Team Tracking** — visits, route, orders collected, **commission calc**

### 🔥 My additions (beyond your list)
- **Offline-first POS** — bill even with no internet; syncs when back (critical for Indian shops).
- **UPI/QR collect + auto-reconcile** — generate dynamic UPI QR per bill, match payments.
- **Batch & expiry tracking (FEFO)** — first-expiry-first-out picking for grocery/pharma/cosmetics.
- **WhatsApp order bot + catalog share** — shareable product catalog link; orders drop into inbox.
- **AI reorder + demand forecast** — "order 12 units of X before Diwali" using sales history.
- **Daily business summary** — one push/WhatsApp each night: sales, profit, dues, low stock.
- **Multi-shop / multi-godown** — one owner, several outlets, consolidated reports.
- **Returns & damage register** — track wastage/theft/expiry loss against profit.
- **Subscription plans (SaaS)** — Free / Pro / Business tiers gating features (managed in admin).
- **Role-based device limits + session control** — reused directly from 1socio.

---

## 7. Data Model (MongoDB collections)

Core (Phase 1–2):
- **Business** (tenant) — name, type `retail|wholesale`, GSTIN, address, plan, settings
- **User** — business ref, role, mobile, password(hash), otp/otpExpiry, name
- **Session** (per role) — device info, token, expiry (device-limit logic reused)
- **Category**, **Product** (SKU, HSN, GST%, unit, images), **ProductVariant**
- **Batch** — product ref, batch no, expiry, qty, cost (FEFO)
- **Inventory / StockMovement** — in/out, reason (sale/purchase/return/damage/adjust)
- **Customer** — retail buyer; loyalty points; linked **CreditLedger** (Udhar) + **Reminder**
- **Invoice** (Sale) + **InvoiceItem** — GST breakup, payment split
- **Payment** — method (cash/UPI/card/wallet), reconciliation status
- **Supplier** + **PurchaseOrder** + **PurchaseItem** + supplier payments
- **Expense** — category, amount, recurring

Wholesale (Phase 3):
- **Dealer** — retailer buying from wholesaler; credit limit; tier
- **PriceList / PriceTier** — dealer/tier-wise product pricing
- **Order** (bulk) + **OrderItem** — source (whatsapp/phone/manual)
- **Dispatch** + **Delivery** — status timeline, POD, delay flags
- **SalesRep** + **Visit** + **Route** + **Commission**

Platform / cross-cutting:
- **Subscription / Plan / PricingConfig** · **Notification** · **Banner** · **Blog** ·
  **Settings** · **Counter** (invoice numbering) · **CronLog** · **AuditLog** ·
  **AIInsight / Forecast** (Phase 4)

---

## 8. Auth & Navigation Flow (same process as 1socio, not copied UI)

```
Landing (whoply-front)
   │  "Get Started" / "Login"
   ▼
Login screen (whoply-app)
   │  enter mobile → choose:  [ Password ]  or  [ OTP ]
   ├─ Password login  → verify → issue JWT + role session
   └─ OTP login       → send OTP → OTPInput (6-box) → verify → issue JWT + role session
   ▼
Onboarding (first login only) — pick business type retail|wholesale, shop name, GSTIN
   ▼
Role Dashboard  ((protected) route group, auth guard + role guard)
   ├─ retail  → Shopkeeper Dashboard (today's sales, profit, low stock, udhar, top products, orders)
   └─ wholesale → Wholesaler Dashboard (orders, pending dispatch, outstanding, warehouse, dealers, revenue)
```
Reused 1socio mechanics: `generateOtp`/`getOtpExpiry`/`maskMobile`, per-role session models,
device-limit enforcement, `auth.middleware` + role middleware, Zustand `auth.store`.

---

## 9. Design System — "Whoply" brand (consistent, NOT copied)

Same **design system mechanics** as 1socio (Tailwind v4 tokens + HeroUI + Framer Motion +
Lucide, same spacing/radius/shadow scale and component conventions) so quality matches — but a
**distinct visual identity**.

- **Palette (proposed):**
  - Primary **Indigo** `#4338CA` (trust, enterprise)
  - Accent **Amber/Saffron** `#F59E0B` (Indian retail warmth, CTAs)
  - Success **Emerald** `#10B981` · Danger `#EF4444` · Warning `#F59E0B`
  - Neutrals: premium slate/zinc grays; soft off-white surfaces
- **Typography:** clean geometric sans (e.g. Inter/Plus Jakarta Sans); tabular numerals for money.
- **Look:** premium, dense-but-calm dashboards; card-based; big tap targets (shop-floor use);
  rounded-2xl, subtle depth, motion on transitions. Money always right-aligned, ₹ formatted.
- **Dark mode** + **light mode** (theme tokens, `next-themes`).
- **Language:** English + **Hindi** first (Gujarati/Marathi later) — i18n from day one.
- **Deliverable in Phase 1:** a `globals.css` token file + a small brand kit (logo mark,
  color tokens, sample dashboard) before feature build, so everything stays consistent.

---

## 10. PWA Specifics

- `manifest.ts` — name, icons (192/512/maskable), theme color, `display: standalone`, shortcuts
  to POS / New Order / Udhar.
- **Service worker** — app-shell cache + offline POS queue; background sync on reconnect.
- **Installable** on Android/iOS home screen; **Capacitor** build reuses the same codebase for
  Play Store / App Store when needed.
- Push via FCM (reused `fcm.service`), plus WhatsApp for customer-facing reminders.

---

## 11. Database & Dummy Data

- Local Mongo: **`mongodb://localhost:27017/whoply`** (created automatically on first connect).
- `whoply-api/scripts/seed.ts` generates realistic dummy data so the app "looks alive":
  - 1 **retail** business ("Sharma General Store") + 1 **wholesale** business ("Gupta Distributors")
  - Users per role with known creds (documented in seed output)
  - ~40 products across your categories (imitation jewellery, toys, cutlery, undergarments,
    saree, kurtis, groceries, bakery, namkeen), with HSN/GST, batches + a few near-expiry
  - Customers with udhar balances; dealers with tiered prices; sample invoices, orders,
    dispatches, expenses, payments — enough to populate every dashboard tile and report.
- Seed creds + ports get recorded to project memory after Phase 1 (like 1socio/AdMitra).

---

## 12. Build Workflow (phased, same discipline as 1socio/AdMitra)

> Each phase ends **verified** (server boots, endpoints tested, app renders in preview) before
> the next begins. I report results honestly at each gate.

| Phase | Deliverable | Verify |
|---|---|---|
| **0. Scaffold** | 4 services created, deps installed, envs wired, Mongo connects, brand tokens in place | all 4 `dev` scripts boot; `globals.css` renders sample |
| **1. Backend core + Auth + Seed** | Business/User/Session models, password+OTP auth, role middleware, `seed.ts` with dummy data | login returns JWT via OTP & password; DB seeded; `mongodb://localhost:27017/whoply` populated |
| **2. Retail (Shopkeeper) MVP** | Products, inventory, POS billing (GST), customers, udhar, suppliers, expenses, reports + Shopkeeper Dashboard | bill → stock decrements, udhar reminder queues, dashboard tiles show seeded data |
| **3. Wholesale MVP** | Dealers, price-lists, bulk orders, warehouse, dispatch/delivery, sales-team + Wholesaler Dashboard | order → dispatch → delivery timeline; dealer-wise pricing applies |
| **4. Platform + PWA + AI + polish** | whoply-admin (tenants/plans/subscriptions), PWA offline POS, daily summary cron, AI reorder, WhatsApp, i18n, premium UI pass | installable PWA; offline bill syncs; admin manages tenants |
| **5. (Optional) Delivery & RTC** | Delivery-partner app, realtime dispatch push | — |

**How to run (after Phase 0):**
```
whoply-api    → npm run dev     (:7000)
whoply-front  → npm run dev     (:7100)
whoply-app    → npm run dev     (:7200)   ← main PWA
whoply-admin  → npm run dev     (:7300)
```

---

## 13. Open Decisions (confirm before/at Phase 0)

1. **Location** — build in `D:\Github\Whoply` (alongside 1socio)? ✅ default assumed.
2. **Ports** — 7000/7100/7200/7300 OK, or match another range?
3. **Palette** — Indigo + Amber (proposed) — approve, or tell me your brand colors/logo.
4. **Scope of first build** — recommend **Phase 0 + 1 + 2 (retail)** first as a working
   demo (login → seeded shopkeeper dashboard → POS bill), then wholesale. OK?
5. **WhatsApp/UPI** — start with **stubbed** integrations (dummy sends) in MVP, wire real
   providers later? (Recommended.)

---

*This document is the single source of truth for Whoply. It intentionally mirrors the 1socio
architecture so the two projects feel like siblings, while Whoply keeps its own idea and brand.*
