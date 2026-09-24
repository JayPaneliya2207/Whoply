/**
 * Landing-site copy, English + Hindi + Gujarati.
 *
 * Terminology deliberately matches `whoply-app/src/i18n/translations.ts`
 * (उधार, गोदाम, डीलर, बकाया, मुनाफ़ा) so the marketing site and the product
 * don't drift. Technical terms this audience already uses in English —
 * GST, e-way bill, IRN, Tally, POS, UPI — stay in English on purpose.
 */

export type Lang = 'en' | 'hi' | 'gu';

export const LANGS: Lang[] = ['en', 'hi', 'gu'];

/** Short label for the header switcher, and the full name for its title. */
export const LANG_LABEL: Record<Lang, { short: string; full: string }> = {
    en: { short: 'EN', full: 'English' },
    hi: { short: 'हिं', full: 'हिंदी' },
    gu: { short: 'ગુ', full: 'ગુજરાતી' },
};

/** BCP-47 tag used for `lang` / `hrefLang`. */
export const HREF_LANG: Record<Lang, string> = { en: 'en-IN', hi: 'hi-IN', gu: 'gu-IN' };

/** Path for a locale. English is the root; the others live at /hi and /gu. */
export const pathFor = (lang: Lang) => (lang === 'en' ? '/' : `/${lang}`);

export interface LandingCopy {
    meta: { title: string; description: string; ogTitle: string; ogDescription: string };
    nav: {
        announcement: string;
        links: { href: string; label: string }[];
        login: string;
        start: string;
        switchLabel: string;
        switchCta: string;
        openMenu: string;
        closeMenu: string;
        home: string;
        primaryNav: string;
        mobileNav: string;
    };
    hero: {
        switchLabel: string;
        retail: { tab: string; eyebrow: string; h1: string; h1Accent: string; sub: string; trust: string[] };
        wholesale: { tab: string; eyebrow: string; h1: string; h1Accent: string; sub: string; trust: string[] };
        ctaPrimary: string;
        ctaSecondary: string;
        mock: {
            today: string;
            live: string;
            retailTiles: [string, string][];
            wholesaleTiles: [string, string][];
            rows: [string, string][];
            retailAction: string;
            wholesaleAction: string;
            retailBusiness: string;
            wholesaleBusiness: string;
            /** Labels on the floating cards around the hero cutout. */
            alert: string;
            reminder: string;
            /** Looping "bill being made" story in the hero mock. Items are [name, qty, ₹amount]. */
            bill: {
                total: string;
                sent: string;
                retailItems: [string, string, number][];
                wholesaleItems: [string, string, number][];
            };
        };
    };
    marquee: { label: string; items: string[] };
    problem: {
        eyebrow: string;
        title: string;
        cards: { title: string; body: string }[];
        /** Paper register vs Whoply, row by row. */
        compare: {
            paper: string;
            paperSub: string;
            app: string;
            appSub: string;
            vs: string;
            rows: { topic: string; paper: string; paperTag: string; app: string; appTag: string }[];
            /** Live status on each Whoply row, same order as `rows`. */
            live: string[];
            liveLabel: string;
            autoSent: string;
            /** Label on the phone connector from the paper card to the Whoply card. */
            flow: string;
            /** Scribbled next to struck-out udhar lines in the register. */
            paperNote: string;
        };
    };
    compliance: {
        eyebrow: string;
        title: string;
        sub: string;
        cards: { title: string; body: string }[];
        quote: string;
        /** Labels inside the auto-filing pipeline nodes. */
        pipe: {
            irn: string;
            cleared: string;
            vehicle: string;
            taxable: string;
            exportBtn: string;
            exporting: string;
            sent: string;
        };
    };
    shopkeepers: {
        eyebrow: string;
        title: string;
        sub: string;
        bullets: string[];
        cta: string;
        stats: [string, string][];
        /** Hotspots on the counter-kit photo — only hardware the app really supports. */
        kit: { label: string; hint: string; items: { title: string; body: string }[] };
        /** The retail feature tabs: the eight bullets grouped into four. */
        groups: { title: string; body: string }[];
        /** Micro-UI inside the four counter metric cards. */
        metrics: {
            avg: string;
            batch: (n: number, exp: string) => string;
            due: (amount: string) => string;
            reminded: string;
            send: string;
            sent: string;
        };
        /** Labels inside the per-feature phone mockups. */
        mock: {
            tabsLabel: string;
            pay: [string, string, string];
            batch: string;
            expiresIn: (days: number) => string;
            days: (days: number) => string;
            quote: string;
            invoice: string;
            convert: string;
            creditNote: string;
            returned: string;
            damaged: string;
            po: string;
            received: string;
            pending: string;
            youOwe: string;
        };
    };
    wholesalers: {
        eyebrow: string;
        title: string;
        sub: string;
        bullets: string[];
        cta: string;
        timelineLabel: string;
        timeline: [string, string][];
        /** Labels inside the per-feature mockups. */
        mock: {
            tabsLabel: string;
            tier: string;
            auto: string;
            newOrders: string;
            phone: string;
            counter: string;
            generated: string;
            limit: string;
            onHold: string;
            collected: string;
            visits: string;
            orders: string;
            commission: string;
            pick: string;
            pack: string;
            onShelf: string;
        };
        /** The four-stage distribution pipeline that replaces the bullet tabs. */
        stages: { title: string; sub: string; body: string }[];
        pipe: {
            dealer: string;
            applied: (tier: string, price: string) => string;
            order: string;
            ewb: string;
            driver: string;
            out: string;
            agent: (name: string) => string;
            visited: (n: number) => string;
            collected: (amount: string) => string;
            outstanding: string;
            available: string;
            ok: string;
            hold: string;
        };
    };
    features: {
        eyebrow: string;
        title: string;
        cards: { title: string; body: string }[];
        /** Micro-UI inside the bento tiles. */
        ui: {
            remind: string;
            sent: string;
            remindAll: string;
            allSent: string;
            roles: string[];
            perms: string[];
            seeAs: string;
            chartHint: string;
            sales: string;
        };
    };
    reorder: { eyebrow: string; title: string; body: string; foot: string; rows: [string, string, string][] };
    staff: { title: string; body: string; note: string };
    automation: { title: string; items: { when: string; what: string }[] };
    /** Dashboard showcase — items map, in order, to the hotspots in DashboardShowcase. */
    tour: { eyebrow: string; title: string; sub: string; hint: string; items: { title: string; cap: string }[] };
    how: { eyebrow: string; title: string; steps: [string, string][] };
    install: { eyebrow: string; title: string; sub: string; chips: string[] };
    pricing: {
        eyebrow: string;
        title: string;
        sub: string;
        anchor: string;
        per: string;
        popular: string;
        startFree: string;
        choose: (name: string) => string;
        planFor: Record<string, string>;
        foot: string;
        monthly: string;
        yearly: string;
        save: string;
        billedYearly: (amount: string) => string;
    };
    faq: {
        eyebrow: string;
        title: string;
        qa: [string, string][];
        /** Filter tabs: all, hardware & offline, tax & staff, data & onboarding. */
        cats: [string, string, string, string];
        /** Proof badges shown inside specific open answers. */
        proof: { devices: string; export: string; offline: string };
    };
    finalCta: { eyebrow: string; title: string; sub: string; button: string; foot: string };
    contact: { whatsapp: string; whatsappMsg: string };
    footer: {
        tagline: string;
        columns: { head: string; links: [string, string][] }[];
        legal: string;
    };
}

