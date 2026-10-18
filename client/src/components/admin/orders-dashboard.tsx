"use client";
import { useEffect, useState } from "react";
import * as Dropdown from "@radix-ui/react-dropdown-menu";
import * as Popover from "@radix-ui/react-popover";
import {
  CalendarDays,
  ChevronsUpDown,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Check,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { api, dollars } from "@/lib/api";
import { useShop } from "@/components/providers";
import {
  useAdminPreview,
  statusLabels,
  type Status,
  type AdminOrder,
} from "./admin-frame";
type Result = {
  orders: AdminOrder[];
  page: number;
  total: number;
  totalPages: number;
};
const dateFormat = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Ulaanbaatar",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});
export function OrdersDashboard({ preview = false }: { preview?: boolean }) {
  const sample = useAdminPreview(),
    { notify, user } = useShop();
  const [result, setResult] = useState<Result>({
      orders: [],
      page: 1,
      total: 0,
      totalPages: 1,
    }),
    [page, setPage] = useState(1),
    [sort, setSort] = useState("date-desc"),
    [from, setFrom] = useState(""),
    [to, setTo] = useState(""),
    [error, setError] = useState(""),
    [loading, setLoading] = useState(true),
    [revision, setRevision] = useState(0);
  const [selected, setSelected] = useState<string[]>([]),
    [modal, setModal] = useState(false),
    [status, setStatus] = useState<Status>("DELIVERED"),
    [saving, setSaving] = useState(false);
  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");
    setSelected([]);
    if (from && to && from > to) {
      setError("Start date must be before end date.");
      setLoading(false);
      return;
    }
    if (preview) {
      let rows = sample.orders.filter(
        (o) =>
          (!from || dateFormat.format(new Date(o.createdAt)) >= from) &&
          (!to || dateFormat.format(new Date(o.createdAt)) <= to),
      );
      const rank = { PENDING: 0, DELIVERED: 1, CANCELED: 2 };
      rows = [...rows].sort((a, b) => {
        const d = sort.startsWith("status")
          ? rank[a.status] - rank[b.status]
          : new Date(a.createdAt).valueOf() - new Date(b.createdAt).valueOf();
        return (sort.endsWith("desc") ? -d : d) || a._id.localeCompare(b._id);
      });
      const totalPages = Math.max(1, Math.ceil(rows.length / 12)),
        p = Math.min(page, totalPages);
      setResult({
        orders: rows.slice((p - 1) * 12, p * 12),
        total: rows.length,
        totalPages,
        page: p,
      });
      setLoading(false);
      return;
    }
    if (user?.role !== "ADMIN") return;
    const query = new URLSearchParams({
      page: String(page),
      sort,
      ...(from ? { from } : {}),
      ...(to ? { to } : {}),
    });
    api<Result>(`/admin/orders?${query}`)
      .then((data) => {
        if (active) setResult(data);
      })
      .catch((e) => {
        if (active) setError(e.message);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [preview, sample.orders, user?.role, page, sort, from, to, revision]);
  const update = async (ids: string[], next: Status) => {
    setSaving(true);
    setError("");
    try {
      if (preview)
        sample.setOrders((rows) =>
          rows.map((row) =>
            ids.includes(row._id) ? { ...row, status: next } : row,
          ),
        );
      else
        await api("/admin/orders/status", {
          method: "PATCH",
          body: JSON.stringify({ orderIds: ids, status: next }),
        });
      setSelected([]);
      setModal(false);
      setRevision((v) => v + 1);
      notify(
        `${ids.length === 1 ? "Order" : `${ids.length} orders`} updated to ${statusLabels[next].toLowerCase()}.`,
      );
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  };
  const toggle = (id: string) =>
    setSelected((ids) =>
      ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id],
    );
  const changeSort = (kind: "date" | "status") => {
    setSort((current) =>
      current === `${kind}-asc` ? `${kind}-desc` : `${kind}-asc`,
    );
    setPage(1);
  };
  const pages = Array.from(
    { length: result.totalPages },
    (_, i) => i + 1,
  ).filter(
    (p) => p === 1 || p === result.totalPages || Math.abs(p - result.page) <= 2,
  );
  return (
    <>
      <section className="admin-orders-panel" aria-busy={loading}>
        <div className="admin-orders-toolbar">
          <div>
            <h1>Orders</h1>
            <p>{result.total} items</p>
          </div>
          <div className="admin-order-actions">
            <Popover.Root>
              <Popover.Trigger className="admin-date-button">
                <CalendarDays size={16} />
                {from || to
                  ? `${from || "Start"} – ${to || "Today"}`
                  : "Select date range"}
              </Popover.Trigger>
              <Popover.Portal>
                <Popover.Content
                  className="admin-popover admin-date-popover"
                  align="end"
                  sideOffset={8}
                >
                  <h3>Order date range</h3>
                  <p>Ulaanbaatar time · inclusive dates</p>
                  <label>
                    From
                    <input
                      aria-label="From date"
                      onInput={(e) => {
                        setFrom(e.currentTarget.value);
                        setPage(1);
                      }}
                      type="date"
                      value={from}
                      max={to || undefined}
                      onChange={(e) => {
                        setFrom(e.target.value);
                        setPage(1);
                      }}
                    />
                  </label>
                  <label>
                    To
                    <input
                      aria-label="To date"
                      onInput={(e) => {
                        setTo(e.currentTarget.value);
                        setPage(1);
                      }}
                      type="date"
                      value={to}
                      min={from || undefined}
                      onChange={(e) => {
                        setTo(e.target.value);
                        setPage(1);
                      }}
                    />
                  </label>
                  <button
                    className="admin-text-link"
                    onClick={() => {
                      setFrom("");
                      setTo("");
                      setPage(1);
                    }}
                  >
                    Clear dates
                  </button>
                </Popover.Content>
              </Popover.Portal>
            </Popover.Root>
            <button
              className="admin-button"
              disabled={!selected.length || saving || loading}
              onClick={() => setModal(true)}
            >
              Change delivery state
              {selected.length > 0 && (
                <span className="admin-selected-count">{selected.length}</span>
              )}
            </button>
          </div>
        </div>
        {error && (
          <div role="alert" className="admin-error">
            {error}
            <button onClick={() => setRevision((v) => v + 1)}>Retry</button>
          </div>
        )}
        <div className="admin-table-scroll">
          <table className="admin-orders-table">
            <thead>
              <tr>
                <th>
                  <input
                    type="checkbox"
                    aria-label="Select all orders on this page"
                    checked={
                      !!result.orders.length &&
                      selected.length === result.orders.length
                    }
                    disabled={saving || loading}
                    onChange={(e) =>
                      setSelected(
                        e.target.checked ? result.orders.map((o) => o._id) : [],
                      )
                    }
                  />
                </th>
                <th>№</th>
                <th>Customer</th>
                <th>Food</th>
                <th
                  aria-sort={
                    sort.startsWith("date")
                      ? sort.endsWith("asc")
                        ? "ascending"
                        : "descending"
                      : "none"
                  }
                >
                  <button onClick={() => changeSort("date")}>
                    Date
                    <ChevronsUpDown size={14} />
                  </button>
                </th>
                <th>Total</th>
                <th>Delivery Address</th>
                <th
                  aria-sort={
                    sort.startsWith("status")
                      ? sort.endsWith("asc")
                        ? "ascending"
                        : "descending"
                      : "none"
                  }
                >
                  <button onClick={() => changeSort("status")}>
                    Delivery state
                    <ChevronsUpDown size={14} />
                  </button>
                </th>
              </tr>
            </thead>
            <tbody>
              {!loading &&
                result.orders.map((order, i) => (
                  <tr
                    key={order._id}
                    className={selected.includes(order._id) ? "selected" : ""}
                  >
                    <td>
                      <input
                        type="checkbox"
                        aria-label={`Select order ${(result.page - 1) * 12 + i + 1}`}
                        checked={selected.includes(order._id)}
                        disabled={saving}
                        onChange={() => toggle(order._id)}
                      />
                    </td>
                    <td>{(result.page - 1) * 12 + i + 1}</td>
                    <td title={order.customer.email}>{order.customer.email}</td>
                    <td>
                      <OrderFoods order={order} />
                    </td>
                    <td>
                      {dateFormat
                        .format(new Date(order.createdAt))
                        .replaceAll("-", "/")}
                    </td>
                    <td>{dollars(order.totalPrice)}</td>
                    <td>
                      <span className="admin-address" title={order.address}>
                        {order.address}
                      </span>
                    </td>
                    <td>
                      <Dropdown.Root>
                        <Dropdown.Trigger
                          disabled={saving}
                          className={`admin-status ${order.status.toLowerCase()}`}
                          aria-label={`Delivery state for order ${(result.page - 1) * 12 + i + 1}`}
                        >
                          {statusLabels[order.status]}
                          <ChevronsUpDown size={13} />
                        </Dropdown.Trigger>
                        <Dropdown.Portal>
                          <Dropdown.Content
                            className="admin-dropdown"
                            align="start"
                            sideOffset={5}
                          >
                            {(Object.keys(statusLabels) as Status[]).map(
                              (s) => (
                                <Dropdown.Item
                                  key={s}
                                  onSelect={() => void update([order._id], s)}
                                >
                                  <span>{statusLabels[s]}</span>
                                  {s === order.status && <Check size={13} />}
                                </Dropdown.Item>
                              ),
                            )}
                          </Dropdown.Content>
                        </Dropdown.Portal>
                      </Dropdown.Root>
                    </td>
                  </tr>
                ))}
              {loading && (
                <tr>
                  <td colSpan={8} className="admin-table-empty">
                    Loading orders…
                  </td>
                </tr>
              )}
              {!loading && !result.orders.length && (
                <tr>
                  <td colSpan={8} className="admin-table-empty">
                    {error
                      ? "Orders could not be loaded."
                      : "No orders in this date range."}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
      <nav className="admin-pagination" aria-label="Order pages">
        <button
          aria-label="Previous page"
          disabled={result.page <= 1 || loading}
          onClick={() => setPage(result.page - 1)}
        >
          <ChevronLeft size={15} />
        </button>
        {pages.map((p, i) => (
          <span key={p}>
            {i > 0 && p > pages[i - 1] + 1 && (
              <span className="admin-ellipsis">…</span>
            )}
            <button
              aria-label={`Page ${p}`}
              aria-current={p === result.page ? "page" : undefined}
              disabled={loading}
              onClick={() => setPage(p)}
            >
              {p}
            </button>
          </span>
        ))}
        <button
          aria-label="Next page"
          disabled={result.page >= result.totalPages || loading}
          onClick={() => setPage(result.page + 1)}
        >
          <ChevronRight size={15} />
        </button>
      </nav>
      <Dialog
        open={modal}
        onOpenChange={(open) => {
          if (!saving) setModal(open);
        }}
      >
        <DialogContent
          closeDisabled={saving}
          className="admin-modal admin-status-modal"
        >
          <DialogTitle>Change delivery state</DialogTitle>
          <DialogDescription className="admin-modal-description">
            Update {selected.length} selected{" "}
            {selected.length === 1 ? "order" : "orders"}.
          </DialogDescription>
          <div className="admin-status-options">
            {(Object.keys(statusLabels) as Status[]).map((s) => (
              <button
                key={s}
                className={status === s ? "chosen" : ""}
                onClick={() => setStatus(s)}
              >
                {statusLabels[s]}
              </button>
            ))}
          </div>
          {error && (
            <p className="admin-error" role="alert">
              {error}
            </p>
          )}
          <button
            className="admin-button admin-full-button"
            disabled={saving}
            onClick={() => void update(selected, status)}
          >
            {saving ? "Saving…" : "Save"}
          </button>
        </DialogContent>
      </Dialog>
    </>
  );
}
function OrderFoods({ order }: { order: AdminOrder }) {
  const [open, setOpen] = useState(false);
  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger
        className="admin-food-trigger"
        onMouseEnter={() => setOpen(true)}
        onClick={(e) => {
          e.preventDefault();
          setOpen(true);
        }}
      >
        {order.foodOrderItems.length}{" "}
        {order.foodOrderItems.length === 1 ? "food" : "foods"}
        <ChevronDown size={13} />
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          className="admin-popover admin-food-popover"
          onMouseLeave={() => setOpen(false)}
          onOpenAutoFocus={(e) => e.preventDefault()}
          sideOffset={5}
          align="start"
        >
          <h3>Order items</h3>
          {order.foodOrderItems.map((item, i) => (
            <div key={i}>
              <img src={item.food.image} alt="" />
              <span>{item.food.foodName}</span>
              <small>x {item.quantity}</small>
            </div>
          ))}
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
