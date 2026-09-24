# Whoply — Colour System

Navy · burnt orange · warm earth. Grounded B2B trade palette, replacing the indigo/amber
proposal in [WHOPLY-MASTER-PLAN.md](WHOPLY-MASTER-PLAN.md) §9.

Every ratio in this document was measured, not estimated. Anything marked ✅ clears WCAG AA
(4.5:1 for normal text, 3:1 for large text and UI elements).

---

## 1. Why this palette

**It stops looking like a SaaS startup and starts looking like a trading platform.** Indigo
`#4338CA` is the default tech-product hue — every billing app in the category uses it. Navy +
burnt orange + sand reads as commodity, trade, industry. A wholesaler recognises it.

**The warm earth tones do real work for this audience.** Sand and warm gray carry Indian retail
warmth without reaching for the saffron cliché. Navy alone would be cold and corporate; the
earth tones stop it feeling like a bank.

**Restricting the accent to primary actions only is the discipline that makes it read premium.**
The old palette sprayed amber across chips, tags and buttons, so nothing stood out. One accent,
used sparingly, is why this will look more expensive.

**It also fixes real accessibility failures.** The previous palette's muted text was 2.45:1 and
its accent 3.19:1 — both well under AA. Here muted text is 4.59:1 and navy is 13.71:1. Only one
value needed adjusting (§2).

---

## 2. ⚠️ One correction: the CTA orange

`#CC5500` with white text measures **4.31:1** — just under the 4.5:1 AA threshold. Your button
label is `.92rem`/600 (≈14.7px), which is *not* large text, so the primary CTA would fail.

**Fix:** darken the accent by four points of red. Visually near-identical, comfortably compliant.

| | Old | **Use this** | Result |
|---|---|---|---|
| Accent | `#CC5500` — 4.31 ⚠️ | **`#C25000`** | **4.73** ✅ |
| Accent hover | `#A64400` | `#A64400` | 6.09 ✅ |

`#CC5500` is still fine where contrast rules don't apply as small text — 2px underlines,
borders, icon strokes, display numerals ≥24px. It's kept below as `--accent-bright`.

**Also:** burnt orange as *text* on white is 4.31:1 — never use the accent for body copy, links
or small labels. Use `--accent-strong` (`#A64400`, 6.09:1) when the accent must be text.

---

## 3. Tokens

```css
:root {
  /* ── Neutrals — 60-70% of the UI ───────────────────── */
  --bg:            #F8F9FB;   /* page background, cool off-white */
  --surface:       #FFFFFF;   /* cards, tables, panels */
  --surface-2:     #F3F4F6;   /* inset rows, secondary button hover */
  --border:        #E5E7EB;   /* borders, 1px dividers */
  --text:          #111827;   /* headings + body */
  --text-muted:    #6B7280;   /* labels, captions, meta */

  /* ── Navy — brand weight ───────────────────────────── */
  --navy:          #0F2B46;   /* header, footer, brand surfaces */
  --navy-dark:     #0A1F33;   /* hover/active on navy, deep footer */
  --navy-light:    #1B3A5F;   /* badges, chips on navy sections */
  --navy-tint:     #EEF2F6;   /* subtle navy-cast background band */

  /* ── Warm earth — support ──────────────────────────── */
  --sand:          #D9C8B0;   /* logo mark on navy, quote blocks */
  --warm-gray:     #CFC7C2;   /* disabled states, warm dividers */

  /* ── Accent — primary actions ONLY ─────────────────── */
  --accent:        #C25000;   /* CTA background (white text: 4.73 ✅) */
  --accent-hover:  #A64400;   /* CTA hover/active */
  --accent-strong: #A64400;   /* accent as TEXT on light backgrounds */
  --accent-bright: #CC5500;   /* rules, icon strokes, ≥24px numerals */
  --accent-tint:   #FFF4ED;   /* accent-tinted background wash */

  /* ── Semantic — product states ─────────────────────── */
  --success:       #047857;  --success-tint: #ECFDF5;
  --danger:        #B42318;  --danger-tint:  #FEF3F2;
  --warning:       #B54708;  --warning-tint: #FFFAEB;
}
```

**Type:** `Inter, Manrope, system-ui, sans-serif`. Headings 600, body 400–500. Tabular numerals
for all money.

---

## 4. Role for every token

Undefined tokens go unused or get used inconsistently — the current `globals.css` has seven dead
colour variables. Every token above has a job:

