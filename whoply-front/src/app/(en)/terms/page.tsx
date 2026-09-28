import type { Metadata } from 'next';
import { LegalPage, type LegalSection } from '@/components/legal/LegalPage';
import { LEGAL, orPending } from '@/lib/legal';

export const metadata: Metadata = {
    title: 'Terms of Service — Whoply',
    description: 'The terms for using Whoply: your account, plans, your data, GST responsibilities, acceptable use and liability.',
    alternates: { canonical: '/terms' },
};

/* Keep these in step with what the product does — e.g. no automatic payment
   collection exists yet, so the payment terms don't describe one. */
const sections: LegalSection[] = [
    {
        id: 'agreement',
        title: 'Agreeing to these terms',
        body: (
            <>
                <p>
                    These terms are an agreement between you and <b>{orPending(LEGAL.entityName)}</b> (“Whoply”, “we”). By creating an account
                    or using Whoply you accept them, and our <a href="/privacy">Privacy Policy</a>.
                </p>
                <p>Whoply is for businesses. You must be 18 or older and allowed to act for the business you register.</p>
            </>
        ),
    },
    {
        id: 'service',
        title: 'The service',
        body: (
            <>
                <p>
                    Whoply helps shops and wholesalers with GST billing, stock, udhar, quotations, returns, purchases, dealers, orders, dispatch,
                    payments and reports. We keep improving it, so features may change; if we remove something important on a paid plan we will
                    tell you in advance.
                </p>
                <p>The app needs an internet connection to make bills and save changes.</p>
            </>
        ),
    },
    {
        id: 'account',
        title: 'Your account and your staff',
        body: (
            <ul>
                <li>Give correct details and keep them up to date — especially your business name, address and GSTIN, which print on your bills.</li>
                <li>Keep your password and one-time passwords private. You are responsible for what happens under your login.</li>
                <li>You decide who on your team gets a login and what they do with it, and you are responsible for their actions in Whoply.</li>
                <li>Tell us straight away at {orPending(LEGAL.email)} if you think someone has used your account without permission.</li>
            </ul>
        ),
    },
    {
        id: 'plans',
        title: 'Plans and payment',
        body: (
            <ul>
                <li>The Free plan costs nothing. Paid plans and their prices are shown on our pricing page; GST is added where it applies.</li>
                <li>You are only charged after you choose a paid plan, and we will show you the amount and how to pay before you do.</li>
                <li>We may change prices with at least 30 days’ notice; a change applies from your next billing period.</li>
                <li>Fees already paid are not refunded for part of a period, unless the law requires it.</li>
            </ul>
        ),
    },
    {
        id: 'data',
        title: 'Your data',
        body: (
            <>
                <p>
                    Your business data belongs to you. You let us store and process it only to run Whoply for you, as described in the Privacy
                    Policy. You can export your bills, orders and reports at any time, on any plan.
                </p>
                <p>If a paid plan ends, you can still log in and export your data. You are never locked out of your own records.</p>
                <p>
                    When you enter data about other people — customers, dealers, suppliers, staff — you must have the right to do so under the
                    Digital Personal Data Protection Act, 2023 and other laws.
                </p>
            </>
        ),
    },
    {
        id: 'tax',
        title: 'GST and your records',
        body: (
            <>
                <p>Whoply does the maths, but you are responsible for your tax filings. In particular:</p>
                <ul>
                    <li>Bills, GST amounts and reports are only as correct as the prices, GST rates, HSN codes and customer GSTINs you enter. Check them.</li>
                    <li>E-invoice and e-way bill files are prepared for you; you must upload them to the GST portal yourself. Whoply is not a GST Suvidha Provider and does not file returns for you.</li>
                    <li>Review reports before you file, and keep your records for as long as the law requires (72 months for GST).</li>
                    <li>Whoply is not a tax, legal or accounting adviser — ask your CA when in doubt.</li>
                </ul>
            </>
        ),
    },
    {
        id: 'use',
        title: 'Acceptable use',
        body: (
            <>
                <p>Do not use Whoply to:</p>
                <ul>
                    <li>make fake or misleading bills, or anything else that breaks the law;</li>
                    <li>send spam or harass people through the share buttons;</li>
                    <li>store data about people without a right to it;</li>
                    <li>try to break, overload, copy or reverse-engineer the service, or get into accounts that aren’t yours;</li>
                    <li>resell Whoply without our written permission.</li>
                </ul>
            </>
        ),
    },
    {
        id: 'availability',
        title: 'Availability and support',
        body: (
            <p>
                We work to keep Whoply running and your data safe, but we can’t promise it will never be interrupted. Export your records
                regularly as your own backup. Support is available at {orPending(LEGAL.email)}.
            </p>
        ),
    },
    {
        id: 'ending',
        title: 'Suspending or closing an account',
        body: (
            <>
                <p>You can stop using Whoply and ask us to close your account at any time.</p>
                <p>
                    We may suspend or close an account that breaks these terms or the law, or to protect other users. Where we can, we will warn you
                    first and give you time to export your data.
                </p>
            </>
        ),
    },
    {
        id: 'disclaimer',
        title: 'Disclaimer',
        body: <p>Whoply is provided “as is”. To the extent the law allows, we don’t give any promise that it will suit a particular purpose or be free of errors.</p>,
    },
    {
        id: 'liability',
        title: 'Limit of our liability',
        body: (
            <p>
                To the extent the law allows, we are not liable for indirect losses such as lost profit or lost business, and our total liability
                for any claim is limited to the fees you paid us in the 12 months before it. Nothing here limits liability that cannot be limited by law.
            </p>
        ),
    },
    {
        id: 'indemnity',
        title: 'Your responsibility for claims',
        body: <p>If someone makes a claim against us because of how you used Whoply, or because of data you entered without the right to, you will cover our reasonable costs of dealing with it.</p>,
    },
    {
        id: 'changes',
        title: 'Changes to these terms',
        body: <p>If we change these terms in an important way, we will tell you in the app before the change takes effect. Continuing to use Whoply after that means you accept the new terms.</p>,
    },
    {
        id: 'law',
        title: 'Governing law',
        body: <p>These terms are governed by the laws of India. The courts at {orPending(LEGAL.jurisdictionCity)} have jurisdiction.</p>,
    },
    {
        id: 'contact',
        title: 'Contact',
        body: (
            <p>
                {orPending(LEGAL.entityName)}, {orPending(LEGAL.address)}. Email: {orPending(LEGAL.email)}. For privacy complaints, see the grievance
                officer in our <a href="/privacy#contact">Privacy Policy</a>.
            </p>
        ),
    },
];

export default function TermsPage() {
    return (
        <LegalPage
            title="Terms of Service"
            intro={<p>These terms explain what you can expect from Whoply and what we expect from you. We’ve kept them short and in plain words.</p>}
            sections={sections}
        />
    );
}
