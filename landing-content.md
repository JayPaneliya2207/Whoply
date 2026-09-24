# Whoply — Landing Page Content

Copy deck for the `whoply-front` (:7100) redesign. Every section below is final-draft copy —
build straight from it. Feature claims are verified against shipped code in `whoply-api` and
`whoply-app`; see §22 for the claims policy before adding anything new.

**Section order:** Nav → Hero → Trust bar → Problem → Compliance → Role sections → Capability
grid → Reorder spotlight → Staff control → Automation → Screenshots → How it works → Install →
Pricing → FAQ → Final CTA → Footer.

---

## 1. Positioning & voice

**One-liner**
> Whoply turns your phone into your shop's operating system.

**Positioning statement**
> For Indian shopkeepers and wholesalers who still run on paper, calculators and WhatsApp,
> Whoply is one app for GST billing, stock, udhar and orders — so nothing is forgotten and
> nothing is guessed.

**Name meaning** (use in footer or About) — *Who*lesale + Sup*ply*.

**Voice**
- Outcomes, not features. "Never throw away expired stock" ⟶ not "batch tracking (FEFO)".
- Their words: *udhar, bahi-khata, godown, dealer, party, day-close, kirana*.
- Short sentences. A shop owner reads this on a phone, standing at a counter.
- Name the fear: forgotten udhar, expired stock, a cashier who sees your margin, a rep who
  didn't visit. Each maps to something Whoply actually does.
- Rupees always as `₹1,23,456` — Indian grouping, tabular numerals.
- Never apologise for being phone-only. "No computer needed" is the feature.

**Do not say:** "revolutionary", "seamless", "empower", "one-stop solution", "AI-powered".

---

## 2. Meta / SEO / social

**Title (≤60 ch)**
`Whoply — GST Billing, Stock & Udhar App for Shops & Wholesalers`

**Description (≤155 ch)**
`One app for GST billing, inventory, udhar and orders. E-invoice, e-way bill and Tally export built in. Works in Hindi. Start free.`

**OG / Twitter title**
`Run your whole business from one app — Whoply`

**OG / Twitter description**
`GST billing, stock, udhar, dealers and dispatch for Indian shopkeepers and wholesalers. E-invoice and e-way bill ready. Free to start.`

**OG image text:** `Billing · Stock · Udhar · Dispatch` over the app dashboard, Whoply mark top-left.

**Canonical:** `https://whoply.in/` · **Locale:** `en_IN` · **Theme colour:** `#4338CA`

---

## 3. Nav & global microcopy

**Nav links:** Features · For Shopkeepers · For Wholesalers · Pricing · FAQ
**Nav actions:** `Login` (text) · `Start free` (primary button)
**Language switcher:** `EN | हिं` — top-right, next to Login. Visible on first paint.

**Buttons used across the page**
| Context | Label |
|---|---|
| Primary CTA | `Start free` |
| Hero primary | `Start free — no card needed` |
| Hero secondary | `See a live demo` |
| Section CTA | `See how it works` |
| Pricing free | `Start free` |
| Pricing paid | `Choose Pro` / `Choose Business` |
| Final CTA | `Start free today` |

---

## 4. Hero

Role toggle sits **above** the H1 and swaps headline, sub, trust row and screenshot.
Default to Shopkeeper. Persist the choice; carry it into the signup link.

`[ 🏪 I run a shop ]   [ 🏭 I'm a wholesaler ]`

### Shopkeeper variant

**Eyebrow:** Built for Bharat's shops
**H1:** Your whole shop, in your pocket.
**Sub:** GST billing, stock and udhar in one app. Bill in seconds, know tonight's profit, and
stop losing money to credit you forgot to collect.
**CTAs:** `Start free — no card needed` · `See a live demo`
**Trust row:** GST & e-invoice ready · पूरा ऐप हिंदी में · Installs like an app

### Wholesaler variant

**Eyebrow:** Built for Bharat's distributors
**H1:** Every order, every dispatch, every rupee outstanding.
**Sub:** Dealer-wise pricing, bulk orders, e-way bills and delivery tracking. Know what shipped,
what arrived, and who still owes you.
**CTAs:** `Start free — no card needed` · `See a live demo`
**Trust row:** E-way bill & e-invoice · Exports to Tally · पूरा ऐप हिंदी में

