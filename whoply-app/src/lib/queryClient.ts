import { QueryClient } from '@tanstack/react-query';

const make = () => new QueryClient({ defaultOptions: { queries: { retry: 1, refetchOnWindowFocus: false } } });

let browserClient: QueryClient | undefined;

/**
 * The app's one query cache in the browser (a fresh one per server render).
 * Kept here, not inside <Providers>, so logout can wipe it — otherwise the next
 * person to log in on the same phone would briefly see the last shop's data.
 */
export function getQueryClient(): QueryClient {
    if (typeof window === 'undefined') return make();
    return (browserClient ??= make());
}

/** Drop every cached screen (dashboard, bills, customers…). */
export const clearQueryCache = () => { if (browserClient) browserClient.clear(); };