| Token | Where it appears |
|---|---|
| `--bg` | Page background, trust strip, alternating section bands |
| `--surface` | Cards, tables, pricing tiers, FAQ panels |
| `--surface-2` | Stat tiles inside cards, secondary button hover, table zebra rows |
| `--border` | Card borders, 1px section dividers, input borders |
| `--text` / `--text-muted` | Headings + body / labels, captions, footnotes |
| `--navy` | Top nav, footer, compliance section band, pricing card headers |
| `--navy-dark` | Nav link hover, deep footer bar, active nav state |
| `--navy-light` | Badges on navy ("MOQ", "Most popular"), chips, avatar backgrounds |
| `--navy-tint` | Quiet full-width band to separate sections without a hard border |
| **`--sand`** | Logo mark on navy · pull-quote and testimonial blocks · decorative rules in the compliance section · illustration fills |
| **`--warm-gray`** | Disabled buttons and inputs · dividers inside sand/warm blocks · placeholder image fills |
| `--accent` | Primary buttons only — Start free, Choose Pro, Start free today |
| `--accent-strong` | Accent when it must be small text; highlighted-tier price |
| `--accent-bright` | 2px rule under trust-strip icons, highlighted-tier border, icon strokes |
| `--accent-tint` | Background behind the highlighted pricing tier or a single callout |
| `--success` | Delivered, paid, in-stock, "days of cover: fine" |
| `--danger` | Overdue udhar, expired stock, "days of cover: critical" |
| `--warning` | Low stock, near expiry, delayed dispatch, "days of cover: soon" |

**Accent budget: at most three burnt-orange elements per viewport.** Beyond that it stops
signalling "act here".

---

## 5. Component recipes

### Header / nav
Background `--navy` · logo mark `--sand` or white · links `#E5E7EB` → hover `#FFFFFF` ·
active link underlined 2px `--accent-bright` · `Login` plain white text ·
`Start free` button `--accent` · height 56–64px · 1px bottom border `--navy-dark`.

### Buttons
| | Background | Text | Border | Hover |
|---|---|---|---|---|
| **Primary** | `--accent` | `#FFFFFF` | none | `--accent-hover` |
| **Secondary** | `--surface` | `--navy` | 1px `--navy` | bg `--surface-2` |
| **Ghost** | transparent | `--text-muted` | 1px `--border` | bg `--surface-2`, text `--text` |
| **On navy** | `#FFFFFF` | `--navy` | none | bg `--sand` |
| **Disabled** | `--warm-gray` | `#FFFFFF` | none | — |

Focus ring on every interactive element: `0 0 0 3px` at 40% of `--accent`, `outline-offset: 2px`.
Never rely on the browser default.

### Cards
Background `--surface` · 1px `--border` · radius 16px · shadow
`0 1px 2px rgba(15,43,70,.06)`, hover `0 6px 20px -6px rgba(15,43,70,.14)`.
Title `--text` · body `--text-muted` · any figure `--navy` bold, tabular.

### Pricing tiers
Header band `--navy`, text white · body `--surface` · features `--text-muted` ·
check icons `--success` · price `--navy` · CTA `--accent`.
**Highlighted tier:** 2px `--accent-bright` border, `--accent-tint` header band instead of navy,
"Most popular" chip `--accent` with white text, price in `--accent-strong`.
Make all three tiers equal height with the CTA pinned to the bottom.

### Trust strip
Background `--bg` · icons `--navy` · labels `--text-muted` ·
2px `--accent-bright` rule under each icon.

### Badges & chips
| State | Background | Text |
|---|---|---|
| Neutral / count | `--surface-2` | `--text-muted` |
| On navy sections | `--navy-light` | `#FFFFFF` |
| Paid / delivered / in stock | `--success-tint` | `--success` |
| Low stock / near expiry / delayed | `--warning-tint` | `--warning` |
| Overdue / expired / critical | `--danger-tint` | `--danger` |
| Promotional | `--accent-tint` | `--accent-strong` |

### Reorder urgency (§11 of the content deck)
`critical` → `--danger` · `soon` → `--warning` · `ok` → `--success`.

### Footer
Background `--navy-dark` · headings `#FFFFFF` · links `#E5E7EB` → hover `#FFFFFF` ·
logo mark `--sand` · bottom bar `--text-muted` on `--navy-dark`.

---

## 6. Measured contrast

