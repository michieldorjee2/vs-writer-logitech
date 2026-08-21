/**
 * Maison Aurelle — Cart, Saved-for-next-visit, and Reservations.
 *
 * A small client-side state library wired up to localStorage so the cart
 * survives page reloads. Each retail customer has an independent cart
 * keyed by their customerSlug so test interactions don't bleed between
 * pages.
 *
 * Three lists:
 *   - cart        the shopper's current selection, ready to be sent to
 *                 the stylist for confirmation
 *   - saved       items put aside for "next visit" (the gold-ribbon list)
 *   - reservations  appointment slots the shopper has committed to
 *
 * The provider exposes a richer set of helpers than just add/remove so
 * the page components can animate based on cart events (flyToCart,
 * lastAddedAt) and so the topbar drawer can render counts with no
 * additional plumbing.
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useState,
  type ReactNode,
} from 'react';

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

export interface CartItem {
  id: string;
  name: string;
  qualifier?: string | null;
  imageUrl?: string | null;
  priceLabel?: string | null;
  priceCents?: number | null;
  qty: number;
  source: 'held' | 'pair' | 'lookbook' | 'invitation' | 'set-aside';
  /** Optional editorial line for the cart drawer ("Pair with the Anna…") */
  note?: string | null;
}

export interface SavedItem {
  id: string;
  name: string;
  qualifier?: string | null;
  imageUrl?: string | null;
  priceLabel?: string | null;
  note?: string | null;
}

export interface Reservation {
  id: string;
  slot: string;
  boutique?: string | null;
  customer: string;
  initials?: string | null;
  createdAt: string;
}

// "Where the click came from on screen" — used to fly the product image
// from the source position to the cart icon when it's added.
export interface FlyOrigin {
  x: number;
  y: number;
  size?: number;
  imageUrl?: string | null;
}

interface CartState {
  cart: CartItem[];
  saved: SavedItem[];
  reservations: Reservation[];
  lastAddedAt: number;
  lastSavedAt: number;
  lastReservedAt: number;
  flyOrigin: FlyOrigin | null;
  flyImage: string | null;
  flyKey: number;
}

const INITIAL_STATE: CartState = {
  cart: [],
  saved: [],
  reservations: [],
  lastAddedAt: 0,
  lastSavedAt: 0,
  lastReservedAt: 0,
  flyOrigin: null,
  flyImage: null,
  flyKey: 0,
};

type Action =
  | { type: 'add'; item: CartItem; origin?: FlyOrigin | null }
  | { type: 'remove'; id: string }
  | { type: 'qty'; id: string; qty: number }
  | { type: 'save'; item: SavedItem }
  | { type: 'unsave'; id: string }
  | { type: 'reserve'; reservation: Reservation }
  | { type: 'unreserve'; id: string }
  | { type: 'clear-fly' }
  | { type: 'hydrate'; state: Partial<CartState> };

function reducer(state: CartState, action: Action): CartState {
  switch (action.type) {
    case 'add': {
      const existing = state.cart.find((i) => i.id === action.item.id);
      const cart = existing
        ? state.cart.map((i) =>
            i.id === action.item.id ? { ...i, qty: i.qty + action.item.qty } : i,
          )
        : [...state.cart, action.item];
      return {
        ...state,
        cart,
        lastAddedAt: Date.now(),
        flyOrigin: action.origin || null,
        flyImage: action.origin?.imageUrl ?? action.item.imageUrl ?? null,
        flyKey: state.flyKey + 1,
      };
    }
    case 'remove':
      return { ...state, cart: state.cart.filter((i) => i.id !== action.id) };
    case 'qty':
      return {
        ...state,
        cart: state.cart
          .map((i) => (i.id === action.id ? { ...i, qty: Math.max(0, action.qty) } : i))
          .filter((i) => i.qty > 0),
      };
    case 'save': {
      const exists = state.saved.find((s) => s.id === action.item.id);
      return {
        ...state,
        saved: exists ? state.saved : [...state.saved, action.item],
        lastSavedAt: Date.now(),
      };
    }
    case 'unsave':
      return { ...state, saved: state.saved.filter((s) => s.id !== action.id) };
    case 'reserve':
      return {
        ...state,
        reservations: [...state.reservations, action.reservation],
        lastReservedAt: Date.now(),
      };
    case 'unreserve':
      return { ...state, reservations: state.reservations.filter((r) => r.id !== action.id) };
    case 'clear-fly':
      return { ...state, flyOrigin: null, flyImage: null };
    case 'hydrate':
      return { ...state, ...action.state };
    default:
      return state;
  }
}

// -----------------------------------------------------------------------------
// Context
// -----------------------------------------------------------------------------