**Hero visual:** real screenshot of the seeded dashboard (Sharma General Store / Gupta
Distributors), not a mock. Overlay one live-looking tile: today's sales, udhar due.

---

## 5. Trust bar

Five items, single row, icon + label. Capability — not traction claims.

`GST & E-Invoice ready` · `E-Way Bill built in` · `Exports to Tally` · `English + हिंदी` ·
`Any phone — no computer needed`

---

## 6. Problem section

**H2:** Paper forgets. Whoply doesn't.

| | |
|---|---|
| **The udhar you forgot** | A name in a diary, six months old. Whoply keeps every customer's ledger with aging, and hands you the list to chase each morning. |
| **The stock that expired** | Cartons at the back, past date, straight to loss. Whoply tracks batches and warns you before expiry. |
| **The bill that was wrong** | Wrong GST rate, wrong total, an argument at the counter. Whoply calculates it and prints it right, every time. |
| **The profit you're guessing** | You know today's sales. You don't know today's profit. Whoply does — before you shut the shutter. |

---

## 7. Compliance section

**H2:** Built for Indian GST — not bolted on
**Sub:** The compliance work that costs you evenings, handled inside the same screen you bill from.

| Feature | Copy |
|---|---|
| **E-Invoice (IRN)** | Generate an IRN for any bill or bulk order, straight from the invoice screen. |
| **E-Way Bill** | Raise it the moment goods leave your godown — no separate portal, no re-typing. |
| **GSTR-ready reports** | Sales, purchase and tax breakup laid out the way your return needs it. |
| **Tally export** | Your CA keeps Tally. You keep your phone. One export keeps both of you happy. |

**Pull quote for the section:** *"Your CA gets his file. You never open a laptop."*

---

## 8. For shopkeepers

**H2:** Retail, made effortless
**Sub:** Everything between the customer walking in and you counting the cash at night.

- **Bill in seconds, GST included** — cash, UPI, card, or split across all three on one bill.
- **Never throw away expired stock** — batch-wise expiry tracking, with alerts before the date.
- **Every rupee of udhar, with aging** — per-customer ledger, oldest dues first, reminders
  ready at 10 AM daily.
- **Order before you run out** — reorder quantities worked out from how fast each item really sells.
- **Know your profit tonight** — day-close in one tap, not at month-end.
- **Quote today, bill tomorrow** — turn a quotation into an invoice with one tap, no re-typing.
- **Returns handled properly** — credit notes, damage and wastage recorded against profit.
- **Suppliers and purchases** — POs, goods receipt, and what you still owe each supplier.

**Section CTA:** `Start free — set up in 30 seconds`

---

## 9. For wholesalers

**H2:** Distribution, under control
**Sub:** From the order landing on WhatsApp to the money reaching your account.

- **Dealer-wise price tiers** — Retailer A ₹95, B ₹92, C ₹90. Applied automatically, every time.
- **Bulk orders, none missed** — take them from WhatsApp, phone or the counter into one list.
- **Dispatch to delivery, tracked** — shipped? received? delayed? paid? One timeline, one screen.
- **E-way bill and e-invoice** — raised from the order screen as goods leave.
- **Outstanding by dealer** — with credit limits enforced before the next order goes out.
- **Collect on the route** — your rep records payment against the dealer on the spot.
- **Know where your team went** — shop visits logged, orders collected, commission calculated.
- **Warehouse that matches reality** — stock, pick, pack, and what's actually on the shelf.

**Section CTA:** `Start free — set up in 30 seconds`

---

## 10. Capability grid (shared)

**H2:** One app instead of a dozen registers
Six cards, both roles.

| Title | Copy |
|---|---|
| **GST Billing (POS)** | Fast, correct, GST-ready invoices. Hold a cart, resume it, split the payment. |
| **Smart Inventory** | Low stock, expiry, fast and slow movers — you find out before it costs you. |
| **Udhar & Credit** | Every customer's ledger with aging, and a daily list of who to chase. |
| **Orders & Dispatch** | Bulk orders, warehouse, dispatch and delivery in one timeline. |
| **Reports that decide things** | Today's sales, real profit, best and worst products, top customers. |
| **Staff who see only their work** | Owner, manager, cashier, warehouse, sales staff — separate logins, separate views. |