| Pair | Ratio | |
|---|---|---|
| `--text` on `--bg` | 16.84 | ✅ |
| `--navy` on `--bg` | 13.71 | ✅ |
| `--navy` on `--surface` | 14.44 | ✅ |
| `--text-muted` on `--bg` | 4.59 | ✅ |
| `--text-muted` on `--surface` | 4.83 | ✅ |
| White on `--navy` | 14.44 | ✅ |
| `#E5E7EB` nav links on `--navy` | 11.66 | ✅ |
| White on `--navy-light` (badge) | 11.56 | ✅ |
| **White on `--accent` `#C25000`** | **4.73** | ✅ |
| White on `--accent-hover` | 6.09 | ✅ |
| `--navy` on `--sand` | 8.83 | ✅ |
| `--sand` on `--navy` | 8.83 | ✅ |
| `--text` on `--sand` | 10.85 | ✅ |
| `--navy` on `--warm-gray` | 8.66 | ✅ |
| `--success` on white / on tint | 5.48 / 5.21 | ✅ |
| `--danger` on white / on tint | 6.57 / 6.05 | ✅ |
| `--warning` on white / on tint | 5.43 / 5.20 | ✅ |
| ~~White on `#CC5500`~~ | ~~4.31~~ | ❌ don't use for buttons |
| ~~`#CC5500` as text on white~~ | ~~4.31~~ | ❌ use `--accent-strong` |
| `--accent-bright` on `--navy` | 3.35 | ⚠️ rules/icons only, never text |

---

## 7. Tailwind v4 registration

Register tokens in `@theme`, not bare `:root`. The current landing page has **157 inline-styled
elements** precisely because they weren't registered — inline styles can't express `hover:`,
`focus:`, `md:` or dark variants, which is what caused the divider and header bugs in the UI audit.

```css
@theme {
  --color-bg:            #F8F9FB;
  --color-surface:       #FFFFFF;
  --color-surface-2:     #F3F4F6;
  --color-border:        #E5E7EB;
  --color-text:          #111827;
  --color-text-muted:    #6B7280;

  --color-navy:          #0F2B46;
  --color-navy-dark:     #0A1F33;
  --color-navy-light:    #1B3A5F;
  --color-navy-tint:     #EEF2F6;

  --color-sand:          #D9C8B0;
  --color-warm-gray:     #CFC7C2;

  --color-accent:        #C25000;
  --color-accent-hover:  #A64400;
  --color-accent-strong: #A64400;
  --color-accent-bright: #CC5500;
  --color-accent-tint:   #FFF4ED;

  --color-success:       #047857;  --color-success-tint: #ECFDF5;
  --color-danger:        #B42318;  --color-danger-tint:  #FEF3F2;
  --color-warning:       #B54708;  --color-warning-tint: #FFFAEB;

  --radius-card: 16px;
  --radius-btn:  12px;
}
```

Then `bg-navy`, `text-text-muted`, `border-border`, `hover:bg-accent-hover`,
`focus-visible:ring-accent` all work as real utilities.

---

## 8. Before you roll this out

**1. The app must move too — this is the important one.**
`whoply-app/src/app/manifest.ts` sets `theme_color: '#4338CA'` and the whole PWA is indigo. If
the landing goes navy and the app stays indigo, a visitor clicks *Start free* and arrives
somewhere that looks like a different company — at the exact moment trust matters most. Either
roll navy through `whoply-app` and `whoply-admin` too, or don't ship it. Update `manifest.ts`
`theme_color` to `#0F2B46` in the same pass.

**2. Update the master plan.** [WHOPLY-MASTER-PLAN.md](WHOPLY-MASTER-PLAN.md) §9 still records
Indigo `#4338CA` + Amber `#F59E0B` as the approved palette. That document calls itself the single
source of truth; leaving it stale will cause drift.

**3. Dark mode is unresolved.** The plan promises light + dark. Navy is awkward to dark-mode —
a navy background plus a navy brand colour leaves no separation. You'd need the brand to shift to
`--sand` or a lighter navy on dark surfaces. Decide before building, or scope dark mode out
explicitly. The current `.dark` block in `globals.css` is dead code either way — nothing applies
the class.

**4. Keep the mobile header slim.** A solid navy bar is heavier than the current translucent one,
and your users are on phones. 56px on mobile, 64px on desktop.

**5. Delete on migration.** All `--brand-*` and `--accent-4/5/600` tokens, plus the seven unused
variables (`--accent-400`, `--brand-50`, `--brand-200`, `--brand-500`, `--danger-500`,
`--success-500`, `--warning-500`) and the dead `.wp-input` / `.wp-scroll` / `.wp-fade-up` classes.
