import { create } from 'zustand';

/**
 * Customer cart store. A cart line captures the chosen variant + add-ons so the
 * same item with different options are distinct lines. Pricing shown is a
 * client-side estimate — the server is always authoritative at checkout.
 */
function lineKey(item) {
  return [item.menuItemId, item.variantId || '', ...(item.addonOptionIds || []).slice().sort()].join('|');
}

export const useCart = create((set, get) => ({
  lines: [], // { key, menuItemId, name, variantId, variantName, addonOptionIds, addons, unitPrice, quantity, note }

  add: (line) => {
    const key = lineKey(line);
    const lines = [...get().lines];
    const existing = lines.find((l) => l.key === key);
    if (existing) existing.quantity += line.quantity || 1;
    else lines.push({ ...line, key, quantity: line.quantity || 1 });
    set({ lines });
  },

  setQty: (key, quantity) => {
    if (quantity <= 0) return get().remove(key);
    set({ lines: get().lines.map((l) => (l.key === key ? { ...l, quantity } : l)) });
  },

  remove: (key) => set({ lines: get().lines.filter((l) => l.key !== key) }),
  clear: () => set({ lines: [] }),

  count: () => get().lines.reduce((s, l) => s + l.quantity, 0),
  subtotal: () =>
    get().lines.reduce((s, l) => s + (l.unitPrice + (l.addons || []).reduce((a, x) => a + x.price, 0)) * l.quantity, 0),

  /** Serialize to the API cart shape. */
  toApiCart: () =>
    get().lines.map((l) => ({
      menuItemId: l.menuItemId,
      variantId: l.variantId || undefined,
      quantity: l.quantity,
      addonOptionIds: (l.addonOptionIds || []).length ? l.addonOptionIds : undefined,
      note: l.note || undefined,
    })),
}));