---

## 11. Reorder spotlight

**H2:** Order before you run out
**Body:** Whoply watches how fast each item actually sells, then tells you what to reorder, how
much, and how many days you have left. No black box — you can see the maths.

**Visual:** three-row list from the demo data.
`Days of cover: 3 — order 24` (red) · `Days of cover: 9 — order 12` (amber) · `Days of cover: 31 — fine` (green)

**Footnote:** Based on your own sales history over the last 30 days. Nothing is guessed.

---

## 12. Staff control

**H2:** Your cashier bills. Your cashier never sees your profit.
**Body:** Every person gets their own login and sees only their own work. Cashiers get billing
and today's sales. Warehouse gets stock and dispatch. Sales staff get their own dealers and
route. Your margins, expenses and reports stay yours.

**Sub-point:** One login can't be shared across five phones — device limits are enforced per role.

---

## 13. Automation

**H2:** Three things Whoply does while you sleep

| When | What |
|---|---|
| **Every night, 9 PM** | Your day's summary — sales, profit, dues, low stock — waiting on your phone. |
| **Every morning, 10 AM** | Today's udhar list: who owes what, oldest first, ready to send. |
| **Every Monday, 9 AM** | What you owe your suppliers this week, before they call to ask. |

---

## 14. Screenshots section

**H2:** See it working
Four real captures from the demo business. Caption the outcome, not the screen.

| Screen | Caption |
|---|---|
| POS billing | A GST bill, start to finish, in under ten seconds. |
| Udhar ledger | Every rupee outstanding, oldest first. |
| Dispatch timeline | Shipped, received, paid — or exactly where it's stuck. |
| Day-close report | Tonight's real profit, before you shut the shop. |

---

## 15. How it works

**H2:** Running by this evening

1. **Sign up with your mobile** — an OTP, thirty seconds, no paperwork, no card.
2. **Add your products** — type them in or import the list you already have.
3. **Start billing** — proper GST invoices from your very first sale.

---

## 16. Install / PWA

**H2:** No Play Store. No computer. No training.
**Body:** Whoply installs straight from your browser onto your home screen and opens like any
other app. It works on the phone you already own — and on a tablet at the counter if you'd
rather have a bigger screen.

**Three points:** Installs in one tap · Works on any Android phone · Same login on every device

> ⚠️ Do **not** write "works offline" here — see §22.

---

## 17. Pricing

**H2:** Simple, honest pricing
**Sub:** Start free. Move up when your business does.
**Toggle:** `Monthly` / `Yearly` (`Plan.period` supports both)
**Anchor line above the cards:** One udhar entry you forgot to collect costs more than a year of Pro.

| | **Free** ₹0 | **Pro** ₹299/mo · *Most popular* | **Business** ₹799/mo |
|---|---|---|---|
| For | One shop, getting started | A busy retail shop | Wholesalers & multi-shop |
| | 1 shop | Everything in Free | Everything in Pro |
| | Unlimited billing | GST reports & e-invoice | Full wholesale suite |
| | Basic inventory | Barcode scanning | Dealers & price lists |
| | Udhar tracking | 3 staff logins | Dispatch & sales team |
| | | Reminder lists | Reorder suggestions |

**Under the cards:** Your data is yours. Export it any time, on any plan — including Free.

---

## 18. FAQ

**H2:** Questions shop owners ask us

| Question | Answer |
|---|---|
| **Do I need a computer?** | No. Any Android phone is enough. Whoply installs from your browser — no Play Store, no laptop. |
| **Is it really in Hindi?** | Yes — the entire app, not just the menus. Switch between English and हिंदी any time from settings. |
| **Will my CA get what he needs?** | Yes. GSTR-ready reports plus a Tally export, so he keeps working the way he already does. |
| **Can my staff see my profit?** | Only if you allow it. A cashier sees billing and today's sales — nothing about margins, expenses or reports. |
| **Can I move my existing product list in?** | Yes, import it. You don't retype your catalogue. |
| **What happens if I stop paying?** | Your data stays yours and you can export it. You're never locked out of your own records. |
| **Does it work without internet?** | You can open the app without a signal, but billing needs a connection today. Offline billing is on the way. |
| **How long does setup take?** | Most shops are billing the same evening they sign up. |

---

