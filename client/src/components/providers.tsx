"use client";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { Check } from "lucide-react";
import { api, ApiError } from "@/lib/api";
import {
  categories as initialCategories,
  foods as initialFoods,
} from "@/lib/catalog";
import type { CartItem, Food, FoodCategory, User } from "@/lib/types";
type Shop = {
  foods: Food[];
  categories: FoodCategory[];
  cart: CartItem[];
  address: string;
  setAddress: (address: string) => void;
  add: (food: Food, quantity?: number) => void;
  change: (id: string, delta: number) => void;
  remove: (id: string) => void;
  clear: () => void;
  user: User | null;
  setUser: (user: User | null) => void;
  authLoading: boolean;
  signOut: () => Promise<void>;
  notify: (text: string) => void;
  serverAvailable: boolean | null;
  refreshCatalog: () => Promise<void>;
};
const ShopContext = createContext<Shop | null>(null);
export function Providers({ children }: { children: ReactNode }) {
  const [foods, setFoods] = useState(initialFoods),
    [categories, setCategories] = useState(initialCategories);
  const [cart, setCart] = useState<CartItem[]>([]),
    [address, setAddress] = useState(""),
    [ready, setReady] = useState(false);
  const [user, setUser] = useState<User | null>(null),
    [authLoading, setAuthLoading] = useState(true),
    [message, setMessage] = useState("");
  const [serverAvailable, setServerAvailable] = useState<boolean | null>(null);
  useEffect(() => {
    try {
      const stored = JSON.parse(localStorage.getItem("nomnom-cart") || "[]");
      if (Array.isArray(stored))
        setCart(
          stored
            .filter(
              (i) =>
                i &&
                typeof i.food?._id === "string" &&
                Number.isInteger(i.quantity) &&
                i.quantity > 0 &&
                i.quantity <= 20 &&
                typeof i.food.foodName === "string",
            )
            .map((i) => ({
              ...i,
              food: initialFoods.find((f) => f._id === i.food._id) || i.food,
            })),
        );
      const saved = localStorage.getItem("nomnom-address");
      if (saved) setAddress(saved.slice(0, 500));
    } catch {}
    setReady(true);
  }, []);
  useEffect(() => {
    if (!ready) return;
    try {
      localStorage.setItem("nomnom-cart", JSON.stringify(cart));
      localStorage.setItem("nomnom-address", address);
    } catch {}
  }, [cart, address, ready]);
  useEffect(() => {
    let active = true;
    Promise.all([
      api<{ foods: Food[] }>("/food"),
      api<{ categories: FoodCategory[] }>("/food-category"),
    ])
      .then(([f, c]) => {
        if (active) {
          setFoods(f.foods);
          setCategories(c.categories);
          setServerAvailable(true);
          setCart((items) =>
            items.flatMap((i) => {
              const food = f.foods.find((f) => f._id === i.food._id);
              return food ? [{ ...i, food }] : [];
            }),
          );
        }
      })
      .catch(() => {
        if (active) setServerAvailable(false);
      });
    const load = async () => {
      try {
        let result;
        try {
          result = await api<{ user: User }>("/auth/me");
        } catch (e) {
          if (!(e instanceof ApiError) || e.status !== 401) throw e;
          result = await api<{ user: User }>("/auth/refresh");
        }
        if (active) {
          setUser(result.user);
          if (result.user.address) setAddress((a) => a || result.user.address!);
        }
      } catch {
      } finally {
        if (active) setAuthLoading(false);
      }
    };
    void load();
    return () => {
      active = false;
    };
  }, []);
  useEffect(() => {
    if (!message) return;
    const t = setTimeout(() => setMessage(""), 3000);
    return () => clearTimeout(t);
  }, [message]);
  const notify = useCallback((text: string) => setMessage(text), []);
  const add = useCallback(
    (food: Food, quantity = 1) => {
      setCart((items) => {
        const existing = items.find((i) => i.food._id === food._id);
        return existing
          ? items.map((i) =>
              i.food._id === food._id
                ? { ...i, quantity: Math.min(20, i.quantity + quantity) }
                : i,
            )
          : [...items, { food, quantity: Math.min(20, quantity) }];
      });
      notify("Food has been added to the cart!");
    },
    [notify],
  );
  const change = useCallback(
    (id: string, delta: number) =>
      setCart((items) =>
        items
          .map((i) =>
            i.food._id === id
              ? { ...i, quantity: Math.min(20, i.quantity + delta) }
              : i,
          )
          .filter((i) => i.quantity > 0),
      ),
    [],
  );
  const remove = useCallback(
    (id: string) => setCart((items) => items.filter((i) => i.food._id !== id)),
    [],
  );
  const clear = useCallback(() => setCart([]), []);
  const refreshCatalog = async () => {
    const [f, c] = await Promise.all([
      api<{ foods: Food[] }>("/food"),
      api<{ categories: FoodCategory[] }>("/food-category"),
    ]);
    setFoods(f.foods);
    setCategories(c.categories);
    setCart((items) =>
      items.flatMap((item) => {
        const food = f.foods.find((f) => f._id === item.food._id);
        return food ? [{ ...item, food }] : [];
      }),
    );
  };
  const signOut = async () => {
    await api("/auth/sign-out", { method: "POST" });
    setUser(null);
    setAddress("");
    notify("You have signed out.");
  };
  return (
    <ShopContext.Provider
      value={{
        foods,
        categories,
        cart,
        address,
        setAddress,
        add,
        change,
        remove,
        clear,
        user,
        setUser,
        authLoading,
        signOut,
        notify,
        serverAvailable,
        refreshCatalog,
      }}
    >
      {children}
      <div
        className={`toast ${message ? "visible-toast" : ""}`}
        role="status"
        aria-live="polite"
      >
        {message && (
          <>
            <Check size={17} />
            <span>{message}</span>
          </>
        )}
      </div>
    </ShopContext.Provider>
  );
}
export function useShop() {
  const value = useContext(ShopContext);
  if (!value) throw new Error("useShop must be inside Providers");
  return value;
}
