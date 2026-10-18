"use client";
import { OrderSuccessArt } from "./order-success-art";
import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import {
  ShoppingCart,
  Minus,
  Plus,
  X,
  MapPin,
  Clock,
  Utensils,
  ArrowRight,
  Check,
} from "lucide-react";
import { api, dollars, ApiError } from "@/lib/api";
import type { FoodOrder } from "@/lib/types";
import { useShop } from "./providers";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "./ui/dialog";
import { Button } from "./ui/button";
export function CartDrawer({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const {
    cart,
    address,
    setAddress,
    user,
    authLoading,
    change,
    remove,
    clear,
    notify,
  } = useShop();
  const [tab, setTab] = useState<"cart" | "order">("cart"),
    [orders, setOrders] = useState<FoodOrder[]>([]),
    [ordersLoading, setOrdersLoading] = useState(false),
    [ordersError, setOrdersError] = useState("");
  const [addressError, setAddressError] = useState(false),
    [loginAlert, setLoginAlert] = useState(false),
    [placing, setPlacing] = useState(false),
    [error, setError] = useState(""),
    [success, setSuccess] = useState(false);
  const submitting = useRef(false),
    request = useRef({ signature: "", id: "" });
  const subtotal =
    cart.reduce(
      (total, item) =>
        total + Math.round(item.food.price * 100) * item.quantity,
      0,
    ) / 100;
  const shipping = cart.length ? 0.99 : 0,
    total = subtotal + shipping;
  const loadOrders = async () => {
    if (!user) return;
    setOrdersLoading(true);
    setOrdersError("");
    try {
      const data = await api<{ orders: FoodOrder[] }>("/food-order");
      setOrders(data.orders);
    } catch (e) {
      setOrdersError(e instanceof Error ? e.message : "Could not load orders.");
    } finally {
      setOrdersLoading(false);
    }
  };
  useEffect(() => {
    if (open && tab === "order" && user) {
      let active = true;
      setOrdersLoading(true);
      setOrdersError("");
      api<{ orders: FoodOrder[] }>("/food-order")
        .then((r) => {
          if (active) setOrders(r.orders);
        })
        .catch((e) => {
          if (active) setOrdersError(e.message);
        })
        .finally(() => {
          if (active) setOrdersLoading(false);
        });
      return () => {
        active = false;
      };
    }
  }, [open, tab, user]);
  useEffect(() => {
    setOrders([]);
  }, [user?._id]);
  async function checkout() {
    if (submitting.current || !cart.length || authLoading) return;
    setError("");
    if (!user) {
      setLoginAlert(true);
      return;
    }
    if (address.trim().length < 8) {
      setAddressError(true);
      return;
    }
    const payload = {
      foodOrderItems: cart.map((i) => ({
        food: i.food._id,
        quantity: i.quantity,
      })),
      address: address.trim(),
    };
    const signature = JSON.stringify(payload);
    if (request.current.signature !== signature)
      request.current = { signature, id: crypto.randomUUID() };
    submitting.current = true;
    setPlacing(true);
    try {
      const { order } = await api<{ order: FoodOrder }>("/food-order", {
        method: "POST",
        body: JSON.stringify({ ...payload, requestId: request.current.id }),
      });
      setOrders((prev) => [order, ...prev.filter((o) => o._id !== order._id)]);
      clear();
      request.current = { signature: "", id: "" };
      setSuccess(true);
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) setLoginAlert(true);
      else
        setError(e instanceof Error ? e.message : "Order could not be placed.");
    } finally {
      submitting.current = false;
      setPlacing(false);
    }
  }
  const rememberCart = () => {
    try {
      sessionStorage.setItem("nomnom-return-cart", "1");
    } catch {}
    onClose();
  };
  return (
    <>
      <Dialog
        open={open}
        onOpenChange={(value) => {
          if (!value) onClose();
        }}
      >
        <DialogContent className="cart-drawer" style={{ translate: "none" }}>
          <DialogTitle className="drawer-title">
            <ShoppingCart size={20} />
            Order detail
          </DialogTitle>
          <DialogDescription className="sr-only">
            Manage your cart, delivery address, and order history.
          </DialogDescription>
          <div className="drawer-tabs" role="tablist" aria-label="Order detail">
            <button
              role="tab"
              aria-selected={tab === "cart"}
              aria-controls="cart-panel"
              id="cart-tab"
              onClick={() => setTab("cart")}
              className={tab === "cart" ? "active" : ""}
            >
              Cart
            </button>
            <button
              role="tab"
              aria-selected={tab === "order"}
              aria-controls="order-panel"
              id="order-tab"
              onClick={() => setTab("order")}
              className={tab === "order" ? "active" : ""}
            >
              Order
            </button>
          </div>
          {tab === "cart" ? (
            <section
              className="drawer-white cart-content"
              role="tabpanel"
              id="cart-panel"
              aria-labelledby="cart-tab"
            >
              <h3>My cart</h3>
              {cart.length ? (
                <>
                  <div className="cart-lines">
                    {cart.map(({ food, quantity }) => (
                      <div key={food._id} className="cart-line">
                        <Image
                          src={food.image}
                          unoptimized={
                            food.image.startsWith("https://") ||
                            food.image.startsWith("/api/uploads/")
                          }
                          alt={food.foodName}
                          width={120}
                          height={120}
                        />
                        <div className="cart-line-copy">
                          <b>{food.foodName}</b>
                          <p>{food.ingredients}</p>
                          <div className="cart-quantity-row">
                            <div className="quantity small">
                              <button
                                onClick={() => change(food._id, -1)}
                                aria-label={`Decrease ${food.foodName}`}
                              >
                                <Minus size={13} />
                              </button>
                              <span>{quantity}</span>
                              <button
                                onClick={() => change(food._id, 1)}
                                disabled={quantity >= 20}
                                aria-label={`Increase ${food.foodName}`}
                              >
                                <Plus size={13} />
                              </button>
                            </div>
                            <strong>{dollars(food.price * quantity)}</strong>
                          </div>
                        </div>
                        <button
                          className="remove-item"
                          onClick={() => remove(food._id)}
                          aria-label={`Remove ${food.foodName}`}
                        >
                          <X size={13} />
                        </button>
                      </div>
                    ))}
                  </div>
                  <label className="delivery-label" htmlFor="cart-address">
                    Delivery location
                  </label>
                  <textarea
                    id="cart-address"
                    placeholder="Please share your complete address"
                    maxLength={500}
                    value={address}
                    onChange={(e) => {
                      setAddress(e.target.value);
                      setAddressError(false);
                    }}
                    className={addressError ? "invalid" : ""}
                    aria-invalid={addressError}
                    aria-describedby={
                      addressError ? "address-error" : undefined
                    }
                  />
                  {addressError && (
                    <p className="field-error" id="address-error">
                      Please complete your address (at least 8 characters).
                    </p>
                  )}
                </>
              ) : (
                <div className="empty-state">
                  <Image src="/images/logo.svg" alt="" width={55} height={44} />
                  <h4>Your cart is empty</h4>
                  <p>
                    Hungry? Add some delicious dishes to your cart and satisfy
                    your cravings!
                  </p>
                  <button onClick={onClose}>
                    Explore the menu <ArrowRight size={13} />
                  </button>
                </div>
              )}
            </section>
          ) : (
            <section
              className="drawer-white order-content"
              role="tabpanel"
              id="order-panel"
              aria-labelledby="order-tab"
            >
              <h3>Order history</h3>
              {!user ? (
                <div className="empty-state">
                  <Image src="/images/logo.svg" alt="" width={55} height={44} />
                  <h4>Your orders live here</h4>
                  <p>Log in to view your order history.</p>
                  <Link href="/login" onClick={rememberCart}>
                    Log in <ArrowRight size={13} />
                  </Link>
                </div>
              ) : ordersLoading ? (
                <p className="drawer-message" role="status">
                  Loading your orders…
                </p>
              ) : ordersError ? (
                <div className="drawer-message">
                  <p role="alert">{ordersError}</p>
                  <Button size="sm" onClick={loadOrders}>
                    Try again
                  </Button>
                </div>
              ) : !orders.length ? (
                <div className="empty-state">
                  <Image src="/images/logo.svg" alt="" width={55} height={44} />
                  <h4>No Orders Yet?</h4>
                  <p>
                    You haven’t placed any orders yet. Start exploring our menu
                    and satisfy your cravings!
                  </p>
                </div>
              ) : (
                orders.map((order) => (
                  <article className="order-entry" key={order._id}>
                    <div className="order-entry-top">
                      <b>
                        {dollars(order.totalPrice)}{" "}
                        <small>(#{order._id.slice(-6).toUpperCase()})</small>
                      </b>
                      <span
                        className={`order-status ${order.status.toLowerCase()}`}
                      >
                        {order.status === "PENDING"
                          ? "Pending"
                          : order.status === "DELIVERED"
                            ? "Delivered"
                            : "Canceled"}
                      </span>
                    </div>
                    {order.foodOrderItems.map((item, i) => (
                      <div className="order-entry-line" key={i}>
                        <Utensils size={12} />
                        <span>{item.food?.foodName || "Unavailable food"}</span>
                        <b>× {item.quantity}</b>
                      </div>
                    ))}
                    <div className="order-entry-line">
                      <Clock size={12} />
                      <span>
                        {new Date(order.createdAt).toLocaleDateString("en-GB")}
                      </span>
                    </div>
                    <div className="order-entry-line">
                      <MapPin size={12} />
                      <span>{order.address}</span>
                    </div>
                  </article>
                ))
              )}
            </section>
          )}
          {tab === "cart" && (
            <section className="drawer-white payment">
              <h3>Payment info</h3>
              <div>
                <span>Items</span>
                <b>{cart.length ? dollars(subtotal) : "–"}</b>
              </div>
              <div>
                <span>Shipping</span>
                <b>{cart.length ? dollars(shipping) : "–"}</b>
              </div>
              <div className="payment-total">
                <span>Total</span>
                <b>{cart.length ? dollars(total) : "–"}</b>
              </div>
              {error && (
                <p className="field-error" role="alert">
                  {error}
                </p>
              )}
              <Button
                variant="destructive"
                className="w-full rounded-full"
                onClick={checkout}
                disabled={!cart.length || placing || authLoading}
              >
                {placing ? "Placing your order…" : "Checkout"}
              </Button>
              <p className="payment-note">
                Local preview · no online payment is taken.
              </p>
            </section>
          )}
        </DialogContent>
      </Dialog>
      <Dialog open={loginAlert} onOpenChange={setLoginAlert}>
        <DialogContent className="login-alert">
          <DialogTitle>You need to log in first</DialogTitle>
          <DialogDescription className="sr-only">
            Log in or create an account to place an order.
          </DialogDescription>
          <div className="flex gap-3 mt-7">
            <Button asChild className="flex-1">
              <Link
                href="/login"
                onClick={() => {
                  setLoginAlert(false);
                  rememberCart();
                }}
              >
                Log in
              </Link>
            </Button>
            <Button variant="outline" asChild className="flex-1">
              <Link
                href="/signup"
                onClick={() => {
                  setLoginAlert(false);
                  rememberCart();
                }}
              >
                Sign up
              </Link>
            </Button>
          </div>
        </DialogContent>
      </Dialog>
      <Dialog open={success} onOpenChange={setSuccess}>
        <DialogContent className="success-dialog">
          <DialogTitle>Your order has been successfully placed!</DialogTitle>
          <DialogDescription>
            Your order is now pending. You can follow its status in the Order
            tab.
          </DialogDescription>
          <OrderSuccessArt />
          <div className="flex gap-3 justify-center">
            <Button
              variant="outline"
              onClick={() => {
                setSuccess(false);
                onClose();
                notify("Thank you! Your order is saved.");
              }}
            >
              Back to home
            </Button>
            <Button
              onClick={() => {
                setSuccess(false);
                setTab("order");
              }}
            >
              View order
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