## 19. Final CTA

**H2:** Stop running your shop on paper.
**Sub:** Free to start. No card, no computer, no training.
**Button:** `Start free today`
**Under button:** Set up in 30 seconds · Cancel any time

---

## 20. Footer

**Tagline under logo:** Billing, stock, udhar and orders — for Bharat's shops and wholesalers.

| Product | Business | Company |
|---|---|---|
| Features | For Shopkeepers | About |
| Pricing | For Wholesalers | Contact |
| Login | GST & Compliance | Privacy Policy |
| Install the app | FAQ | Terms of Service |

**Bottom line:** © 2026 Whoply. Made in India, for Bharat's businesses.

---

## 21. Hindi strings

Match the app's existing dictionary (`whoply-app/src/i18n/translations.ts`) so terminology stays
consistent — it already uses उधार, गोदाम, डीलर, बकाया, मुनाफ़ा.

| English | हिंदी |
|---|---|
| Your whole shop, in your pocket. | अपनी पूरी दुकान, अपनी जेब में। |
| GST billing, stock and udhar in one app. | GST बिलिंग, स्टॉक और उधार — एक ही ऐप में। |
| Every order, every dispatch, every rupee outstanding. | हर ऑर्डर, हर डिस्पैच, हर बकाया रुपया। |
| Start free — no card needed | मुफ़्त शुरू करें — कार्ड की ज़रूरत नहीं |
| See a live demo | डेमो देखें |
| No computer needed | कंप्यूटर की ज़रूरत नहीं |
| The entire app in Hindi | पूरा ऐप हिंदी में |
| Know your profit tonight | आज का मुनाफ़ा, आज ही जानें |
| Never throw away expired stock | एक्सपायर स्टॉक अब बर्बाद नहीं |
| Every rupee of udhar, with aging | हर उधार का हिसाब, पुराने पहले |
| Paper forgets. Whoply doesn't. | कागज़ भूल जाता है। Whoply नहीं। |
| Stop running your shop on paper. | अब दुकान कागज़ पर नहीं। |
| Pricing | कीमत |
| Questions shop owners ask us | दुकानदारों के सवाल |

---

## 22. Claims policy

Everything in this deck is backed by shipped code. Before adding a claim, check it here.

### ✅ Safe to claim — verified in code

E-invoice (IRN) · e-way bill · GSTR reports · Tally export · GST POS billing with split payments ·
batch & expiry (FEFO) · udhar ledger with aging · quotation→invoice · purchase orders with goods
receipt · returns & credit notes · day-close report · reorder suggestions · dealer price tiers ·
bulk orders · dispatch & delivery timeline · dealer collection · sales-rep visits & commission ·
role-based access with per-role device limits · full Hindi UI · installable PWA · UPI QR per bill ·
nightly 9 PM summary, 10 AM udhar list, Monday 9 AM payables.

### ❌ Do not claim — not true today

| Claim | Why | Say instead |
|---|---|---|
| "Works offline" / "Bill without internet" | `public/sw.js` caches the app shell only. It skips `/api/` and never caches POSTs — there is no offline queue or background sync. | "Installs like an app — no Play Store." Offline billing = roadmap. |
| "Automatic WhatsApp reminders" | `messaging.service.ts` is marked `STUBBED for MVP`. `sendWhatsApp()` logs to console and returns `{ stub: true }`. Nothing is sent. | "Reminder lists ready every morning — one tap to send." The ledger, aging and cron are real. |
| "12,000+ shopkeepers · 4.2M invoices · 22 states" | Invented placeholders, hardcoded in the page **and** in `/api/public/stats`. | Use the §5 capability trust bar until real numbers exist. Fabricated traction is ASCI-actionable in India. |
| "AI-powered forecasting" | `ai.service.ts` says it plainly: *"Not an LLM — a transparent heuristic."* | "Order before you run out — with the maths shown, not hidden." Stronger anyway. |
| "Multi-shop" as a headline | Modelled but not proven end-to-end. | Keep it inside the Business plan feature list only. |

### 🔌 Wire these up
`GET /api/public/plans` (already used) · `GET /api/public/stats` and `GET /api/public/features`
both exist and are currently ignored — the page hardcodes its own copies. Drive pricing, stats
and feature cards from the API so copy is editable without a redeploy.