const en: LandingCopy = {
    meta: {
        title: 'Whoply — GST Billing, Stock & Udhar App for Shops & Wholesalers',
        description:
            'One app for GST billing, inventory, udhar and orders. E-invoice, e-way bill and Tally export built in. Works in Hindi. Start free.',
        ogTitle: 'Run your whole business from one app — Whoply',
        ogDescription:
            'GST billing, stock, udhar, dealers and dispatch for Indian shopkeepers and wholesalers. E-invoice and e-way bill ready. Free to start.',
    },
    nav: {
        announcement: 'E-invoice, e-way bill and Tally export — built in, not bolted on.',
        links: [
            { href: '#compliance', label: 'GST & Compliance' },
            { href: '#shopkeepers', label: 'For Shopkeepers' },
            { href: '#wholesalers', label: 'For Wholesalers' },
            { href: '#pricing', label: 'Pricing' },
            { href: '#faq', label: 'FAQ' },
        ],
        login: 'Login',
        start: 'Start free',
        switchLabel: 'Language',
        switchCta: 'Language',
        openMenu: 'Open menu',
        closeMenu: 'Close menu',
        home: 'Whoply home',
        primaryNav: 'Primary',
        mobileNav: 'Mobile',
    },
    hero: {
        switchLabel: 'Choose your business type',
        retail: {
            tab: 'I run a shop',
            eyebrow: "Built for Bharat's shops",
            h1: 'Your whole shop,',
            h1Accent: 'in your pocket.',
            sub: 'GST billing, stock and udhar in one app. Bill in seconds, know tonight’s profit, and stop losing money to credit you forgot to collect.',
            trust: ['GST & e-invoice ready', 'हिंदी & ગુજરાતી too', 'Installs like an app'],
        },
        wholesale: {
            tab: "I'm a wholesaler",
            eyebrow: "Built for Bharat's distributors",
            h1: 'Every order, every dispatch,',
            h1Accent: 'every rupee outstanding.',
            sub: 'Dealer-wise pricing, bulk orders, e-way bills and delivery tracking. Know what shipped, what arrived, and who still owes you.',
            trust: ['E-way bill & e-invoice', 'Exports to Tally', 'हिंदी & ગુજરાતી too'],
        },
        ctaPrimary: 'Start free — no card needed',
        ctaSecondary: 'See a live demo',
        mock: {
            today: 'Today',
            live: 'Live',
            retailTiles: [
                ['Today’s Sales', '₹10,380'],
                ['Bills', '18'],
                ['Profit (est.)', '₹11,696'],
                ['Udhar due', '₹49,299'],
            ],
            wholesaleTiles: [
                ['Orders today', '34'],
                ['To dispatch', '11'],
                ['Outstanding', '₹4,86,200'],
                ['Collected', '₹1,12,400'],
            ],
            rows: [
                ['Parle-G 200g', '3 days left'],
                ['Colgate 100g', '9 days left'],
                ['Tata Salt 1kg', '31 days left'],
            ],
            retailAction: 'New GST Bill',
            wholesaleAction: 'New bulk order',
            retailBusiness: 'Sharma General Store',
            wholesaleBusiness: 'Gupta Distributors',
            alert: 'Running low',
            reminder: 'Reminder sent',
            bill: {
                total: 'Total',
                sent: 'Bill sent on WhatsApp',
                retailItems: [
                    ['Parle-G 200g', '×4', 100],
                    ['Tata Salt 1kg', '×2', 56],
                    ['Amul Butter 100g', '×1', 58],
                ],
                wholesaleItems: [
                    ['Parle-G 200g', '×20 ctn', 14400],
                    ['Tata Salt 1kg', '×10 bags', 6720],
                    ['Colgate 100g', '×6 ctn', 8640],
                ],
            },
        },
    },
    marquee: {
        label: 'What Whoply includes',
        items: [
            'GST & E-Invoice ready',
            'E-Way Bill built in',
            'Exports to Tally',
            'English + हिंदी + ગુજરાતી',
            'Any phone — no computer needed',
            'Batch & expiry tracking',
            'Dealer-wise price lists',
        ],
    },
    problem: {
        eyebrow: 'The cost of paper',
        title: 'Paper forgets. Whoply doesn’t.',
        cards: [
            {
                title: 'The udhar you forgot',
                body: 'A name in a diary, six months old. Whoply keeps every customer’s ledger with aging, and hands you the list to chase each morning.',
            },
            {
                title: 'The stock that expired',
                body: 'Cartons at the back, past date, straight to loss. Whoply tracks batches and warns you before expiry.',
            },
            {
                title: 'The bill that was wrong',
                body: 'Wrong GST rate, wrong total, an argument at the counter. Whoply calculates it and prints it right, every time.',
            },
            {
                title: 'The profit you’re guessing',
                body: 'You know today’s sales. You don’t know today’s profit. Whoply does — before you shut the shutter.',
            },
        ],
        compare: {
            paper: 'Paper register',
            paperSub: 'What most counters still run on',
            app: 'Whoply digital ledger',
            appSub: 'The same shop, on your phone',
            vs: 'vs',
            rows: [
                {
                    topic: 'Udhar',
                    paper: 'A name in a diary, six months old. Nobody reminds anyone.',
                    paperTag: 'Forgotten',
                    app: 'Every customer’s ledger with aging. Reminders go out on WhatsApp at 10 AM.',
                    appTag: 'Auto-reminded',
                },
                {
                    topic: 'Expiry',
                    paper: 'Cartons at the back, past date — straight to loss.',
                    paperTag: 'Expired',
                    app: 'Batch-wise tracking warns you before the date.',
                    appTag: 'Alert 7 days early',
                },
                {
                    topic: 'Billing',
                    paper: 'Wrong GST rate, wrong total, an argument at the counter.',
                    paperTag: 'Disputed',
                    app: 'GST calculated and printed right, every time.',
                    appTag: 'GST-correct',
                },
                {
                    topic: 'Profit',
                    paper: 'You know today’s sales. Profit is a guess till month-end.',
                    paperTag: 'Guessed',
                    app: 'Real profit before you shut the shutter.',
                    appTag: 'Live tonight',
                },
            ],
            live: ['+ ₹500 collected', 'Alert sent · 7 days left', 'Bill sent on WhatsApp', 'Profit ₹6,420 today'],
            liveLabel: 'Live',
            autoSent: 'WhatsApp auto-sent',
            flow: 'Now the same shop, on Whoply',
            paperNote: 'paid??',
        },
    },
    compliance: {
        eyebrow: 'Compliance',
        title: 'Built for Indian GST — not bolted on',
        sub: 'The compliance work that costs you evenings, handled inside the same screen you bill from.',
        cards: [
            {
                title: 'E-Invoice (IRN)',
                body: 'Generate an IRN for any bill or bulk order, straight from the invoice screen.',
            },
            {
                title: 'E-Way Bill',
                body: 'Raise it the moment goods leave your godown — no separate portal, no re-typing.',
            },
            {
                title: 'GSTR-ready reports',
                body: 'Sales, purchase and tax breakup laid out the way your return needs it.',
            },
            {
                title: 'Tally export',
                body: 'Your CA keeps Tally. You keep your phone. One export keeps both of you happy.',
            },
        ],
        quote: '“Your CA gets his file. You never open a laptop.”',
        pipe: {
            irn: 'IRN generated',
            cleared: 'Auto-cleared',
            vehicle: 'Vehicle',
            taxable: 'Taxable value',
            exportBtn: '1-click Tally export',
            exporting: 'Exporting…',
            sent: 'Sent to CA',
        },
    },
    shopkeepers: {
        eyebrow: 'For shopkeepers',
        title: 'Retail, made effortless',
        sub: 'Everything between the customer walking in and you counting the cash at night.',
        bullets: [
            'Bill in seconds, GST included — cash, UPI, card, or split across all three on one bill.',
            'Never throw away expired stock — batch-wise expiry tracking, with alerts before the date.',
            'Every rupee of udhar, with aging — oldest dues first, reminders ready at 10 AM daily.',
            'Order before you run out — quantities worked out from how fast each item really sells.',
            'Know your profit tonight — day-close in one tap, not at month-end.',
            'Quote today, bill tomorrow — turn a quotation into an invoice with one tap.',
            'Returns handled properly — credit notes, damage and wastage against profit.',
            'Suppliers and purchases — POs, goods receipt, and what you still owe.',
        ],
        cta: 'Start free — set up in 30 seconds',
        stats: [
            ['Bill time', '< 10 sec'],
            ['Expiry alerts', 'Batch-wise'],
            ['Udhar aging', 'Oldest first'],
            ['Day close', 'One tap'],
        ],
        kit: {
            label: 'Works with your counter',
            hint: 'Tap a dot to see how each one works with Whoply.',
            items: [
                { title: 'Tablet or phone', body: 'Bill on whichever screen sits at your counter — cash, UPI, card, or split across all three.' },
                { title: 'Thermal printer', body: 'Prints the GST bill on 58mm or 80mm rolls — or as a full A4 invoice.' },
                { title: 'Barcode scanner', body: 'Plug in a USB scanner, or scan with your phone’s camera. On the Pro plan.' },
                { title: 'UPI QR', body: 'Shows your UPI QR with the bill amount already filled in. The customer just scans and pays.' },
            ],
        },
        groups: [
            { title: 'GST billing', body: 'Bill in seconds with GST built in, turn quotes into invoices, and handle returns properly.' },
            { title: 'Stock & expiry alerts', body: 'Batch-wise expiry warnings, and reorder quantities worked out from what really sells.' },
            { title: 'Udhar & collections', body: 'Every rupee of credit with aging, WhatsApp reminders, and tonight’s profit in one tap.' },
            { title: 'Suppliers & purchases', body: 'Purchase orders, goods receipt, and exactly what you still owe each supplier.' },
        ],
        metrics: {
            avg: '8 sec average',
            batch: (n, e) => `Batch #${n} • Exp ${e}`,
            due: (a) => `${a} due`,
            reminded: 'Auto-reminded',
            send: 'Send day-close summary',
            sent: 'Summary sent',
        },
        mock: {
            tabsLabel: 'Retail features',
            pay: ['Cash', 'UPI', 'Card'],
            batch: 'Batch',
            expiresIn: (d) => `Expires in ${d} days`,
            days: (d) => `${d} days`,
            quote: 'Quotation',
            invoice: 'Invoice',
            convert: 'Converted to invoice',
            creditNote: 'Credit note',
            returned: 'Returned',
            damaged: 'Damaged',
            po: 'Purchase order',
            received: 'Received',
            pending: 'Pending',
            youOwe: 'You owe suppliers',
        },
    },
    wholesalers: {
        eyebrow: 'For wholesalers',
        title: 'Distribution, under control',
        sub: 'From the order landing on WhatsApp to the money reaching your account.',
        bullets: [
            'Dealer-wise price tiers — Retailer A ₹95, B ₹92, C ₹90. Applied automatically.',
            'Bulk orders, none missed — WhatsApp, phone or counter into one list.',
            'Dispatch to delivery, tracked — shipped? received? delayed? paid?',
            'E-way bill & e-invoice — raised from the order screen as goods leave.',
            'Outstanding by dealer — with credit limits enforced before the next order.',
            'Collect on the route — your rep records payment against the dealer on the spot.',
            'Know where your team went — visits logged, orders collected, commission calculated.',
            'Warehouse that matches reality — stock, pick, pack, and what’s on the shelf.',
        ],
        cta: 'Start free — set up in 30 seconds',
        timelineLabel: 'Dispatch timeline',
        timeline: [
            ['Order placed', 'Gupta Distributors · ₹84,200'],
            ['Packed', 'Warehouse A · 12 cartons'],
            ['Dispatched', 'E-way bill raised'],
            ['Delivered', 'Awaiting confirmation'],
            ['Payment', '₹84,200 outstanding'],
        ],
        mock: {
            tabsLabel: 'Distribution features',
            tier: 'Retailer',
            auto: 'Applied automatically',
            newOrders: 'New orders',
            phone: 'Phone',
            counter: 'Counter',
            generated: 'Generated',
            limit: 'Limit',
            onHold: 'Over limit — next order on hold',
            collected: 'Collected on route',
            visits: 'Visits',
            orders: 'Orders',
            commission: 'Commission',
            pick: 'Pick',
            pack: 'Pack',
            onShelf: 'On shelf',
        },
        stages: [
            {
                title: 'Dealer price tiers',
                sub: 'Rate slabs per retailer type',
                body: 'Every dealer sits in a tier. Pick the dealer and the right rate goes on the order by itself — no rate card, no mistakes.',
            },
            {
                title: 'Bulk orders & dispatch',
                sub: 'Packing list and e-way bill in one go',
                body: 'Orders from WhatsApp, phone or counter land in one list. The packing list, e-way bill and e-invoice are raised as the goods leave.',
            },
            {
                title: 'Route & collection',
                sub: 'Field agents, tracked',
                body: 'Your agent logs every visit and records payment against the dealer on the spot. You see what came in before they’re back.',
            },
            {
                title: 'Outstanding credit matrix',
                sub: 'Dealer-wise ledger and limits',
                body: 'Outstanding by dealer, with credit limits enforced before the next order goes through.',
            },
        ],
        pipe: {
            dealer: 'Dealer',
            applied: (tier, price) => `${tier}: ${price} applied automatically`,
            order: 'Order',
            ewb: 'E-way bill generated',
            driver: 'Driver assigned',
            out: 'Out for delivery',
            agent: (n) => `Agent ${n}`,
            visited: (n) => `${n} stores visited`,
            collected: (a) => `${a} collected today`,
            outstanding: 'Outstanding',
            available: 'Available',
            ok: 'Within limit',
            hold: 'On hold',
        },
    },
    features: {
        eyebrow: 'Everything included',
        title: 'One app instead of a dozen registers',
        cards: [
            {
                title: 'GST Billing (POS)',
                body: 'Fast, correct, GST-ready invoices. Hold a cart, resume it, split the payment.',
            },
            {
                title: 'Smart Inventory',
                body: 'Low stock, expiry, fast and slow movers — you find out before it costs you.',
            },
            {
                title: 'Udhar & Credit',
                body: 'Every customer’s ledger with aging, and a daily list of who to chase.',
            },
            {
                title: 'Orders & Dispatch',
                body: 'Bulk orders, warehouse, dispatch and delivery in one timeline.',
            },
            {
                title: 'Reports that decide things',
                body: 'Today’s sales, real profit, best and worst products, top customers.',
            },
            {
                title: 'Staff who see only their work',
                body: 'Owner, manager, cashier, warehouse, sales staff — separate logins, separate views.',
            },
        ],
        ui: {
            remind: 'Remind',
            sent: 'Sent',
            remindAll: 'Remind all on WhatsApp',
            allSent: 'All reminders sent',
            roles: ['Owner', 'Manager', 'Cashier', 'Warehouse', 'Sales'],
            perms: ['Billing', 'Stock', 'Reports', 'Profit'],
            seeAs: 'See the app as',
            chartHint: 'Tap a bar',
            sales: 'Sales',
        },
    },
    reorder: {
        eyebrow: 'Reorder engine',
        title: 'Order before you run out',
        body: 'Whoply watches how fast each item actually sells, then tells you what to reorder, how much, and how many days you have left. No black box — you can see the maths.',
        foot: 'Based on your own sales history over the last 30 days. Nothing is guessed.',
        rows: [
            ['Parle-G 200g', 'Days of cover: 3', 'Order 24'],
            ['Colgate 100g', 'Days of cover: 9', 'Order 12'],
            ['Tata Salt 1kg', 'Days of cover: 31', 'Fine'],
        ],
    },
    staff: {
        title: 'Your cashier bills. Your cashier never sees your profit.',
        body: 'Every person gets their own login and sees only their own work. Cashiers get billing and today’s sales. Warehouse gets stock and dispatch. Sales staff get their own dealers and route. Your margins, expenses and reports stay yours.',
        note: 'One login can’t be shared across five phones — device limits are enforced per role.',
    },
    automation: {
        title: 'Three things Whoply does while you sleep',
        items: [
            {
                when: 'Every night, 9 PM',
                what: 'Your day’s summary — sales, profit, dues, low stock — waiting on your phone.',
            },
            {
                when: 'Every morning, 10 AM',
                what: 'Today’s udhar list: who owes what, oldest first, ready to send.',
            },
            {
                when: 'Every Monday, 9 AM',
                what: 'What you owe your suppliers this week, before they call to ask.',
            },
        ],
    },
    tour: {
        eyebrow: 'The dashboard',
        title: 'Your whole business, on one screen',
        sub: 'Everything you used to flip through registers for — in one place, every morning.',
        hint: 'Tap a dot, or pick from the list',
        items: [
            { title: 'Today’s sales, as they happen', cap: 'Every bill lands here the moment it’s made, with the week’s trend beside it.' },
            { title: 'What’s actually selling', cap: 'Your best sellers by quantity and value — stock more of what moves.' },
            { title: 'Every order, and where it is', cap: 'Delivered, processing or pending — no phone calls to find out.' },
            { title: 'Low stock, before it runs out', cap: 'Items about to finish are flagged with exactly how many are left.' },
            { title: 'Where the money went', cap: 'Rent, purchases and bills sorted, so the profit you see is real.' },
        ],
    },
    how: {
        eyebrow: 'Getting started',
        title: 'Running by this evening',
        steps: [
            ['Sign up with your mobile', 'An OTP, thirty seconds, no paperwork, no card.'],
            ['Add your products', 'Type them in or import the list you already have.'],
            ['Start billing', 'Proper GST invoices from your very first sale.'],
        ],
    },
    install: {
        eyebrow: 'Install',
        title: 'No Play Store. No computer. No training.',
        sub: 'Whoply installs straight from your browser onto your home screen and opens like any other app. It works on the phone you already own — and on a tablet at the counter if you’d rather have a bigger screen.',
        chips: ['Installs in one tap', 'Works on any Android phone', 'Same login on every device'],
    },
    pricing: {
        eyebrow: 'Pricing',
        title: 'Simple, honest pricing',
        sub: 'Start free. Move up when your business does.',
        anchor: 'One udhar entry you forgot to collect costs more than a year of Pro.',
        per: 'month',
        popular: 'Most popular for shops',
        startFree: 'Start free',
        choose: (name) => `Choose ${name}`,
        planFor: {
            free: 'One shop, getting started',
            pro: 'A busy retail shop',
            business: 'Wholesalers & multi-shop',
        },
        foot: 'Your data is yours. Export it any time, on any plan — including Free.',
        monthly: 'Monthly',
        yearly: 'Yearly',
        save: 'Save 20%',
        billedYearly: (a) => `${a} billed yearly`,
    },
    faq: {
        eyebrow: 'FAQ',
        title: 'Questions shop owners ask us',
        cats: ['All questions', 'Hardware & offline', 'Tax & staff access', 'Data & onboarding'],
        proof: {
            devices: 'Android phone & tablet · No laptop needed',
            export: 'GSTR-ready reports · 1-click Tally export',
            offline: 'Opens without signal · Offline billing coming soon',
        },
        qa: [
            [
                'Do I need a computer?',
                'No. Any Android phone is enough. Whoply installs from your browser — no Play Store, no laptop.',
            ],
            [
                'Is it really in Hindi?',
                'Yes — the entire app, not just the menus. Switch between English, हिंदी and ગુજરાતી any time from settings.',
            ],
            [
                'Will my CA get what he needs?',
                'Yes. GSTR-ready reports plus a Tally export, so he keeps working the way he already does.',
            ],
            [
                'Can my staff see my profit?',
                'Only if you allow it. A cashier sees billing and today’s sales — nothing about margins, expenses or reports.',
            ],
            ['Can I move my existing product list in?', 'Yes, import it. You don’t retype your catalogue.'],
            [
                'What happens if I stop paying?',
                'Your data stays yours and you can export it. You’re never locked out of your own records.',
            ],
            [
                'Does it work without internet?',
                'You can open the app without a signal, but billing needs a connection today. Offline billing is on the way.',
            ],
            ['How long does setup take?', 'Most shops are billing the same evening they sign up.'],
        ],
    },
    finalCta: {
        eyebrow: 'Same trusted shop. Now smarter.',
        title: 'Stop running your shop on paper.',
        sub: 'Free to start. No card, no computer, no training.',
        button: 'Start free today',
        foot: 'Set up in 30 seconds · Cancel any time',
    },
    contact: {
        whatsapp: 'Chat on WhatsApp',
        whatsappMsg: 'Hi Whoply, I want to know more about the app for my business.',
    },
    footer: {
        tagline: 'Billing, stock, udhar and orders — for Bharat’s shops and wholesalers.',
        columns: [
            {
                head: 'Product',
                links: [
                    ['Features', '#shopkeepers'],
                    ['Pricing', '#pricing'],
                    ['Install the app', '#install'],
                ],
            },
            {
                head: 'Business',
                links: [
                    ['For Shopkeepers', '#shopkeepers'],
                    ['For Wholesalers', '#wholesalers'],
                    ['GST & Compliance', '#compliance'],
                    ['FAQ', '#faq'],
                ],
            },
            {
                head: 'Company',
                links: [
                    ['About', '#'],
                    ['Contact', '#'],
                    ['Privacy Policy', '#'],
                    ['Terms of Service', '#'],
                ],
            },
        ],
        legal: '© 2026 Whoply. Made in India, for Bharat’s businesses.',
    },
};

