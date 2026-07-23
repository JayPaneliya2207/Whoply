import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface CartRow { productId: string; name: string; price: number; mrp: number; discountPct: number; gstRate: number; unit: string; qty: number; stock: number; }

interface PosState {
    cart: CartRow[];
    name: string;
    mobile: string;
    businessId: string | null;
    ensureBusiness: (id: string) => void;
    setName: (v: string) => void;
    setMobile: (v: string) => void;
    add: (p: any) => void;
    setQty: (id: string, delta: number) => void;
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
                if (ex) return { cart: s.cart.map((r) => (r.productId === p._id ? { ...r, qty: Math.min(r.qty + 1, r.stock) } : r)) };
                const disc = Number(p.discountPct) || 0;
                const price = +(p.sellPrice * (1 - disc / 100)).toFixed(2); // per-product discount applied here
                return { cart: [...s.cart, { productId: p._id, name: p.name, price, mrp: p.sellPrice, discountPct: disc, gstRate: p.gstRate, unit: p.unit, qty: 1, stock: p.currentStock }] };
            }),
            setQty: (id, delta) => set((s) => ({ cart: s.cart.map((r) => (r.productId === id ? { ...r, qty: Math.max(1, Math.min(r.qty + delta, r.stock)) } : r)) })),
            remove: (id) => set((s) => ({ cart: s.cart.filter((r) => r.productId !== id) })),
            clear: () => set({ cart: [], name: '', mobile: '' }),
        }),
        { name: 'whoply_pos_cart' }
    )
);
