'use client';

import type { AnchorHTMLAttributes } from 'react';
import { openLead, type LeadAsk } from '@/lib/lead';

/**
 * A "Start free" / "Choose plan" call to action. There is no self sign-up:
 * it opens the request form in a popup, and the Whoply team creates the
 * account. Without JavaScript it is still a link to the Contact section.
 */
export function StartButton({ ask, onClick, children, ...rest }: AnchorHTMLAttributes<HTMLAnchorElement> & { ask?: LeadAsk }) {
    return (
        <a
            href="#contact"
            aria-haspopup="dialog"
            {...rest}
            onClick={(e) => {
                e.preventDefault();
                onClick?.(e);
                openLead(ask);
            }}
        >
            {children}
        </a>
    );
}
