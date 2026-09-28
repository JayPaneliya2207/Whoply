import type { Metadata } from 'next';
import { LegalPage, type LegalSection } from '@/components/legal/LegalPage';
import { LEGAL, orPending } from '@/lib/legal';

export const metadata: Metadata = {
    title: 'Privacy Policy — Whoply',
    description: 'What data Whoply collects, why, who it is shared with, how long it is kept, and your rights under India’s DPDP Act.',
    alternates: { canonical: '/privacy' },
};

/*
 * Every statement here describes what the code actually does (checked against
 * whoply-api models/controllers and whoply-app storage). If the product changes
 * how it handles data, update this page in the same change.
 */
const sections: LegalSection[] = [
    {
        id: 'who',
        title: 'Who we are and what this covers',
        body: (
            <>
                <p>
                    Whoply is operated by <b>{orPending(LEGAL.entityName)}</b>, {orPending(LEGAL.address)} (“Whoply”, “we”). This policy covers
                    the Whoply app (billing, stock, udhar, orders and related tools), this website, and our support.
                </p>
                <p>
                    <b>Your own account and business data:</b> we decide how it is processed, so we are responsible for it (a “data fiduciary”
                    under the Digital Personal Data Protection Act, 2023).
                </p>
                <p>
                    <b>Data about your customers, dealers, suppliers and staff that you enter:</b> you decide why it is collected and we process
                    it only to run Whoply for you. You are responsible for having a lawful reason to record it — see section 9.
                </p>
            </>
        ),
    },
    {
        id: 'collect',
        title: 'What we collect',
        body: (
            <ul>
                <li><b>Account:</b> your name, mobile number, a password if you set one (stored only as a one-way hash), preferred language and role.</li>
                <li><b>Business profile:</b> business name and type, GSTIN, address, city, state, PIN code, contact number, UPI ID, an uploaded UPI QR image, and bank account name, number and IFSC if you add them to receive payments.</li>
                <li><b>Staff you add:</b> name, mobile number, role, salary, and — only if you enter them — an ID document type and number (for example PAN) and photos of that document. For Aadhaar we keep only the last 4 digits and never a copy of the card.</li>
                <li><b>Business records:</b> products, prices and stock; bills, quotations, returns and credit notes; customers with their mobile, GSTIN and udhar balance; dealers, orders, dispatch and payments; suppliers and purchase orders; expenses.</li>
                <li><b>Sign-in and security:</b> for each login, the device name and type, browser, operating system, IP address and login / last-activity times — so we can keep your account secure and spot misuse.</li>
                <li><b>Messages to support:</b> what you send us when you contact us.</li>
            </ul>
        ),
    },
    {
        id: 'use',
        title: 'How we use it',
        body: (
            <ul>
                <li>To run the service: log you in (including sending a one-time password by SMS), calculate GST, keep stock and udhar, and produce bills, reports and GST filing data.</li>
                <li>To show you reminders inside the app, such as the daily summary, the morning udhar list and weekly supplier payables.</li>
                <li>To keep accounts secure and investigate misuse.</li>
                <li>To give support when you ask for it.</li>
                <li>To meet legal obligations.</li>
            </ul>
        ),
    },
    {
        id: 'dont',
        title: 'What we don’t do',
        body: (
            <ul>
                <li>We don’t sell your data or anyone else’s, and we don’t show ads.</li>
                <li>We don’t message your customers or dealers. WhatsApp and SMS buttons open the message on <i>your</i> phone; you choose whether to send it.</li>
                <li>We don’t file anything with the government for you. E-invoice and e-way bill files are prepared for you to upload to the GST portal yourself.</li>
                <li>We don’t use your business records to train AI models. Reorder suggestions are simple calculations on your own sales.</li>
            </ul>
        ),
    },
    {
        id: 'share',
        title: 'Who we share it with',
        body: (
            <>
                <p>Only with:</p>
                <ul>
                    <li><b>Service providers</b> who run parts of Whoply for us — hosting and database, and the SMS provider that delivers login codes — under contracts that limit them to that purpose.</li>
                    <li><b>People you choose</b> — for example the staff you give a login to, or anyone you send a bill or a report to.</li>
                    <li><b>Authorities</b> when the law requires it, such as a valid order from a court or a government agency.</li>
                    <li>A buyer or successor if Whoply’s business is transferred, who must keep to this policy.</li>
                </ul>
            </>
        ),
    },
    {
        id: 'security',
        title: 'Where it is stored and how it is protected',
        body: (
            <>
                <p>Your data is stored on {orPending(LEGAL.dataLocation)}. It is sent over encrypted connections (HTTPS), and passwords are kept only as a one-way hash.</p>
                <p>
                    The app keeps your login on the device in the browser’s storage, so you stay signed in. On a shared phone or computer, log out
                    when you finish (Settings → Log out). Keep your password and OTPs to yourself — we will never ask for them.
                </p>
            </>
        ),
    },
    {
        id: 'retention',
        title: 'How long we keep it',
        body: (
            <>
                <p>We keep your data while your account is open. You can export your bills, orders and reports at any time, on any plan.</p>
                <p>
                    If you close your account we delete or anonymise your data within 90 days, except what we must keep by law. Note that GST law
                    requires <i>you</i> to keep your invoices and accounts for 72 months — export them before you close.
                </p>
                <p>Sign-in records are kept only as long as needed for security.</p>
            </>
        ),
    },
    {
        id: 'rights',
        title: 'Your rights',
        body: (
            <>
                <p>Under the Digital Personal Data Protection Act, 2023 you can ask us to:</p>
                <ul>
                    <li>tell you what personal data we hold about you and how we use it;</li>
                    <li>correct or complete it, or delete it when it is no longer needed;</li>
                    <li>withdraw consent you gave — this may mean we can no longer provide parts of the service;</li>
                    <li>nominate someone to act for you if you die or cannot act yourself.</li>
                </ul>
                <p>
                    Write to {orPending(LEGAL.email)}. You can also complain to our grievance officer (section 13), and if you are not satisfied, to
                    the Data Protection Board of India.
                </p>
            </>
        ),
    },
    {
        id: 'your-people',
        title: 'Your customers’, dealers’ and staff’s data',
        body: (
            <>
                <p>When you enter data about other people, you must have a lawful reason to do so and tell them how you use it. In particular:</p>
                <ul>
                    <li>Record only what you need to run your business.</li>
                    <li>Enter staff ID numbers or upload ID photos only if you really need them, and never ask for more than necessary. Whoply will not store an Aadhaar copy or full Aadhaar number — check the card in person.</li>
                    <li>If someone asks you to correct or delete their data, write to us at {orPending(LEGAL.email)} and we will do it with you.</li>
                </ul>
            </>
        ),
    },
    {
        id: 'children',
        title: 'Children',
        body: <p>Whoply is for businesses. It is not meant for anyone under 18, and we do not knowingly collect data about children.</p>,
    },
    {
        id: 'cookies',
        title: 'Cookies and device storage',
        body: (
            <>
                <p>This website does not use cookies, analytics or ad trackers. Its fonts are served from our own site.</p>
                <p>
                    The app stores a few things in your browser so it works: your login, your language, an unfinished bill, and your chosen
                    invoice design. Nothing is used to track you across other sites.
                </p>
            </>
        ),
    },
    {
        id: 'changes',
        title: 'Changes to this policy',
        body: <p>If we make an important change, we will tell you in the app before it takes effect. The date at the top shows the current version.</p>,
    },
    {
        id: 'contact',
        title: 'Contact and grievance officer',
        body: (
            <>
                <p>
                    Questions or requests: <b>{orPending(LEGAL.email)}</b>
                </p>
                <p>
                    Grievance officer: <b>{orPending(LEGAL.grievanceOfficer.name)}</b>, {orPending(LEGAL.grievanceOfficer.email)}.
                    <br />
                    {orPending(LEGAL.entityName)}, {orPending(LEGAL.address)}.
                </p>
                <p>We aim to acknowledge a complaint within 2 working days and resolve it within 30 days.</p>
            </>
        ),
    },
];

export default function PrivacyPage() {
    return (
        <LegalPage
            title="Privacy Policy"
            intro={
                <p>
                    This policy explains, in plain words, what data Whoply collects, why, who sees it, how long we keep it and what you can ask
                    us to do. In short: your business data is yours, we use it only to run Whoply for you, and we never sell it.
                </p>
            }
            sections={sections}
        />
    );
}
