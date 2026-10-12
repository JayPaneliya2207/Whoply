import type { Role } from './links';

/** What a "Start free" or plan button is asking for. */
export interface LeadAsk {
    plan?: string; // a Plan.key
    billing?: 'monthly' | 'yearly';
    role?: Role;
}

const EVENT = 'whoply:lead';

/** Open the "Start with Whoply" request form (LeadDialog listens for this). */
export function openLead(ask: LeadAsk = {}) {
    window.dispatchEvent(new CustomEvent<LeadAsk>(EVENT, { detail: ask }));
}

/** Subscribe to openLead; returns the unsubscribe. */
export function onLead(handler: (ask: LeadAsk) => void) {
    const listener = (e: Event) => handler((e as CustomEvent<LeadAsk>).detail || {});
    window.addEventListener(EVENT, listener);
    return () => window.removeEventListener(EVENT, listener);
}