const hi: LandingCopy = {
    meta: {
        title: 'Whoply — दुकानदारों और थोक विक्रेताओं के लिए GST बिलिंग, स्टॉक और उधार ऐप',
        description:
            'GST बिलिंग, स्टॉक, उधार और ऑर्डर — सब एक ऐप में। E-invoice, e-way bill और Tally export शामिल। पूरा ऐप हिंदी में। मुफ़्त शुरू करें।',
        ogTitle: 'पूरा व्यापार एक ही ऐप से चलाएँ — Whoply',
        ogDescription:
            'भारतीय दुकानदारों और थोक विक्रेताओं के लिए GST बिलिंग, स्टॉक, उधार, डीलर और डिस्पैच। E-invoice और e-way bill तैयार। मुफ़्त शुरुआत।',
    },
    nav: {
        announcement: 'E-invoice, e-way bill और Tally export — पहले से मौजूद, बाद में जोड़े गए नहीं।',
        links: [
            { href: '#compliance', label: 'GST और कम्प्लायंस' },
            { href: '#shopkeepers', label: 'दुकानदारों के लिए' },
            { href: '#wholesalers', label: 'थोक विक्रेताओं के लिए' },
            { href: '#pricing', label: 'कीमत' },
            { href: '#faq', label: 'सवाल-जवाब' },
        ],
        login: 'लॉगिन',
        start: 'मुफ़्त शुरू करें',
        switchLabel: 'भाषा',
        switchCta: 'भाषा',
        openMenu: 'मेन्यू खोलें',
        closeMenu: 'मेन्यू बंद करें',
        home: 'Whoply होम',
        primaryNav: 'मुख्य',
        mobileNav: 'मोबाइल',
    },
    hero: {
        switchLabel: 'अपना व्यवसाय चुनें',
        retail: {
            tab: 'मेरी दुकान है',
            eyebrow: 'भारत की दुकानों के लिए',
            h1: 'अपनी पूरी दुकान,',
            h1Accent: 'अपनी जेब में।',
            sub: 'GST बिलिंग, स्टॉक और उधार — एक ही ऐप में। सेकंडों में बिल बनाएँ, आज का मुनाफ़ा आज ही जानें, और भूले हुए उधार से होने वाला नुकसान रोकें।',
            trust: ['GST और e-invoice तैयार', 'पूरा ऐप हिंदी में', 'ऐप की तरह इंस्टॉल'],
        },
        wholesale: {
            tab: 'मैं थोक विक्रेता हूँ',
            eyebrow: 'भारत के वितरकों के लिए',
            h1: 'हर ऑर्डर, हर डिस्पैच,',
            h1Accent: 'हर बकाया रुपया।',
            sub: 'डीलर-वार कीमत, बल्क ऑर्डर, e-way bill और डिलीवरी ट्रैकिंग। जानें क्या भेजा गया, क्या पहुँचा, और किस पर कितना बाकी है।',
            trust: ['E-way bill और e-invoice', 'Tally में एक्सपोर्ट', 'पूरा ऐप हिंदी में'],
        },
        ctaPrimary: 'मुफ़्त शुरू करें — कार्ड की ज़रूरत नहीं',
        ctaSecondary: 'डेमो देखें',
        mock: {
            today: 'आज',
            live: 'लाइव',
            retailTiles: [
                ['आज की बिक्री', '₹10,380'],
                ['बिल', '18'],
                ['मुनाफ़ा (अनुमान)', '₹11,696'],
                ['बकाया उधार', '₹49,299'],
            ],
            wholesaleTiles: [
                ['आज के ऑर्डर', '34'],
                ['डिस्पैच बाकी', '11'],
                ['कुल बकाया', '₹4,86,200'],
                ['वसूली', '₹1,12,400'],
            ],
            rows: [
                ['Parle-G 200g', '3 दिन बाकी'],
                ['Colgate 100g', '9 दिन बाकी'],
                ['Tata Salt 1kg', '31 दिन बाकी'],
            ],
            retailAction: 'नया GST बिल',
            wholesaleAction: 'नया बल्क ऑर्डर',
            retailBusiness: 'शर्मा जनरल स्टोर',
            wholesaleBusiness: 'गुप्ता डिस्ट्रीब्यूटर्स',
            alert: 'स्टॉक कम',
            reminder: 'रिमाइंडर भेजा',
            bill: {
                total: 'कुल',
                sent: 'बिल WhatsApp पर भेजा गया',
                retailItems: [
                    ['Parle-G 200g', '×4', 100],
                    ['Tata Salt 1kg', '×2', 56],
                    ['Amul Butter 100g', '×1', 58],
                ],
                wholesaleItems: [
                    ['Parle-G 200g', '×20 पेटी', 14400],
                    ['Tata Salt 1kg', '×10 बोरी', 6720],
                    ['Colgate 100g', '×6 पेटी', 8640],
                ],
            },
        },
    },
    marquee: {
        label: 'Whoply में क्या-क्या है',
        items: [
            'GST और E-Invoice तैयार',
            'E-Way Bill शामिल',
            'Tally में एक्सपोर्ट',
            'हिंदी + ગુજરાતી + English',
            'कोई भी फ़ोन — कंप्यूटर की ज़रूरत नहीं',
            'बैच और एक्सपायरी ट्रैकिंग',
            'डीलर-वार मूल्य सूची',
        ],
    },
    problem: {
        eyebrow: 'कागज़ की कीमत',
        title: 'कागज़ भूल जाता है। Whoply नहीं।',
        cards: [
            {
                title: 'वो उधार जो आप भूल गए',
                body: 'डायरी में लिखा एक नाम, छह महीने पुराना। Whoply हर ग्राहक का हिसाब पुराने बकाया के साथ रखता है, और रोज़ सुबह वसूली की लिस्ट देता है।',
            },
            {
                title: 'वो स्टॉक जो एक्सपायर हो गया',
                body: 'पीछे रखे डिब्बे, तारीख निकल गई, सीधा नुकसान। Whoply बैच ट्रैक करता है और एक्सपायरी से पहले चेतावनी देता है।',
            },
            {
                title: 'वो बिल जो ग़लत बना',
                body: 'ग़लत GST दर, ग़लत टोटल, काउंटर पर बहस। Whoply हर बार सही गिनता है और सही छापता है।',
            },
            {
                title: 'वो मुनाफ़ा जिसका आप अंदाज़ा लगाते हैं',
                body: 'आज की बिक्री आपको पता है। आज का मुनाफ़ा नहीं। Whoply को पता है — शटर गिराने से पहले।',
            },
        ],
        compare: {
            paper: 'कागज़ी रजिस्टर',
            paperSub: 'जिस पर ज़्यादातर काउंटर आज भी चलते हैं',
            app: 'Whoply डिजिटल खाता',
            appSub: 'वही दुकान, आपके फ़ोन पर',
            vs: 'बनाम',
            rows: [
                {
                    topic: 'उधार',
                    paper: 'डायरी में छह महीने पुराना एक नाम। कोई याद नहीं दिलाता।',
                    paperTag: 'भूला हुआ',
                    app: 'हर ग्राहक का खाता, पुराने बकाये के साथ। सुबह 10 बजे WhatsApp पर रिमाइंडर।',
                    appTag: 'अपने आप रिमाइंडर',
                },
                {
                    topic: 'एक्सपायरी',
                    paper: 'पीछे रखे कार्टन, तारीख निकल गई — सीधा नुकसान।',
                    paperTag: 'एक्सपायर',
                    app: 'बैच-वार ट्रैकिंग, तारीख से पहले चेतावनी।',
                    appTag: '7 दिन पहले अलर्ट',
                },
                {
                    topic: 'बिलिंग',
                    paper: 'गलत GST दर, गलत टोटल, काउंटर पर बहस।',
                    paperTag: 'विवाद',
                    app: 'GST की सही गणना, हर बार सही प्रिंट।',
                    appTag: 'GST सही',
                },
                {
                    topic: 'मुनाफ़ा',
                    paper: 'आज की बिक्री पता है, मुनाफ़ा महीने के अंत तक अंदाज़ा।',
                    paperTag: 'अंदाज़ा',
                    app: 'शटर गिराने से पहले असली मुनाफ़ा।',
                    appTag: 'आज रात ही',
                },
            ],
            live: ['+ ₹500 वसूल', 'अलर्ट भेजा · 7 दिन बाकी', 'बिल WhatsApp पर भेजा', 'आज का मुनाफ़ा ₹6,420'],
            liveLabel: 'लाइव',
            autoSent: 'WhatsApp अपने आप भेजा',
            flow: 'अब वही दुकान, Whoply पर',
            paperNote: 'मिला??',
        },
    },
    compliance: {
        eyebrow: 'कम्प्लायंस',
        title: 'भारतीय GST के लिए बना — ऊपर से चिपकाया नहीं',
        sub: 'जो कम्प्लायंस का काम आपकी शामें खा जाता है, वह उसी स्क्रीन पर हो जाता है जहाँ से आप बिल बनाते हैं।',
        cards: [
            {
                title: 'E-Invoice (IRN)',
                body: 'किसी भी बिल या बल्क ऑर्डर का IRN, सीधे इनवॉइस स्क्रीन से बनाएँ।',
            },
            {
                title: 'E-Way Bill',
                body: 'माल गोदाम से निकलते ही बनाएँ — अलग पोर्टल नहीं, दोबारा टाइप नहीं।',
            },
            {
                title: 'GSTR-तैयार रिपोर्ट',
                body: 'बिक्री, खरीद और टैक्स का ब्यौरा — ठीक उसी तरह जैसा आपकी रिटर्न को चाहिए।',
            },
            {
                title: 'Tally एक्सपोर्ट',
                body: 'आपके CA के पास Tally रहे। आपके पास फ़ोन। एक एक्सपोर्ट से दोनों खुश।',
            },
        ],
        quote: '“आपके CA को उनकी फ़ाइल मिल जाती है। आपको लैपटॉप खोलना ही नहीं पड़ता।”',
        pipe: {
            irn: 'IRN बन गया',
            cleared: 'अपने आप क्लियर',
            vehicle: 'गाड़ी',
            taxable: 'कर योग्य राशि',
            exportBtn: '1-क्लिक Tally export',
            exporting: 'भेजा जा रहा है…',
            sent: 'CA को भेजा',
        },
    },
    shopkeepers: {
        eyebrow: 'दुकानदारों के लिए',
        title: 'रिटेल, बिल्कुल आसान',
        sub: 'ग्राहक के अंदर आने से लेकर रात को कैश गिनने तक — सब कुछ।',
        bullets: [
            'सेकंडों में GST बिल — कैश, UPI, कार्ड, या एक ही बिल में तीनों का बँटवारा।',
            'एक्सपायर स्टॉक अब बर्बाद नहीं — बैच-वार एक्सपायरी ट्रैकिंग, तारीख से पहले अलर्ट।',
            'हर रुपये का उधार, पुराने पहले — रोज़ सुबह 10 बजे वसूली की लिस्ट तैयार।',
            'खत्म होने से पहले ऑर्डर करें — कौन सा माल कितनी तेज़ी से बिकता है, उसी से मात्रा तय।',
            'आज का मुनाफ़ा आज जानें — एक टैप में day-close, महीने के अंत का इंतज़ार नहीं।',
            'आज कोटेशन, कल बिल — एक टैप में कोटेशन से इनवॉइस।',
            'रिटर्न का सही हिसाब — क्रेडिट नोट, टूट-फूट और बर्बादी सीधे मुनाफ़े के सामने।',
            'सप्लायर और खरीद — PO, माल की रसीद, और आप पर कितना बाकी है।',
        ],
        cta: 'मुफ़्त शुरू करें — 30 सेकंड में सेटअप',
        stats: [
            ['बिल का समय', '10 सेकंड से कम'],
            ['एक्सपायरी अलर्ट', 'बैच-वार'],
            ['उधार', 'पुराने पहले'],
            ['Day close', 'एक टैप'],
        ],
        kit: {
            label: 'आपके काउंटर के साथ चलता है',
            hint: 'किसी बिंदु पर टैप करें और देखें Whoply उसके साथ कैसे काम करता है।',
            items: [
                { title: 'टैबलेट या फ़ोन', body: 'काउंटर पर जो भी स्क्रीन हो, उसी पर बिल — कैश, UPI, कार्ड, या तीनों का बँटवारा।' },
                { title: 'थर्मल प्रिंटर', body: '58mm या 80mm रोल पर GST बिल प्रिंट — या पूरा A4 इनवॉइस।' },
                { title: 'बारकोड स्कैनर', body: 'USB स्कैनर लगाइए, या फ़ोन के कैमरे से स्कैन कीजिए। Pro प्लान में।' },
                { title: 'UPI QR', body: 'बिल की रकम भरा हुआ आपका UPI QR दिखता है। ग्राहक बस स्कैन करके पेमेंट करे।' },
            ],
        },
        groups: [
            { title: 'GST बिलिंग', body: 'GST के साथ सेकंडों में बिल, कोटेशन से इनवॉइस, और रिटर्न का सही हिसाब।' },
            { title: 'स्टॉक और एक्सपायरी अलर्ट', body: 'बैच-वार एक्सपायरी चेतावनी, और असली बिक्री से तय होने वाली रीऑर्डर मात्रा।' },
            { title: 'उधार और वसूली', body: 'हर रुपये का उधार पुराने बकाये के साथ, WhatsApp रिमाइंडर, और एक टैप में आज का मुनाफ़ा।' },
            { title: 'सप्लायर और खरीद', body: 'खरीद ऑर्डर, माल की रसीद, और हर सप्लायर का कितना बाकी है।' },
        ],
        metrics: {
            avg: 'औसत 8 सेकंड',
            batch: (n, e) => `बैच #${n} • एक्सपायरी ${e}`,
            due: (a) => `${a} बाकी`,
            reminded: 'अपने आप रिमाइंडर',
            send: 'डे-क्लोज़ सारांश भेजें',
            sent: 'सारांश भेजा गया',
        },
        mock: {
            tabsLabel: 'रिटेल फ़ीचर',
            pay: ['नकद', 'UPI', 'कार्ड'],
            batch: 'बैच',
            expiresIn: (d) => `${d} दिन में एक्सपायर`,
            days: (d) => `${d} दिन`,
            quote: 'कोटेशन',
            invoice: 'इनवॉइस',
            convert: 'इनवॉइस बन गया',
            creditNote: 'क्रेडिट नोट',
            returned: 'वापसी',
            damaged: 'टूट-फूट',
            po: 'खरीद ऑर्डर',
            received: 'मिल गया',
            pending: 'बाकी',
            youOwe: 'सप्लायरों का बकाया',
        },
    },
    wholesalers: {
        eyebrow: 'थोक विक्रेताओं के लिए',
        title: 'वितरण, पूरे नियंत्रण में',
        sub: 'WhatsApp पर ऑर्डर आने से लेकर पैसा खाते में पहुँचने तक।',
        bullets: [
            'डीलर-वार कीमत — रिटेलर A ₹95, B ₹92, C ₹90। हर बार अपने आप लागू।',
            'बल्क ऑर्डर, एक भी न छूटे — WhatsApp, फ़ोन या काउंटर, सब एक लिस्ट में।',
            'डिस्पैच से डिलीवरी तक ट्रैकिंग — भेजा? पहुँचा? देरी? भुगतान हुआ?',
            'e-way bill और e-invoice — माल निकलते ही ऑर्डर स्क्रीन से।',
            'डीलर-वार बकाया — अगले ऑर्डर से पहले क्रेडिट लिमिट लागू।',
            'रूट पर ही वसूली — आपका रेप मौके पर डीलर के नाम भुगतान दर्ज करे।',
            'टीम कहाँ गई, पता रहे — विज़िट दर्ज, ऑर्डर लिए गए, कमीशन की गिनती।',
            'गोदाम जो हकीकत से मेल खाए — स्टॉक, पिक, पैक, और शेल्फ़ पर क्या है।',
        ],
        cta: 'मुफ़्त शुरू करें — 30 सेकंड में सेटअप',
        timelineLabel: 'डिस्पैच टाइमलाइन',
        timeline: [
            ['ऑर्डर मिला', 'Gupta Distributors · ₹84,200'],
            ['पैक हुआ', 'गोदाम A · 12 कार्टन'],
            ['डिस्पैच', 'E-way bill बना'],
            ['डिलीवर', 'पुष्टि बाकी'],
            ['भुगतान', '₹84,200 बकाया'],
        ],
        mock: {
            tabsLabel: 'वितरण फ़ीचर',
            tier: 'रिटेलर',
            auto: 'अपने आप लागू',
            newOrders: 'नए ऑर्डर',
            phone: 'फ़ोन',
            counter: 'काउंटर',
            generated: 'बन गया',
            limit: 'लिमिट',
            onHold: 'लिमिट पार — अगला ऑर्डर रुका',
            collected: 'रूट पर वसूली',
            visits: 'विज़िट',
            orders: 'ऑर्डर',
            commission: 'कमीशन',
            pick: 'पिक',
            pack: 'पैक',
            onShelf: 'शेल्फ़ पर',
        },
        stages: [
            {
                title: 'डीलर प्राइस टियर',
                sub: 'रिटेलर के प्रकार के हिसाब से रेट',
                body: 'हर डीलर एक टियर में है। डीलर चुनिए, सही रेट ऑर्डर पर अपने आप लग जाता है — न रेट कार्ड, न गलती।',
            },
            {
                title: 'बल्क ऑर्डर और डिस्पैच',
                sub: 'पैकिंग लिस्ट और e-way bill एक साथ',
                body: 'WhatsApp, फ़ोन या काउंटर के ऑर्डर एक लिस्ट में। माल निकलते ही पैकिंग लिस्ट, e-way bill और e-invoice तैयार।',
            },
            {
                title: 'रूट और वसूली',
                sub: 'फ़ील्ड एजेंट की पूरी ट्रैकिंग',
                body: 'आपका एजेंट हर विज़िट दर्ज करता है और मौके पर डीलर के नाम भुगतान लिखता है। उसके लौटने से पहले आपको वसूली दिख जाती है।',
            },
            {
                title: 'बकाया क्रेडिट मैट्रिक्स',
                sub: 'डीलर-वार खाता और लिमिट',
                body: 'डीलर-वार बकाया, और अगले ऑर्डर से पहले क्रेडिट लिमिट लागू।',
            },
        ],
        pipe: {
            dealer: 'डीलर',
            applied: (tier, price) => `${tier}: ${price} अपने आप लागू`,
            order: 'ऑर्डर',
            ewb: 'e-way bill बना',
            driver: 'ड्राइवर तय',
            out: 'डिलीवरी के लिए निकला',
            agent: (n) => `एजेंट ${n}`,
            visited: (n) => `${n} दुकानों पर विज़िट`,
            collected: (a) => `आज ${a} वसूल`,
            outstanding: 'बकाया',
            available: 'उपलब्ध',
            ok: 'लिमिट में',
            hold: 'रुका हुआ',
        },
    },
    features: {
        eyebrow: 'सब कुछ शामिल',
        title: 'एक ऐप, दर्जनों रजिस्टर की जगह',
        cards: [
            {
                title: 'GST बिलिंग (POS)',
                body: 'तेज़ और सही GST बिल। कार्ट रोकें, फिर से शुरू करें, भुगतान बाँटें।',
            },
            {
                title: 'स्मार्ट स्टॉक',
                body: 'कम स्टॉक, एक्सपायरी, तेज़ और धीमा बिकने वाला माल — नुकसान से पहले पता चले।',
            },
            {
                title: 'उधार और क्रेडिट',
                body: 'हर ग्राहक का हिसाब, पुराने बकाया के साथ, और रोज़ की वसूली लिस्ट।',
            },
            {
                title: 'ऑर्डर और डिस्पैच',
                body: 'बल्क ऑर्डर, गोदाम, डिस्पैच और डिलीवरी — एक ही टाइमलाइन में।',
            },
            {
                title: 'फ़ैसले लेने वाली रिपोर्ट',
                body: 'आज की बिक्री, असली मुनाफ़ा, सबसे अच्छा और सबसे खराब माल, टॉप ग्राहक।',
            },
            {
                title: 'स्टाफ़ को सिर्फ़ अपना काम दिखे',
                body: 'मालिक, मैनेजर, कैशियर, गोदाम, सेल्स स्टाफ़ — अलग लॉगिन, अलग नज़र।',
            },
        ],
        ui: {
            remind: 'याद दिलाएँ',
            sent: 'भेजा',
            remindAll: 'सबको WhatsApp पर याद दिलाएँ',
            allSent: 'सारे रिमाइंडर भेजे गए',
            roles: ['मालिक', 'मैनेजर', 'कैशियर', 'गोदाम', 'सेल्स'],
            perms: ['बिलिंग', 'स्टॉक', 'रिपोर्ट', 'मुनाफ़ा'],
            seeAs: 'ऐप ऐसे देखें',
            chartHint: 'किसी बार पर टैप करें',
            sales: 'बिक्री',
        },
    },
    reorder: {
        eyebrow: 'रीऑर्डर इंजन',
        title: 'खत्म होने से पहले ऑर्डर करें',
        body: 'Whoply देखता है कि कौन सा माल असल में कितनी तेज़ी से बिकता है, फिर बताता है कि क्या मँगाना है, कितना मँगाना है, और कितने दिन बचे हैं। कोई छुपा हुआ जादू नहीं — हिसाब आपके सामने है।',
        foot: 'आपकी अपनी पिछले 30 दिन की बिक्री पर आधारित। कुछ भी अंदाज़े से नहीं।',
        rows: [
            ['Parle-G 200g', 'बचे दिन: 3', '24 मँगाएँ'],
            ['Colgate 100g', 'बचे दिन: 9', '12 मँगाएँ'],
            ['Tata Salt 1kg', 'बचे दिन: 31', 'ठीक है'],
        ],
    },
    staff: {
        title: 'कैशियर बिल बनाए। कैशियर को मुनाफ़ा कभी न दिखे।',
        body: 'हर व्यक्ति का अपना लॉगिन, और उसे सिर्फ़ अपना काम दिखता है। कैशियर को बिलिंग और आज की बिक्री। गोदाम को स्टॉक और डिस्पैच। सेल्स स्टाफ़ को अपने डीलर और रूट। आपका मार्जिन, खर्च और रिपोर्ट सिर्फ़ आपके।',
        note: 'एक लॉगिन पाँच फ़ोन पर नहीं चलेगा — हर रोल पर डिवाइस लिमिट लागू है।',
    },
    automation: {
        title: 'तीन काम जो Whoply आपके सोते समय करता है',
        items: [
            {
                when: 'हर रात, 9 बजे',
                what: 'दिन का हिसाब — बिक्री, मुनाफ़ा, बकाया, कम स्टॉक — आपके फ़ोन पर तैयार।',
            },
            {
                when: 'हर सुबह, 10 बजे',
                what: 'आज की उधार लिस्ट: किस पर कितना, पुराने पहले, भेजने को तैयार।',
            },
            {
                when: 'हर सोमवार, 9 बजे',
                what: 'इस हफ़्ते सप्लायर को क्या देना है — उनके फ़ोन आने से पहले।',
            },
        ],
    },
    tour: {
        eyebrow: 'डैशबोर्ड',
        title: 'पूरा कारोबार, एक ही स्क्रीन पर',
        sub: 'जिसके लिए रजिस्टर पलटने पड़ते थे — वो सब एक जगह, हर सुबह।',
        hint: 'किसी बिंदु पर टैप करें, या लिस्ट से चुनें',
        items: [
            { title: 'आज की बिक्री, उसी वक़्त', cap: 'हर बिल बनते ही यहाँ दिखता है, साथ में पूरे हफ़्ते का ट्रेंड।' },
            { title: 'असल में क्या बिक रहा है', cap: 'मात्रा और कीमत के हिसाब से सबसे ज़्यादा बिकने वाला माल — जो चलता है, वही ज़्यादा रखें।' },
            { title: 'हर ऑर्डर, और वो कहाँ है', cap: 'डिलीवर, प्रोसेसिंग या पेंडिंग — पता करने के लिए फ़ोन नहीं करना पड़ता।' },
            { title: 'स्टॉक खत्म होने से पहले', cap: 'जो माल खत्म होने वाला है, वो ठीक कितना बचा है, उसके साथ दिखता है।' },
            { title: 'पैसा कहाँ गया', cap: 'किराया, खरीद और बिल अलग-अलग — ताकि जो मुनाफ़ा दिखे, वो असली हो।' },
        ],
    },
    how: {
        eyebrow: 'शुरुआत',
        title: 'आज शाम तक चालू',
        steps: [
            ['मोबाइल से साइन अप', 'एक OTP, तीस सेकंड, न कागज़ी काम, न कार्ड।'],
            ['अपना माल जोड़ें', 'टाइप करें या पहले से बनी लिस्ट इम्पोर्ट करें।'],
            ['बिलिंग शुरू', 'पहली ही बिक्री से पूरे GST बिल।'],
        ],
    },
    install: {
        eyebrow: 'इंस्टॉल',
        title: 'न Play Store। न कंप्यूटर। न ट्रेनिंग।',
        sub: 'Whoply सीधे ब्राउज़र से आपकी होम स्क्रीन पर इंस्टॉल होता है और किसी भी ऐप की तरह खुलता है। जो फ़ोन आपके पास है उसी पर चलता है — और बड़ी स्क्रीन चाहिए तो काउंटर पर टैबलेट पर भी।',
        chips: ['एक टैप में इंस्टॉल', 'किसी भी Android फ़ोन पर', 'हर डिवाइस पर वही लॉगिन'],
    },
    pricing: {
        eyebrow: 'कीमत',
        title: 'सीधी, ईमानदार कीमत',
        sub: 'मुफ़्त शुरू करें। व्यापार बढ़े तो आगे बढ़ें।',
        anchor: 'एक भूला हुआ उधार, Pro के पूरे साल से ज़्यादा महँगा पड़ता है।',
        per: 'महीना',
        popular: 'दुकानों की पहली पसंद',
        startFree: 'मुफ़्त शुरू करें',
        choose: (name) => `${name} चुनें`,
        planFor: {
            free: 'एक दुकान, शुरुआत के लिए',
            pro: 'व्यस्त रिटेल दुकान',
            business: 'थोक और कई दुकानें',
        },
        foot: 'आपका डेटा आपका है। किसी भी प्लान पर — मुफ़्त वाले पर भी — कभी भी एक्सपोर्ट करें।',
        monthly: 'मासिक',
        yearly: 'सालाना',
        save: '20% बचाएँ',
        billedYearly: (a) => `सालाना ${a} का बिल`,
    },
    faq: {
        eyebrow: 'सवाल-जवाब',
        title: 'दुकानदार हमसे यह पूछते हैं',
        cats: ['सभी सवाल', 'हार्डवेयर और ऑफ़लाइन', 'टैक्स और स्टाफ़ एक्सेस', 'डेटा और शुरुआत'],
        proof: {
            devices: 'Android फ़ोन और टैबलेट · लैपटॉप ज़रूरी नहीं',
            export: 'GSTR-रेडी रिपोर्ट · 1-क्लिक Tally export',
            offline: 'बिना सिग्नल खुलता है · ऑफ़लाइन बिलिंग जल्द',
        },
        qa: [
            [
                'क्या कंप्यूटर चाहिए?',
                'नहीं। कोई भी Android फ़ोन काफ़ी है। Whoply ब्राउज़र से इंस्टॉल होता है — न Play Store, न लैपटॉप।',
            ],
            [
                'क्या सच में हिंदी में है?',
                'हाँ — पूरा ऐप, सिर्फ़ मेन्यू नहीं। सेटिंग्स से कभी भी हिंदी, ગુજરાતી और English के बीच बदलें।',
            ],
            [
                'क्या मेरे CA को वह मिलेगा जो चाहिए?',
                'हाँ। GSTR-तैयार रिपोर्ट और Tally एक्सपोर्ट, ताकि वे अपने तरीके से ही काम करते रहें।',
            ],
            [
                'क्या मेरा स्टाफ़ मुनाफ़ा देख सकता है?',
                'सिर्फ़ तब जब आप इजाज़त दें। कैशियर को बिलिंग और आज की बिक्री दिखती है — मार्जिन, खर्च या रिपोर्ट नहीं।',
            ],
            ['क्या पुरानी प्रोडक्ट लिस्ट लाई जा सकती है?', 'हाँ, इम्पोर्ट कर लें। दोबारा टाइप करने की ज़रूरत नहीं।'],
            [
                'अगर मैंने पैसे देना बंद कर दिया तो?',
                'आपका डेटा आपका ही रहता है और आप उसे एक्सपोर्ट कर सकते हैं। अपने ही रिकॉर्ड से बाहर कभी नहीं होंगे।',
            ],
            [
                'क्या बिना इंटरनेट चलता है?',
                'ऐप बिना सिग्नल के खुल जाता है, लेकिन बिलिंग के लिए फ़िलहाल कनेक्शन चाहिए। ऑफ़लाइन बिलिंग जल्द आ रही है।',
            ],
            ['सेटअप में कितना समय लगता है?', 'ज़्यादातर दुकानें साइन अप वाली शाम को ही बिलिंग शुरू कर देती हैं।'],
        ],
    },
    finalCta: {
        eyebrow: 'वही भरोसेमंद दुकान। अब और स्मार्ट।',
        title: 'अब दुकान कागज़ पर नहीं।',
        sub: 'शुरुआत मुफ़्त। न कार्ड, न कंप्यूटर, न ट्रेनिंग।',
        button: 'आज ही मुफ़्त शुरू करें',
        foot: '30 सेकंड में सेटअप · कभी भी बंद करें',
    },
    contact: {
        whatsapp: 'WhatsApp पर बात करें',
        whatsappMsg: 'नमस्ते Whoply, मुझे अपने व्यापार के लिए ऐप के बारे में जानना है।',
    },
    footer: {
        tagline: 'बिलिंग, स्टॉक, उधार और ऑर्डर — भारत की दुकानों और थोक विक्रेताओं के लिए।',
        columns: [
            {
                head: 'प्रोडक्ट',
                links: [
                    ['फ़ीचर', '#shopkeepers'],
                    ['कीमत', '#pricing'],
                    ['ऐप इंस्टॉल करें', '#install'],
                ],
            },
            {
                head: 'व्यवसाय',
                links: [
                    ['दुकानदारों के लिए', '#shopkeepers'],
                    ['थोक विक्रेताओं के लिए', '#wholesalers'],
                    ['GST और कम्प्लायंस', '#compliance'],
                    ['सवाल-जवाब', '#faq'],
                ],
            },
            {
                head: 'कंपनी',
                links: [
                    ['हमारे बारे में', '#'],
                    ['संपर्क', '#'],
                    ['प्राइवेसी पॉलिसी', '#'],
                    ['नियम और शर्तें', '#'],
                ],
            },
        ],
        legal: '© 2026 Whoply. भारत में बना, भारत के व्यापार के लिए।',
    },
};

