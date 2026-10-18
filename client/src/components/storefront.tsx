"use client";
import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import {
  ChevronRight,
  MapPin,
  ShoppingCart,
  UserRound,
  LogOut,
  Mail,
} from "lucide-react";
import type { Food } from "@/lib/types";
import { FacebookIcon, InstagramIcon } from "./social-icons";
import { Brand } from "./brand";
import FoodCard from "./FoodCard";
import { FoodDetail } from "./food-detail";
import { CartDrawer } from "./cart-drawer";
import { useShop } from "./providers";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "./ui/dialog";
import { Button } from "./ui/button";
export function Storefront() {
  const {
    foods,
    categories,
    cart,
    user,
    authLoading,
    signOut,
    address,
    setAddress,
    notify,
    serverAvailable,
  } = useShop();
  const [selected, setSelected] = useState<Food | null>(null),
    [drawer, setDrawer] = useState(false),
    [location, setLocation] = useState(false),
    [draft, setDraft] = useState(""),
    [locationError, setLocationError] = useState(""),
    [info, setInfo] = useState<string | null>(null);
  const count = cart.reduce((n, i) => n + i.quantity, 0);
  useEffect(() => {
    try {
      if (sessionStorage.getItem("nomnom-return-cart")) {
        sessionStorage.removeItem("nomnom-return-cart");
        setDrawer(true);
      }
    } catch {}
  }, []);
  function selectCategory(id: string) {
    document
      .getElementById(`category-${id}`)
      ?.scrollIntoView({ behavior: "smooth" });
  }
  const openLocation = () => {
    setDraft(address);
    setLocationError("");
    setLocation(true);
  };
  return (
    <>
      <header className="site-header">
        <div className="site-header-inner">
          <Brand />
          <div className="header-actions">
            <button className="address-pill" onClick={openLocation}>
              <MapPin size={15} />
              <span>
                Delivery address: <b>{address || "Add Location"}</b>
              </span>
              <ChevronRight size={15} />
            </button>
            <button
              className="header-cart"
              aria-label={`Open cart, ${count} items`}
              onClick={() => setDrawer(true)}
            >
              <ShoppingCart size={17} />
              {count > 0 && <span>{count}</span>}
            </button>
            {authLoading ? (
              <div className="account-skeleton" aria-label="Checking account" />
            ) : user ? (
              <details className="account-menu">
                <summary aria-label="Open account menu">
                  <UserRound size={17} />
                </summary>
                <div className="account-popover">
                  <b>{user.email}</b>
                  {user.role === "ADMIN" && (
                    <Link href="/admin/food-menu">Admin panel</Link>
                  )}
                  <button
                    onClick={async () => {
                      try {
                        await signOut();
                      } catch (e) {
                        notify(
                          e instanceof Error
                            ? e.message
                            : "Could not sign out.",
                        );
                      }
                    }}
                  >
                    <LogOut size={13} />
                    Sign out
                  </button>
                </div>
              </details>
            ) : (
              <div className="guest-buttons">
                <Button
                  asChild
                  variant="outline"
                  size="sm"
                  className="rounded-full"
                >
                  <Link href="/signup">Sign up</Link>
                </Button>
                <Button
                  asChild
                  variant="destructive"
                  size="sm"
                  className="rounded-full"
                >
                  <Link href="/login">Log in</Link>
                </Button>
              </div>
            )}
          </div>
        </div>
      </header>
      <main id="home">
        <section className="hero-banner" aria-label="Today's special offer">
          <Image
            src="/images/offer-banner.png"
            alt="Today's offer: Steak Society meal with lime cheesecake"
            width={4096}
            height={1900}
            loading="eager"
            className="offer-banner-image"
          />
        </section>
        <section className="menu-wrapper" id="menu">
          {serverAvailable === false && (
            <div className="offline-notice" role="status">
              You’re viewing the sample menu. The API is currently unavailable;
              account and order actions need the server.
            </div>
          )}
          {categories.map((category, index) => {
            const items = foods.filter((f) => f.category === category._id);
            return items.length ? (
              <section
                className="food-section"
                id={`category-${category._id}`}
                key={category._id}
              >
                <div className="food-section-title">
                  <h2>{category.categoryName}</h2>
                </div>
                <div className="food-grid">
                  {items.map((food, i) => (
                    <FoodCard
                      key={food._id}
                      food={food}
                      onSelect={setSelected}
                      aboveFold={index === 0 && i < 3}
                    />
                  ))}
                </div>
              </section>
            ) : null;
          })}
          {!foods.length && (
            <div className="no-food">
              <h2>Our menu is being prepared</h2>
              <p>Check back soon for delicious dishes.</p>
            </div>
          )}
        </section>
      </main>
      <footer className="site-footer">
        <div className="marquee" aria-label="Fresh fast delivered">
          <div>
            {Array.from({ length: 8 }, (_, i) => (
              <span key={i}>Fresh fast delivered</span>
            ))}
          </div>
        </div>
        <div className="footer-content">
          <Brand stacked />
          <div>
            <h3>NOMNOM</h3>
            <a href="#home">Home</a>
            <button onClick={() => setInfo("contact")}>Contact us</button>
            <button onClick={() => setInfo("zone")}>Delivery zone</button>
          </div>
          <div className="footer-menu">
            <h3>MENU</h3>
            <div className="footer-menu-columns">
              {[
                ["Appetizers", "Salads", "Pizzas", "Main dishes", "Desserts"],
                [
                  "Side dish",
                  "Brunch",
                  "Desserts",
                  "Beverages",
                  "Fish & Sea foods",
                ],
              ].map((column, index) => (
                <div key={index}>
                  {column.map((name, i) => (
                    <button
                      key={`${name}-${i}`}
                      onClick={() => {
                        const category = categories.find(
                          (c) =>
                            c.categoryName.toLowerCase() === name.toLowerCase(),
                        );
                        if (
                          category &&
                          foods.some((f) => f.category === category._id)
                        )
                          selectCategory(category._id);
                        else setInfo(name);
                      }}
                    >
                      {name}
                    </button>
                  ))}
                </div>
              ))}
            </div>
          </div>
          <div className="footer-social">
            <h3>FOLLOW US</h3>
            <div>
              <button
                aria-label="NomNom on Facebook"
                onClick={() => setInfo("Facebook")}
              >
                <FacebookIcon />
              </button>
              <button
                aria-label="NomNom on Instagram"
                onClick={() => setInfo("Instagram")}
              >
                <InstagramIcon />
              </button>
            </div>
          </div>
          <div className="footer-bottom">
            <span>Copy right 2024 © Nomnom LLC</span>
            {["Privacy policy", "Terms and condition", "Cookie policy"].map(
              (name) => (
                <button key={name} onClick={() => setInfo(name)}>
                  {name}
                </button>
              ),
            )}
          </div>
        </div>
      </footer>
      <FoodDetail food={selected} onClose={() => setSelected(null)} />
      <CartDrawer open={drawer} onClose={() => setDrawer(false)} />
      <Dialog open={location} onOpenChange={setLocation}>
        <DialogContent>
          <DialogTitle className="modal-title">
            Please write your delivery address!
          </DialogTitle>
          <DialogDescription className="modal-description">
            Include district, street, building, and apartment number.
          </DialogDescription>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (draft.trim().length < 8) {
                setLocationError("Please enter your complete address.");
                return;
              }
              setAddress(draft.trim());
              setLocation(false);
              notify("Delivery address saved.");
            }}
          >
            <label className="sr-only" htmlFor="delivery-address">
              Delivery address
            </label>
            <textarea
              id="delivery-address"
              autoFocus
              className={`location-input ${locationError ? "invalid" : ""}`}
              placeholder="Please share your complete address"
              value={draft}
              onChange={(e) => {
                setDraft(e.target.value);
                setLocationError("");
              }}
              maxLength={500}
            />
            {locationError && (
              <p className="field-error" role="alert">
                {locationError}
              </p>
            )}
            <div className="flex justify-end gap-3 mt-5">
              <Button
                type="button"
                variant="outline"
                onClick={() => setLocation(false)}
              >
                Cancel
              </Button>
              <Button type="submit">Deliver here</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
      <Dialog
        open={!!info}
        onOpenChange={(v) => {
          if (!v) setInfo(null);
        }}
      >
        <DialogContent>
          <DialogTitle className="modal-title">
            {info === "contact"
              ? "Contact NomNom"
              : info === "zone"
                ? "Delivery zone"
                : info}
          </DialogTitle>
          <DialogDescription className="modal-description">
            {info === "contact"
              ? "This is a development preview of NomNom. Real restaurant contact details will be added before launch."
              : info === "zone"
                ? "The delivery service is being prepared for Ulaanbaatar. Live delivery coverage is not available in this development preview."
                : ["Facebook", "Instagram"].includes(info || "")
                  ? "Our official social profiles will be announced here."
                  : [
                        "Privacy policy",
                        "Terms and condition",
                        "Cookie policy",
                      ].includes(info || "")
                    ? "This document has not been published yet."
                    : "There are no dishes in this category yet. Explore the other dishes on our menu."}
          </DialogDescription>
          <div className="info-icon">
            {info === "contact" ? <Mail size={35} /> : <MapPin size={35} />}
          </div>
          <Button className="w-full" onClick={() => setInfo(null)}>
            Got it
          </Button>
        </DialogContent>
      </Dialog>
    </>
  );
}
