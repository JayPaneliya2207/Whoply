import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface CartRow { productId: string; name: string; price: number; gstRate: number; unit: string; qty: number; stock: number; }

interface PosState {
    cart: CartRow[];
    name: string;
    mobile: string;
    setName: (v: string) => void;
    setMobile: (v: string) => void;
    add: (p: any) => void;
    setQty: (id: string, delta: number) => void;
    remove: (id: string) => void;
    clear: () => void;
}

/**
 * POS cart lives in a persisted store so a half-built bill survives navigating
 * away and back (and a reload). Cleared explicitly after a completed sale.
 */
export const usePos = create<PosState>()(
    persist(
        (set) => ({
            cart: [],
            name: '',
            mobile: '',
            setName: (v) => set({ name: v }),
            setMobile: (v) => set({ mobile: v }),
            add: (p) => set((s) => {
                const ex = s.cart.find((r) => r.productId === p._id);
                if (ex) return { cart: s.cart.map((r) => (r.productId === p._id ? { ...r, qty: Math.min(r.qty + 1, r.stock) } : r)) };
                return { cart: [...s.cart, { productId: p._id, name: p.name, price: p.sellPrice, gstRate: p.gstRate, unit: p.unit, qty: 1, stock: p.currentStock }] };
            }),
            setQty: (id, delta) => set((s) => ({ cart: s.cart.map((r) => (r.productId === id ? { ...r, qty: Math.max(1, Math.min(r.qty + delta, r.stock)) } : r)) })),
            remove: (id) => set((s) => ({ cart: s.cart.filter((r) => r.productId !== id) })),
            clear: () => set({ cart: [], name: '', mobile: '' }),
        }),
        { name: 'whoply_pos_cart' }
    )
);