const gu: LandingCopy = {
    meta: {
        title: 'Whoply — દુકાનદારો અને જથ્થાબંધ વેપારીઓ માટે GST બિલિંગ, સ્ટોક અને ઉધાર એપ',
        description:
            'GST બિલિંગ, સ્ટોક, ઉધાર અને ઓર્ડર — બધું એક જ એપમાં. E-invoice, e-way bill અને Tally export સામેલ. આખી એપ ગુજરાતીમાં. મફત શરૂ કરો.',
        ogTitle: 'આખો ધંધો એક જ એપથી ચલાવો — Whoply',
        ogDescription:
            'ભારતના દુકાનદારો અને જથ્થાબંધ વેપારીઓ માટે GST બિલિંગ, સ્ટોક, ઉધાર, ડીલર અને ડિસ્પેચ. E-invoice અને e-way bill તૈયાર. મફત શરૂઆત.',
    },
    nav: {
        announcement: 'E-invoice, e-way bill અને Tally export — પહેલેથી જ સામેલ, પછીથી ઉમેરેલા નહીં.',
        links: [
            { href: '#compliance', label: 'GST અને કમ્પ્લાયન્સ' },
            { href: '#shopkeepers', label: 'દુકાનદારો માટે' },
            { href: '#wholesalers', label: 'જથ્થાબંધ વેપારીઓ માટે' },
            { href: '#pricing', label: 'કિંમત' },
            { href: '#faq', label: 'પ્રશ્નો' },
        ],
        login: 'લોગિન',
        start: 'મફત શરૂ કરો',
        switchLabel: 'ભાષા',
        switchCta: 'ભાષા',
        openMenu: 'મેનુ ખોલો',
        closeMenu: 'મેનુ બંધ કરો',
        home: 'Whoply હોમ',
        primaryNav: 'મુખ્ય',
        mobileNav: 'મોબાઇલ',
    },
    hero: {
        switchLabel: 'તમારો ધંધો પસંદ કરો',
        retail: {
            tab: 'મારી દુકાન છે',
            eyebrow: 'ભારતની દુકાનો માટે',
            h1: 'તમારી આખી દુકાન,',
            h1Accent: 'તમારા ખિસ્સામાં.',
            sub: 'GST બિલિંગ, સ્ટોક અને ઉધાર — એક જ એપમાં. સેકન્ડોમાં બિલ બનાવો, આજનો નફો આજે જ જાણો, અને ભૂલાઈ ગયેલા ઉધારનું નુકસાન અટકાવો.',
            trust: ['GST અને e-invoice તૈયાર', 'આખી એપ ગુજરાતીમાં', 'એપની જેમ ઇન્સ્ટોલ'],
        },
        wholesale: {
            tab: 'હું જથ્થાબંધ વેપારી છું',
            eyebrow: 'ભારતના વિતરકો માટે',
            h1: 'દરેક ઓર્ડર, દરેક ડિસ્પેચ,',
            h1Accent: 'દરેક બાકી રૂપિયો.',
            sub: 'ડીલર પ્રમાણે ભાવ, જથ્થાબંધ ઓર્ડર, e-way bill અને ડિલિવરી ટ્રેકિંગ. જાણો શું મોકલાયું, શું પહોંચ્યું, અને કોના પર કેટલું બાકી છે.',
            trust: ['E-way bill અને e-invoice', 'Tally માં એક્સપોર્ટ', 'આખી એપ ગુજરાતીમાં'],
        },
        ctaPrimary: 'મફત શરૂ કરો — કાર્ડની જરૂર નથી',
        ctaSecondary: 'ડેમો જુઓ',
        mock: {
            today: 'આજે',
            live: 'લાઇવ',
            retailTiles: [
                ['આજનું વેચાણ', '₹10,380'],
                ['બિલ', '18'],
                ['નફો (અંદાજ)', '₹11,696'],
                ['બાકી ઉધાર', '₹49,299'],
            ],
            wholesaleTiles: [
                ['આજના ઓર્ડર', '34'],
                ['ડિસ્પેચ બાકી', '11'],
                ['કુલ બાકી', '₹4,86,200'],
                ['વસૂલાત', '₹1,12,400'],
            ],
            rows: [
                ['Parle-G 200g', '3 દિવસ બાકી'],
                ['Colgate 100g', '9 દિવસ બાકી'],
                ['Tata Salt 1kg', '31 દિવસ બાકી'],
            ],
            retailAction: 'નવું GST બિલ',
            wholesaleAction: 'નવો જથ્થાબંધ ઓર્ડર',
            retailBusiness: 'શર્મા જનરલ સ્ટોર',
            wholesaleBusiness: 'ગુપ્તા ડિસ્ટ્રિબ્યુટર્સ',
            alert: 'સ્ટોક ઓછો',
            reminder: 'રિમાઇન્ડર મોકલ્યું',
            bill: {
                total: 'કુલ',
                sent: 'બિલ WhatsApp પર મોકલ્યું',
                retailItems: [
                    ['Parle-G 200g', '×4', 100],
                    ['Tata Salt 1kg', '×2', 56],
                    ['Amul Butter 100g', '×1', 58],
                ],
                wholesaleItems: [
                    ['Parle-G 200g', '×20 પેટી', 14400],
                    ['Tata Salt 1kg', '×10 ગુણ', 6720],
                    ['Colgate 100g', '×6 પેટી', 8640],
                ],
            },
        },
    },
    marquee: {
        label: 'Whoply માં શું શું છે',
        items: [
            'GST અને E-Invoice તૈયાર',
            'E-Way Bill સામેલ',
            'Tally માં એક્સપોર્ટ',
            'ગુજરાતી + हिंदी + English',
            'કોઈ પણ ફોન — કમ્પ્યુટરની જરૂર નથી',
            'બેચ અને એક્સપાયરી ટ્રેકિંગ',
            'ડીલર પ્રમાણે ભાવ યાદી',
        ],
    },
    problem: {
        eyebrow: 'કાગળની કિંમત',
        title: 'કાગળ ભૂલી જાય છે. Whoply નહીં.',
        cards: [
            {
                title: 'એ ઉધાર જે તમે ભૂલી ગયા',
                body: 'ડાયરીમાં લખેલું એક નામ, છ મહિના જૂનું. Whoply દરેક ગ્રાહકનું ખાતું જૂના બાકી સાથે રાખે છે, અને રોજ સવારે વસૂલાતની યાદી આપે છે.',
            },
            {
                title: 'એ સ્ટોક જે એક્સપાયર થઈ ગયો',
                body: 'પાછળ પડેલા ખોખાં, તારીખ વીતી ગઈ, સીધું નુકસાન. Whoply બેચ ટ્રેક કરે છે અને એક્સપાયરી પહેલાં ચેતવે છે.',
            },
            {
                title: 'એ બિલ જે ખોટું બન્યું',
                body: 'ખોટો GST દર, ખોટો સરવાળો, કાઉન્ટર પર દલીલ. Whoply દર વખતે સાચી ગણતરી કરે છે અને સાચું છાપે છે.',
            },
            {
                title: 'એ નફો જેનો તમે અંદાજ લગાવો છો',
                body: 'આજનું વેચાણ તમને ખબર છે. આજનો નફો નહીં. Whoply ને ખબર છે — શટર પાડતાં પહેલાં.',
            },
        ],
        compare: {
            paper: 'કાગળનું રજિસ્ટર',
            paperSub: 'જેના પર મોટાભાગના કાઉન્ટર હજુ ચાલે છે',
            app: 'Whoply ડિજિટલ ખાતું',
            appSub: 'એ જ દુકાન, તમારા ફોન પર',
            vs: 'સામે',
            rows: [
                {
                    topic: 'ઉધાર',
                    paper: 'ડાયરીમાં છ મહિના જૂનું એક નામ. કોઈ યાદ નથી કરાવતું.',
                    paperTag: 'ભૂલાયેલું',
                    app: 'દરેક ગ્રાહકનું ખાતું, જૂના બાકી સાથે. સવારે 10 વાગ્યે WhatsApp પર રિમાઇન્ડર.',
                    appTag: 'આપોઆપ રિમાઇન્ડર',
                },
                {
                    topic: 'એક્સપાયરી',
                    paper: 'પાછળ પડેલાં ખોખાં, તારીખ વીતી ગઈ — સીધું નુકસાન.',
                    paperTag: 'એક્સપાયર',
                    app: 'બેચ પ્રમાણે ટ્રેકિંગ, તારીખ પહેલાં ચેતવણી.',
                    appTag: '7 દિવસ પહેલાં એલર્ટ',
                },
                {
                    topic: 'બિલિંગ',
                    paper: 'ખોટો GST દર, ખોટો ટોટલ, કાઉન્ટર પર રકઝક.',
                    paperTag: 'વિવાદ',
                    app: 'GSTની સાચી ગણતરી, દર વખતે સાચી પ્રિન્ટ.',
                    appTag: 'GST સાચો',
                },
                {
                    topic: 'નફો',
                    paper: 'આજનું વેચાણ ખબર છે, નફો મહિનાના અંત સુધી અંદાજ.',
                    paperTag: 'અંદાજ',
                    app: 'શટર પાડતાં પહેલાં સાચો નફો.',
                    appTag: 'આજે રાત્રે જ',
                },
            ],
            live: ['+ ₹500 વસૂલ', 'એલર્ટ મોકલ્યું · 7 દિવસ બાકી', 'બિલ WhatsApp પર મોકલ્યું', 'આજનો નફો ₹6,420'],
            liveLabel: 'લાઇવ',
            autoSent: 'WhatsApp આપોઆપ મોકલ્યું',
            flow: 'હવે એ જ દુકાન, Whoply પર',
            paperNote: 'મળ્યા??',
        },
    },
    compliance: {
        eyebrow: 'કમ્પ્લાયન્સ',
        title: 'ભારતીય GST માટે બનેલું — ઉપરથી ચોંટાડેલું નહીં',
        sub: 'કમ્પ્લાયન્સનું જે કામ તમારી સાંજ ખાઈ જાય છે, તે એ જ સ્ક્રીન પર થઈ જાય છે જ્યાંથી તમે બિલ બનાવો છો.',
        cards: [
            {
                title: 'E-Invoice (IRN)',
                body: 'કોઈ પણ બિલ કે જથ્થાબંધ ઓર્ડરનું IRN, સીધું ઇનવોઇસ સ્ક્રીનથી બનાવો.',
            },
            {
                title: 'E-Way Bill',
                body: 'માલ ગોદામથી નીકળે કે તરત બનાવો — અલગ પોર્ટલ નહીં, ફરી ટાઇપ નહીં.',
            },
            {
                title: 'GSTR-તૈયાર રિપોર્ટ',
                body: 'વેચાણ, ખરીદી અને ટેક્સનો હિસાબ — બરાબર એ રીતે જે તમારા રિટર્નને જોઈએ.',
            },
            {
                title: 'Tally એક્સપોર્ટ',
                body: 'તમારા CA પાસે Tally રહે. તમારી પાસે ફોન. એક એક્સપોર્ટથી બંને ખુશ.',
            },
        ],
        quote: '“તમારા CA ને એમની ફાઇલ મળી જાય છે. તમારે લેપટોપ ખોલવું જ પડતું નથી.”',
        pipe: {
            irn: 'IRN બની ગયું',
            cleared: 'આપોઆપ ક્લિયર',
            vehicle: 'વાહન',
            taxable: 'કરપાત્ર રકમ',
            exportBtn: '1-ક્લિક Tally export',
            exporting: 'મોકલાય છે…',
            sent: 'CAને મોકલ્યું',
        },
    },
    shopkeepers: {
        eyebrow: 'દુકાનદારો માટે',
        title: 'રિટેલ, એકદમ સહેલું',
        sub: 'ગ્રાહક અંદર આવે ત્યાંથી લઈને રાત્રે રોકડ ગણો ત્યાં સુધી — બધું જ.',
        bullets: [
            'સેકન્ડોમાં GST બિલ — રોકડ, UPI, કાર્ડ, કે એક જ બિલમાં ત્રણેયનું વિભાજન.',
            'એક્સપાયર સ્ટોક હવે બગડે નહીં — બેચ પ્રમાણે એક્સપાયરી ટ્રેકિંગ, તારીખ પહેલાં ચેતવણી.',
            'દરેક રૂપિયાનું ઉધાર, જૂનું પહેલાં — રોજ સવારે 10 વાગ્યે વસૂલાતની યાદી તૈયાર.',
            'ખલાસ થાય એ પહેલાં ઓર્ડર કરો — કયો માલ કેટલી ઝડપે વેચાય છે એના પરથી જથ્થો નક્કી.',
            'આજનો નફો આજે જાણો — એક ટેપમાં day-close, મહિનાના અંતની રાહ નહીં.',
            'આજે ભાવપત્રક, કાલે બિલ — એક ટેપમાં કોટેશનમાંથી ઇનવોઇસ.',
            'રિટર્નનો સાચો હિસાબ — ક્રેડિટ નોટ, તૂટફૂટ અને બગાડ સીધા નફા સામે.',
            'સપ્લાયર અને ખરીદી — PO, માલની પહોંચ, અને તમારે કેટલું ચૂકવવાનું બાકી છે.',
        ],
        cta: 'મફત શરૂ કરો — 30 સેકન્ડમાં સેટઅપ',
        stats: [
            ['બિલનો સમય', '10 સેકન્ડથી ઓછો'],
            ['એક્સપાયરી ચેતવણી', 'બેચ પ્રમાણે'],
            ['ઉધાર', 'જૂનું પહેલાં'],
            ['Day close', 'એક ટેપ'],
        ],
        kit: {
            label: 'તમારા કાઉન્ટર સાથે ચાલે છે',
            hint: 'કોઈ પણ બિંદુ પર ટેપ કરો અને જુઓ Whoply તેની સાથે કેવી રીતે કામ કરે છે.',
            items: [
                { title: 'ટેબ્લેટ કે ફોન', body: 'કાઉન્ટર પર જે સ્ક્રીન હોય તેના પર જ બિલ — રોકડ, UPI, કાર્ડ, કે ત્રણેયનું વિભાજન.' },
                { title: 'થર્મલ પ્રિન્ટર', body: '58mm કે 80mm રોલ પર GST બિલ પ્રિન્ટ — અથવા પૂરું A4 ઇનવોઇસ.' },
                { title: 'બારકોડ સ્કેનર', body: 'USB સ્કેનર લગાવો, કે ફોનના કેમેરાથી સ્કેન કરો. Pro પ્લાનમાં.' },
                { title: 'UPI QR', body: 'બિલની રકમ ભરેલો તમારો UPI QR દેખાય છે. ગ્રાહક બસ સ્કેન કરીને ચૂકવે.' },
            ],
        },
        groups: [
            { title: 'GST બિલિંગ', body: 'GST સાથે સેકન્ડોમાં બિલ, ક્વોટેશનથી ઇન્વૉઇસ, અને રિટર્નનો સાચો હિસાબ.' },
            { title: 'સ્ટોક અને એક્સપાયરી એલર્ટ', body: 'બેચ પ્રમાણે એક્સપાયરી ચેતવણી, અને સાચા વેચાણ પરથી નક્કી થતો રીઓર્ડર જથ્થો.' },
            { title: 'ઉધાર અને વસૂલાત', body: 'દરેક રૂપિયાનું ઉધાર જૂના બાકી સાથે, WhatsApp રિમાઇન્ડર, અને એક ટૅપમાં આજનો નફો.' },
            { title: 'સપ્લાયર અને ખરીદી', body: 'ખરીદ ઓર્ડર, માલની રસીદ, અને દરેક સપ્લાયરનું કેટલું બાકી છે.' },
        ],
        metrics: {
            avg: 'સરેરાશ 8 સેકન્ડ',
            batch: (n, e) => `બેચ #${n} • એક્સપાયરી ${e}`,
            due: (a) => `${a} બાકી`,
            reminded: 'આપોઆપ રિમાઇન્ડર',
            send: 'ડે-ક્લોઝ સારાંશ મોકલો',
            sent: 'સારાંશ મોકલાયો',
        },
        mock: {
            tabsLabel: 'રિટેલ ફીચર',
            pay: ['રોકડ', 'UPI', 'કાર્ડ'],
            batch: 'બેચ',
            expiresIn: (d) => `${d} દિવસમાં એક્સપાયર`,
            days: (d) => `${d} દિવસ`,
            quote: 'ક્વોટેશન',
            invoice: 'ઇન્વૉઇસ',
            convert: 'ઇન્વૉઇસ બની ગયું',
            creditNote: 'ક્રેડિટ નોટ',
            returned: 'પરત',
            damaged: 'તૂટફૂટ',
            po: 'ખરીદ ઓર્ડર',
            received: 'મળી ગયું',
            pending: 'બાકી',
            youOwe: 'સપ્લાયરોનું બાકી',
        },
    },
    wholesalers: {
        eyebrow: 'જથ્થાબંધ વેપારીઓ માટે',
        title: 'વિતરણ, પૂરા કાબૂમાં',
        sub: 'WhatsApp પર ઓર્ડર આવે ત્યાંથી પૈસા ખાતામાં પહોંચે ત્યાં સુધી.',
        bullets: [
            'ડીલર પ્રમાણે ભાવ — રિટેલર A ₹95, B ₹92, C ₹90. દર વખતે આપોઆપ લાગુ.',
            'જથ્થાબંધ ઓર્ડર, એક પણ છૂટે નહીં — WhatsApp, ફોન કે કાઉન્ટર, બધું એક યાદીમાં.',
            'ડિસ્પેચથી ડિલિવરી સુધી ટ્રેકિંગ — મોકલાયું? પહોંચ્યું? મોડું? ચુકવણી થઈ?',
            'e-way bill અને e-invoice — માલ નીકળે કે તરત ઓર્ડર સ્ક્રીનથી.',
            'ડીલર પ્રમાણે બાકી — આગલા ઓર્ડર પહેલાં ક્રેડિટ લિમિટ લાગુ.',
            'રૂટ પર જ વસૂલાત — તમારો રેપ જગ્યા પર જ ડીલરના નામે ચુકવણી નોંધે.',
            'ટીમ ક્યાં ગઈ એની ખબર રહે — વિઝિટ નોંધાય, ઓર્ડર લેવાયા, કમિશનની ગણતરી.',
            'ગોદામ જે હકીકત સાથે મળે — સ્ટોક, પિક, પેક, અને શેલ્ફ પર શું છે.',
        ],
        cta: 'મફત શરૂ કરો — 30 સેકન્ડમાં સેટઅપ',
        timelineLabel: 'ડિસ્પેચ ટાઇમલાઇન',
        timeline: [
            ['ઓર્ડર મળ્યો', 'Gupta Distributors · ₹84,200'],
            ['પેક થયો', 'ગોદામ A · 12 ખોખાં'],
            ['ડિસ્પેચ', 'E-way bill બન્યું'],
            ['ડિલિવર', 'પુષ્ટિ બાકી'],
            ['ચુકવણી', '₹84,200 બાકી'],
        ],
        mock: {
            tabsLabel: 'વિતરણ ફીચર',
            tier: 'રિટેલર',
            auto: 'આપોઆપ લાગુ',
            newOrders: 'નવા ઓર્ડર',
            phone: 'ફોન',
            counter: 'કાઉન્ટર',
            generated: 'બની ગયું',
            limit: 'લિમિટ',
            onHold: 'લિમિટ પાર — આગલો ઓર્ડર અટક્યો',
            collected: 'રૂટ પર વસૂલાત',
            visits: 'વિઝિટ',
            orders: 'ઓર્ડર',
            commission: 'કમિશન',
            pick: 'પિક',
            pack: 'પેક',
            onShelf: 'શેલ્ફ પર',
        },
        stages: [
            {
                title: 'ડીલર પ્રાઇસ ટિયર',
                sub: 'રિટેલરના પ્રકાર પ્રમાણે ભાવ',
                body: 'દરેક ડીલર એક ટિયરમાં છે. ડીલર પસંદ કરો, સાચો ભાવ ઓર્ડર પર આપોઆપ લાગે છે — ન રેટ કાર્ડ, ન ભૂલ.',
            },
            {
                title: 'જથ્થાબંધ ઓર્ડર અને ડિસ્પેચ',
                sub: 'પેકિંગ લિસ્ટ અને e-way bill એકસાથે',
                body: 'WhatsApp, ફોન કે કાઉન્ટરના ઓર્ડર એક યાદીમાં. માલ નીકળે કે તરત પેકિંગ લિસ્ટ, e-way bill અને e-invoice તૈયાર.',
            },
            {
                title: 'રૂટ અને વસૂલાત',
                sub: 'ફીલ્ડ એજન્ટનું પૂરું ટ્રેકિંગ',
                body: 'તમારો એજન્ટ દરેક વિઝિટ નોંધે છે અને જગ્યા પર જ ડીલરના નામે ચુકવણી લખે છે. એ પાછો આવે એ પહેલાં વસૂલાત દેખાય છે.',
            },
            {
                title: 'બાકી ક્રેડિટ મેટ્રિક્સ',
                sub: 'ડીલર પ્રમાણે ખાતું અને લિમિટ',
                body: 'ડીલર પ્રમાણે બાકી, અને આગલા ઓર્ડર પહેલાં ક્રેડિટ લિમિટ લાગુ.',
            },
        ],
        pipe: {
            dealer: 'ડીલર',
            applied: (tier, price) => `${tier}: ${price} આપોઆપ લાગુ`,
            order: 'ઓર્ડર',
            ewb: 'e-way bill બન્યું',
            driver: 'ડ્રાઇવર નક્કી',
            out: 'ડિલિવરી માટે નીકળ્યો',
            agent: (n) => `એજન્ટ ${n}`,
            visited: (n) => `${n} દુકાનોની વિઝિટ`,
            collected: (a) => `આજે ${a} વસૂલ`,
            outstanding: 'બાકી',
            available: 'ઉપલબ્ધ',
            ok: 'લિમિટમાં',
            hold: 'અટકેલું',
        },
    },
    features: {
        eyebrow: 'બધું સામેલ',
        title: 'એક એપ, ડઝન ચોપડાની જગ્યાએ',
        cards: [
            {
                title: 'GST બિલિંગ (POS)',
                body: 'ઝડપી અને સાચાં GST બિલ. કાર્ટ રોકો, ફરી શરૂ કરો, ચુકવણી વહેંચો.',
            },
            {
                title: 'સ્માર્ટ સ્ટોક',
                body: 'ઓછો સ્ટોક, એક્સપાયરી, ઝડપી અને ધીમો વેચાતો માલ — નુકસાન પહેલાં ખબર પડે.',
            },
            {
                title: 'ઉધાર અને ક્રેડિટ',
                body: 'દરેક ગ્રાહકનું ખાતું, જૂના બાકી સાથે, અને રોજની વસૂલાત યાદી.',
            },
            {
                title: 'ઓર્ડર અને ડિસ્પેચ',
                body: 'જથ્થાબંધ ઓર્ડર, ગોદામ, ડિસ્પેચ અને ડિલિવરી — એક જ ટાઇમલાઇનમાં.',
            },
            {
                title: 'નિર્ણય લેવડાવતી રિપોર્ટ',
                body: 'આજનું વેચાણ, સાચો નફો, સૌથી સારો અને સૌથી ખરાબ માલ, ટોચના ગ્રાહકો.',
            },
            {
                title: 'સ્ટાફને ફક્ત પોતાનું કામ દેખાય',
                body: 'માલિક, મેનેજર, કેશિયર, ગોદામ, સેલ્સ સ્ટાફ — અલગ લોગિન, અલગ નજર.',
            },
        ],
        ui: {
            remind: 'યાદ કરાવો',
            sent: 'મોકલ્યું',
            remindAll: 'બધાને WhatsApp પર યાદ કરાવો',
            allSent: 'બધા રિમાઇન્ડર મોકલાયા',
            roles: ['માલિક', 'મેનેજર', 'કેશિયર', 'ગોદામ', 'સેલ્સ'],
            perms: ['બિલિંગ', 'સ્ટોક', 'રિપોર્ટ', 'નફો'],
            seeAs: 'એપ આ રીતે જુઓ',
            chartHint: 'કોઈ બાર પર ટૅપ કરો',
            sales: 'વેચાણ',
        },
    },
    reorder: {
        eyebrow: 'રીઓર્ડર એન્જિન',
        title: 'ખલાસ થાય એ પહેલાં ઓર્ડર કરો',
        body: 'Whoply જુએ છે કે કયો માલ ખરેખર કેટલી ઝડપે વેચાય છે, પછી કહે છે કે શું મંગાવવું, કેટલું મંગાવવું, અને કેટલા દિવસ બાકી છે. કોઈ છુપો જાદુ નહીં — ગણતરી તમારી સામે છે.',
        foot: 'તમારા જ છેલ્લા 30 દિવસના વેચાણ પર આધારિત. કશું અંદાજથી નહીં.',
        rows: [
            ['Parle-G 200g', 'બાકી દિવસ: 3', '24 મંગાવો'],
            ['Colgate 100g', 'બાકી દિવસ: 9', '12 મંગાવો'],
            ['Tata Salt 1kg', 'બાકી દિવસ: 31', 'બરાબર છે'],
        ],
    },
    staff: {
        title: 'કેશિયર બિલ બનાવે. કેશિયરને નફો કદી ન દેખાય.',
        body: 'દરેક વ્યક્તિનું પોતાનું લોગિન, અને એને ફક્ત પોતાનું કામ દેખાય. કેશિયરને બિલિંગ અને આજનું વેચાણ. ગોદામને સ્ટોક અને ડિસ્પેચ. સેલ્સ સ્ટાફને પોતાના ડીલર અને રૂટ. તમારું માર્જિન, ખર્ચ અને રિપોર્ટ ફક્ત તમારાં.',
        note: 'એક લોગિન પાંચ ફોન પર નહીં ચાલે — દરેક રોલ પર ડિવાઇસ લિમિટ લાગુ છે.',
    },
    automation: {
        title: 'ત્રણ કામ જે Whoply તમે ઊંઘો ત્યારે કરે છે',
        items: [
            {
                when: 'દરરોજ રાત્રે, 9 વાગ્યે',
                what: 'દિવસનો હિસાબ — વેચાણ, નફો, બાકી, ઓછો સ્ટોક — તમારા ફોન પર તૈયાર.',
            },
            {
                when: 'દરરોજ સવારે, 10 વાગ્યે',
                what: 'આજની ઉધાર યાદી: કોના પર કેટલું, જૂનું પહેલાં, મોકલવા તૈયાર.',
            },
            {
                when: 'દર સોમવારે, 9 વાગ્યે',
                what: 'આ અઠવાડિયે સપ્લાયરને શું ચૂકવવાનું છે — એમનો ફોન આવે એ પહેલાં.',
            },
        ],
    },
    tour: {
        eyebrow: 'ડેશબોર્ડ',
        title: 'આખો વેપાર, એક જ સ્ક્રીન પર',
        sub: 'જેના માટે ચોપડા ફેરવવા પડતા — તે બધું એક જગ્યાએ, દરરોજ સવારે.',
        hint: 'કોઈ બિંદુ પર ટેપ કરો, કે યાદીમાંથી પસંદ કરો',
        items: [
            { title: 'આજનું વેચાણ, એ જ ક્ષણે', cap: 'દરેક બિલ બનતાં જ અહીં દેખાય છે, સાથે આખા અઠવાડિયાનો ટ્રેન્ડ.' },
            { title: 'ખરેખર શું વેચાય છે', cap: 'જથ્થા અને કિંમત પ્રમાણે સૌથી વધુ વેચાતો માલ — જે ચાલે છે, તે વધુ રાખો.' },
            { title: 'દરેક ઓર્ડર, અને તે ક્યાં છે', cap: 'ડિલિવર, પ્રોસેસિંગ કે પેન્ડિંગ — જાણવા માટે ફોન નહીં કરવો પડે.' },
            { title: 'સ્ટોક ખલાસ થાય તે પહેલાં', cap: 'જે માલ ખલાસ થવાનો છે, તે બરાબર કેટલો બચ્યો છે તેની સાથે દેખાય છે.' },
            { title: 'પૈસા ક્યાં ગયા', cap: 'ભાડું, ખરીદી અને બિલ અલગ-અલગ — જેથી જે નફો દેખાય, તે સાચો હોય.' },
        ],
    },
    how: {
        eyebrow: 'શરૂઆત',
        title: 'આજે સાંજ સુધીમાં ચાલુ',
        steps: [
            ['મોબાઇલથી સાઇન અપ', 'એક OTP, ત્રીસ સેકન્ડ, ન કાગળિયાં, ન કાર્ડ.'],
            ['તમારો માલ ઉમેરો', 'ટાઇપ કરો કે પહેલેથી બનેલી યાદી ઇમ્પોર્ટ કરો.'],
            ['બિલિંગ શરૂ', 'પહેલા જ વેચાણથી પૂરાં GST બિલ.'],
        ],
    },
    install: {
        eyebrow: 'ઇન્સ્ટોલ',
        title: 'ન Play Store. ન કમ્પ્યુટર. ન તાલીમ.',
        sub: 'Whoply સીધું બ્રાઉઝરથી તમારી હોમ સ્ક્રીન પર ઇન્સ્ટોલ થાય છે અને કોઈ પણ એપની જેમ ખૂલે છે. જે ફોન તમારી પાસે છે એના પર જ ચાલે છે — અને મોટી સ્ક્રીન જોઈએ તો કાઉન્ટર પર ટેબ્લેટ પર પણ.',
        chips: ['એક ટેપમાં ઇન્સ્ટોલ', 'કોઈ પણ Android ફોન પર', 'દરેક ડિવાઇસ પર એ જ લોગિન'],
    },
    pricing: {
        eyebrow: 'કિંમત',
        title: 'સીધી, પ્રામાણિક કિંમત',
        sub: 'મફત શરૂ કરો. ધંધો વધે તો આગળ વધો.',
        anchor: 'એક ભૂલાઈ ગયેલું ઉધાર, Pro ના આખા વર્ષ કરતાં મોંઘું પડે છે.',
        per: 'મહિનો',
        popular: 'દુકાનોની પહેલી પસંદ',
        startFree: 'મફત શરૂ કરો',
        choose: (name) => `${name} પસંદ કરો`,
        planFor: {
            free: 'એક દુકાન, શરૂઆત માટે',
            pro: 'વ્યસ્ત રિટેલ દુકાન',
            business: 'જથ્થાબંધ અને અનેક દુકાનો',
        },
        foot: 'તમારો ડેટા તમારો છે. કોઈ પણ પ્લાન પર — મફત વાળા પર પણ — ગમે ત્યારે એક્સપોર્ટ કરો.',
        monthly: 'માસિક',
        yearly: 'વાર્ષિક',
        save: '20% બચાવો',
        billedYearly: (a) => `વાર્ષિક ${a}નું બિલ`,
    },
    faq: {
        eyebrow: 'પ્રશ્નો',
        title: 'દુકાનદારો અમને આ પૂછે છે',
        cats: ['બધા પ્રશ્નો', 'હાર્ડવેર અને ઑફલાઇન', 'ટેક્સ અને સ્ટાફ ઍક્સેસ', 'ડેટા અને શરૂઆત'],
        proof: {
            devices: 'Android ફોન અને ટેબ્લેટ · લેપટોપ જરૂરી નથી',
            export: 'GSTR-રેડી રિપોર્ટ · 1-ક્લિક Tally export',
            offline: 'સિગ્નલ વગર ખૂલે છે · ઑફલાઇન બિલિંગ ટૂંક સમયમાં',
        },
        qa: [
            [
                'શું કમ્પ્યુટર જોઈએ?',
                'ના. કોઈ પણ Android ફોન પૂરતો છે. Whoply બ્રાઉઝરથી ઇન્સ્ટોલ થાય છે — ન Play Store, ન લેપટોપ.',
            ],
            [
                'શું ખરેખર ગુજરાતીમાં છે?',
                'હા — આખી એપ, ફક્ત મેનુ નહીં. સેટિંગ્સમાંથી ગમે ત્યારે ગુજરાતી, हिंदी અને English વચ્ચે બદલો.',
            ],
            [
                'મારા CA ને જે જોઈએ તે મળશે?',
                'હા. GSTR-તૈયાર રિપોર્ટ અને Tally એક્સપોર્ટ, જેથી તેઓ પોતાની રીતે જ કામ કરતા રહે.',
            ],
            [
                'શું મારો સ્ટાફ નફો જોઈ શકે?',
                'ફક્ત તમે પરવાનગી આપો તો. કેશિયરને બિલિંગ અને આજનું વેચાણ દેખાય છે — માર્જિન, ખર્ચ કે રિપોર્ટ નહીં.',
            ],
            ['જૂની પ્રોડક્ટ યાદી લાવી શકાય?', 'હા, ઇમ્પોર્ટ કરી લો. ફરીથી ટાઇપ કરવાની જરૂર નથી.'],
            [
                'જો હું પૈસા ભરવાનું બંધ કરું તો?',
                'તમારો ડેટા તમારો જ રહે છે અને તમે એને એક્સપોર્ટ કરી શકો છો. તમારા પોતાના રેકોર્ડથી કદી બહાર નહીં થાઓ.',
            ],
            [
                'શું ઇન્ટરનેટ વગર ચાલે છે?',
                'એપ સિગ્નલ વગર ખૂલી જાય છે, પણ બિલિંગ માટે હાલ કનેક્શન જોઈએ. ઓફલાઇન બિલિંગ ટૂંક સમયમાં આવી રહ્યું છે.',
            ],
            ['સેટઅપમાં કેટલો સમય લાગે?', 'મોટા ભાગની દુકાનો સાઇન અપ કરેલી સાંજે જ બિલિંગ શરૂ કરી દે છે.'],
        ],
    },
    finalCta: {
        eyebrow: 'એ જ ભરોસાપાત્ર દુકાન. હવે વધુ સ્માર્ટ.',
        title: 'હવે દુકાન કાગળ પર નહીં.',
        sub: 'શરૂઆત મફત. ન કાર્ડ, ન કમ્પ્યુટર, ન તાલીમ.',
        button: 'આજે જ મફત શરૂ કરો',
        foot: '30 સેકન્ડમાં સેટઅપ · ગમે ત્યારે બંધ કરો',
    },
    contact: {
        whatsapp: 'WhatsApp પર વાત કરો',
        whatsappMsg: 'નમસ્તે Whoply, મારે મારા ધંધા માટે એપ વિશે જાણવું છે.',
    },
    footer: {
        tagline: 'બિલિંગ, સ્ટોક, ઉધાર અને ઓર્ડર — ભારતની દુકાનો અને જથ્થાબંધ વેપારીઓ માટે.',
        columns: [
            {
                head: 'પ્રોડક્ટ',
                links: [
                    ['ફીચર', '#shopkeepers'],
                    ['કિંમત', '#pricing'],
                    ['એપ ઇન્સ્ટોલ કરો', '#install'],
                ],
            },
            {
                head: 'ધંધો',
                links: [
                    ['દુકાનદારો માટે', '#shopkeepers'],
                    ['જથ્થાબંધ વેપારીઓ માટે', '#wholesalers'],
                    ['GST અને કમ્પ્લાયન્સ', '#compliance'],
                    ['પ્રશ્નો', '#faq'],
                ],
            },
            {
                head: 'કંપની',
                links: [
                    ['અમારા વિશે', '#'],
                    ['સંપર્ક', '#'],
                    ['પ્રાઇવસી પોલિસી', '#'],
                    ['નિયમો અને શરતો', '#'],
                ],
            },
        ],
        legal: '© 2026 Whoply. ભારતમાં બનેલું, ભારતના વેપાર માટે.',
    },
};

export const dictionaries: Record<Lang, LandingCopy> = { en, hi, gu };

export const getCopy = (lang: Lang) => dictionaries[lang];
