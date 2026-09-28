import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { round2 } from '@/lib/tax';
import { stepQty } from '@/lib/qty';

/** `price` is per unit after the product's own discount, as entered — GST-inclusive when `inclusive`. */
export interface CartRow { productId: string; name: string; price: number; mrp: number; discountPct: number; gstRate: number; inclusive: boolean; unit: string; qty: number; stock: number; }

/** A cart row's pricing fields from the current product record. */
const pricing = (p: any) => {
    const disc = Number(p.discountPct) || 0;
    return { name: p.name, price: round2(p.sellPrice * (1 - disc / 100)), mrp: p.sellPrice, discountPct: disc, gstRate: p.gstRate || 0, inclusive: p.priceIncludesGst === true, unit: p.unit, stock: p.currentStock };
};

interface PosState {
    cart: CartRow[];
    name: string;
    mobile: string;
    businessId: string | null;
    ensureBusiness: (id: string) => void;
    setName: (v: string) => void;
    setMobile: (v: string) => void;
    add: (p: any) => void;
    /** Bring saved rows up to date with freshly loaded products (price, GST, stock). */
    refresh: (products: any[]) => void;
    setQty: (id: string, delta: number) => void;
    /** Set a typed quantity (already validated for the unit by QtyInput); capped at stock. */
    setQtyExact: (id: string, qty: number) => void;
    remove: (id: string) => void;
    clear: () => void;
}

/**
 * POS cart lives in a persisted store so a half-built bill survives navigating
 * away and back (and a reload). It is scoped to one business — opening the POS
 * for a different shop (or a fresh/reset shop) starts with an empty cart.
 * Cleared explicitly after a completed sale, and on logout.
 */
export const usePos = create<PosState>()(
    persist(
        (set) => ({
            cart: [],
            name: '',
            mobile: '',
            businessId: null,
            // Reset the cart when the active business changes (login as another shop, reset, etc.).
            ensureBusiness: (id) => set((s) => (s.businessId === id ? {} : { cart: [], name: '', mobile: '', businessId: id })),
            setName: (v) => set({ name: v }),
            setMobile: (v) => set({ mobile: v }),
            add: (p) => set((s) => {
                const ex = s.cart.find((r) => r.productId === p._id);
                if (ex) return { cart: s.cart.map((r) => (r.productId === p._id ? { ...r, ...pricing(p), qty: Math.min(r.qty + 1, p.currentStock) } : r)) };
                return { cart: [...s.cart, { productId: p._id, ...pricing(p), qty: 1 }] };
            }),
            refresh: (products) => set((s) => {
                const byId = new Map(products.map((p: any) => [p._id, p]));
                if (!s.cart.some((r) => byId.has(r.productId))) return {};
                return { cart: s.cart.map((r) => (byId.has(r.productId) ? { ...r, ...pricing(byId.get(r.productId)) } : r)) };
            }),
            setQty: (id, delta) => set((s) => ({ cart: s.cart.map((r) => (r.productId === id ? { ...r, qty: stepQty(r.qty, delta, r.unit, r.stock) } : r)) })),
            setQtyExact: (id, qty) => set((s) => ({ cart: s.cart.map((r) => (r.productId === id && qty > 0 ? { ...r, qty: Math.min(qty, r.stock) } : r)) })),
            remove: (id) => set((s) => ({ cart: s.cart.filter((r) => r.productId !== id) })),
            clear: () => set({ cart: [], name: '', mobile: '' }),
        }),
        { name: 'whoply_pos_cart' }
    )
);
