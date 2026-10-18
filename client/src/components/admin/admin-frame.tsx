"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { createContext, useContext, useState, type ReactNode } from "react";
import { LayoutGrid, Truck, ArrowLeft, UserRound } from "lucide-react";
import { Brand } from "@/components/brand";
import { useShop } from "@/components/providers";
import { foods, categories } from "@/lib/catalog";
import type { Food, FoodCategory, FoodOrder } from "@/lib/types";
export type AdminOrder = FoodOrder & {
  customer: { _id: string; email: string };
};
export const statusLabels = {
  DELIVERED: "Delivered",
  PENDING: "Pending",
  CANCELED: "Cancelled",
};
export type Status = keyof typeof statusLabels;
const sampleOrders: AdminOrder[] = Array.from({ length: 32 }, (_, i) => ({
  _id: (20156 + i).toString(16).padStart(24, "0"),
  customer: {
    _id: "sample",
    email: i === 0 ? "amgalan@example.com" : `customer${i + 1}@example.com`,
  },
  totalPrice: 26.97,
  shipping: 0.99,
  address:
    "Sukhbaatar District, Gurvan gol office, 4th floor, Pinecone academy",
  status: i % 12 < 3 ? "PENDING" : i % 12 < 7 ? "DELIVERED" : "CANCELED",
  createdAt: new Date(
    Date.UTC(2026, 9, 16 - Math.floor(i / 4), 6, i),
  ).toISOString(),
  foodOrderItems: [
    { food: foods[0], quantity: 1, unitPrice: 12.99 },
    { food: foods[1], quantity: 1, unitPrice: 12.99 },
  ],
}));
type Preview = {
  foods: Food[];
  setFoods: React.Dispatch<React.SetStateAction<Food[]>>;
  categories: FoodCategory[];
  setCategories: React.Dispatch<React.SetStateAction<FoodCategory[]>>;
  orders: AdminOrder[];
  setOrders: React.Dispatch<React.SetStateAction<AdminOrder[]>>;
};
const PreviewContext = createContext<Preview | null>(null);
export function useAdminPreview() {
  return useContext(PreviewContext)!;
}
export function AdminFrame({ children }: { children: ReactNode }) {
  const pathname = usePathname(),
    preview = pathname.endsWith("/preview"),
    ordersPage = pathname.includes("/orders");
  const { user, authLoading, signOut, notify } = useShop();
  const [sampleFoods, setFoods] = useState(foods),
    [sampleCategories, setCategories] = useState(categories),
    [orders, setOrders] = useState(sampleOrders);
  const suffix = preview ? "/preview" : "";
  return (
    <PreviewContext.Provider
      value={{
        foods: sampleFoods,
        setFoods,
        categories: sampleCategories,
        setCategories,
        orders,
        setOrders,
      }}
    >
      <div className="admin-app">
        <aside className="admin-sidebar">
          <Brand />
          <nav aria-label="Admin navigation">
            <Link
              className={!ordersPage ? "active" : ""}
              href={`/admin/food-menu${suffix}`}
            >
              <LayoutGrid size={18} />
              Food menu
            </Link>
            <Link
              className={ordersPage ? "active" : ""}
              href={`/admin/orders${suffix}`}
            >
              <Truck size={19} />
              Orders
            </Link>
          </nav>
          <Link className="admin-back" href="/">
            <ArrowLeft size={16} />
            Back to store
          </Link>
        </aside>
        <div className="admin-main">
          <header className="admin-topbar">
            <span>{preview ? "Design preview" : user?.email}</span>
            <details>
              <summary aria-label="Account menu">
                <UserRound size={18} />
              </summary>
              <div className="admin-account">
                <b>
                  {preview ? "Preview account" : user?.email || "Admin access"}
                </b>
                {user ? (
                  <button
                    onClick={() => {
                      void signOut().catch((e) => notify(e.message));
                    }}
                  >
                    Sign out
                  </button>
                ) : (
                  <Link href="/login">Log in</Link>
                )}
              </div>
            </details>
          </header>
          {preview && (
            <div className="admin-preview-note">
              Sample data · Changes stay in this preview.{" "}
              <Link href={ordersPage ? "/admin/orders" : "/admin/food-menu"}>
                Open live admin
              </Link>
            </div>
          )}
          {preview || user?.role === "ADMIN" ? (
            children
          ) : (
            <section className="admin-access">
              <h1>
                {authLoading ? "Checking access…" : "Admin access required"}
              </h1>
              {!authLoading && (
                <>
                  <p>
                    Log in with an administrator account to manage the menu and
                    orders.
                  </p>
                  <Link className="admin-button" href="/login">
                    Log in
                  </Link>
                  <Link
                    className="admin-text-link"
                    href={`/admin/${ordersPage ? "orders" : "food-menu"}/preview`}
                  >
                    Explore the design preview
                  </Link>
                </>
              )}
            </section>
          )}
        </div>
      </div>
    </PreviewContext.Provider>
  );
}
