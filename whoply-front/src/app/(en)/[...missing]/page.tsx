import { notFound } from 'next/navigation';

/**
 * Every address that no real page answers. The site has three root layouts
 * (en / hi / gu), so there is no single app/not-found — this catch-all sends
 * anything unknown to (en)/not-found.tsx with a real 404 status.
 */
export default function Missing() {
    notFound();
}