interface CartContextValue extends CartState {
  addToCart: (item: CartItem, origin?: FlyOrigin | null) => void;
  removeFromCart: (id: string) => void;
  setQty: (id: string, qty: number) => void;
  saveForLater: (item: SavedItem) => void;
  unsave: (id: string) => void;
  reserve: (slot: string, customer: string, opts?: { boutique?: string; initials?: string }) => void;
  cancelReservation: (id: string) => void;
  clearFly: () => void;
  openDrawer: (tab?: DrawerTab) => void;
  closeDrawer: () => void;
  drawerOpen: boolean;
  drawerTab: DrawerTab;
  setDrawerTab: (t: DrawerTab) => void;
}

export type DrawerTab = 'cart' | 'saved' | 'reservations';

const CartContext = createContext<CartContextValue | null>(null);

const storageKey = (slug: string) => `aurelle:cart:${slug}`;

export function CartProvider({ slug, children }: { slug: string; children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, INITIAL_STATE);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerTab, setDrawerTab] = useState<DrawerTab>('cart');

  // Hydrate from localStorage once on mount.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const raw = window.localStorage.getItem(storageKey(slug));
      if (raw) {
        const parsed = JSON.parse(raw) as Partial<CartState>;
        dispatch({ type: 'hydrate', state: parsed });
      }
    } catch {
      /* ignore corrupted storage */
    }
  }, [slug]);

  // Persist whenever the persisted lists change.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const toPersist = {
      cart: state.cart,
      saved: state.saved,
      reservations: state.reservations,
    };
    try {
      window.localStorage.setItem(storageKey(slug), JSON.stringify(toPersist));
    } catch {
      /* quota etc. */
    }
  }, [slug, state.cart, state.saved, state.reservations]);

  const value = useMemo<CartContextValue>(
    () => ({
      ...state,
      drawerOpen,
      drawerTab,
      setDrawerTab,
      openDrawer: (t?: DrawerTab) => {
        if (t) setDrawerTab(t);
        setDrawerOpen(true);
      },
      closeDrawer: () => setDrawerOpen(false),
      addToCart: (item, origin) => {
        dispatch({ type: 'add', item, origin: origin || null });
        // Auto-peek the cart drawer briefly so the user sees the delta.
        if (typeof window !== 'undefined') {
          setDrawerOpen(true);
          window.setTimeout(() => {
            setDrawerOpen(false);
          }, 2800);
        }
      },
      removeFromCart: (id) => dispatch({ type: 'remove', id }),
      setQty: (id, qty) => dispatch({ type: 'qty', id, qty }),
      saveForLater: (item) => {
        dispatch({ type: 'save', item });
        if (typeof window !== 'undefined') {
          setDrawerTab('saved');
          setDrawerOpen(true);
          window.setTimeout(() => setDrawerOpen(false), 2400);
        }
      },
      unsave: (id) => dispatch({ type: 'unsave', id }),
      reserve: (slot, customer, opts) => {
        const reservation: Reservation = {
          id: `res-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          slot,
          boutique: opts?.boutique ?? null,
          customer,
          initials: opts?.initials ?? null,
          createdAt: new Date().toISOString(),
        };
        dispatch({ type: 'reserve', reservation });
      },
      cancelReservation: (id) => dispatch({ type: 'unreserve', id }),
      clearFly: () => dispatch({ type: 'clear-fly' }),
    }),
    [state, drawerOpen, drawerTab],
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart(): CartContextValue {
  const ctx = useContext(CartContext);
  if (!ctx) {
    throw new Error('useCart must be used inside <CartProvider>');
  }
  return ctx;
}

// -----------------------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------------------

export function formatPrice(item: Pick<CartItem, 'priceLabel' | 'priceCents'>): string | null {
  if (item.priceLabel) return item.priceLabel;
  if (typeof item.priceCents === 'number') {
    return `$${(item.priceCents / 100).toLocaleString('en-US', { minimumFractionDigits: 0 })}`;
  }
  return null;
}

export function cartTotalCents(items: CartItem[]): number {
  return items.reduce(
    (sum, i) => sum + (typeof i.priceCents === 'number' ? i.priceCents * i.qty : 0),
    0,
  );
}

/** Compute the visual origin point of a click for the fly-to-cart animation. */
export function originFromEvent(
  e: React.MouseEvent | MouseEvent,
  imageUrl?: string | null,
): FlyOrigin {
  const target = e.currentTarget as HTMLElement | null;
  let x = 0;
  let y = 0;
  let size = 96;
  if (target) {
    const rect = target.getBoundingClientRect();
    x = rect.left + rect.width / 2;
    y = rect.top + rect.height / 2;
    size = Math.min(rect.width, rect.height) || 96;
  } else if ('clientX' in e) {
    x = e.clientX;
    y = e.clientY;
  }
  return { x, y, size, imageUrl: imageUrl || null };
}

/** Stable id from a name so repeat clicks of the same item merge. */
export function slugifyName(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 80);
}
