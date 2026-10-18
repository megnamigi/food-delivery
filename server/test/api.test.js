import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { createHash } from "node:crypto";
import { createStore } from "../src/store.js";
import { createApp } from "../src/app.js";
const catalog = JSON.parse(
  await fs.readFile(new URL("../src/catalog.json", import.meta.url), "utf8"),
);
async function fixture(t) {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "nomnom-test-"));
  const store = await createStore({ directory: dir });
  for (const row of catalog.categories) await store.insert("categories", row);
  for (const row of catalog.foods) await store.insert("foods", row);
  const server = createApp({
    store,
    catalog,
    test: true,
    uploadDirectory: path.join(dir, "uploads"),
  }).listen(0, "127.0.0.1");
  await new Promise((resolve) => server.once("listening", resolve));
  t.after(async () => {
    await new Promise((resolve) => server.close(resolve));
    await fs.rm(dir, { recursive: true, force: true });
  });
  const base = `http://127.0.0.1:${server.address().port}`;
  const request = async (
    url,
    { method = "GET", body, cookie, origin } = {},
  ) => {
    const response = await fetch(base + url, {
      method,
      headers: {
        ...(body instanceof FormData
          ? {}
          : { "content-type": "application/json" }),
        ...(cookie ? { cookie } : {}),
        ...(origin ? { origin } : {}),
      },
      body:
        body instanceof FormData
          ? body
          : body
            ? JSON.stringify(body)
            : undefined,
    });
    return {
      status: response.status,
      data: await response.json(),
      cookie: response.headers
        .getSetCookie()
        .map((c) => c.split(";")[0])
        .join("; "),
    };
  };
  return { store, request, base };
}
async function account(request, email = "test@example.com") {
  const signup = await request("/auth/sign-up", {
    method: "POST",
    body: { email, password: "LocalTest123!" },
  });
  assert.equal(signup.status, 201);
  const token = new URL(signup.data.devLink).searchParams.get("token");
  assert.equal(
    (await request("/auth/verify-email", { method: "POST", body: { token } }))
      .status,
    200,
  );
  const login = await request("/auth/sign-in", {
    method: "POST",
    body: { email, password: "LocalTest123!" },
  });
  assert.equal(login.status, 200);
  return login;
}
test("signup hashes passwords, requires verification, and rejects reused verification links", async (t) => {
  const { request, store } = await fixture(t);
  const signup = await request("/auth/sign-up", {
    method: "POST",
    body: { email: "FIRST@example.com", password: "LocalTest123!" },
  });
  assert.equal(signup.status, 201);
  assert.equal(signup.data.mailMode, "development");
  const saved = await store.one("users", { email: "first@example.com" });
  assert.notEqual(saved.password, "LocalTest123!");
  assert.match(saved.password, /^\$2/);
  assert.equal(
    (
      await request("/auth/sign-in", {
        method: "POST",
        body: { email: "first@example.com", password: "LocalTest123!" },
      })
    ).status,
    403,
  );
  const token = new URL(signup.data.devLink).searchParams.get("token");
  assert.equal(
    (await request("/auth/verify-email", { method: "POST", body: { token } }))
      .status,
    200,
  );
  assert.equal(
    (await request("/auth/verify-email", { method: "POST", body: { token } }))
      .status,
    400,
  );
});
test("server calculates prices and shipping; repeated checkout is idempotent", async (t) => {
  const { request } = await fixture(t);
  const login = await account(request);
  const body = {
    foodOrderItems: [{ food: catalog.foods[0]._id, quantity: 2 }],
    address: "Sample district, building 1, apartment 2",
    requestId: "test-request-123456",
    totalPrice: 0.01,
  };
  const first = await request("/food-order", {
    method: "POST",
    cookie: login.cookie,
    body,
  });
  assert.equal(first.status, 201);
  assert.equal(first.data.order.totalPrice, 26.97);
  assert.equal(first.data.order.status, "PENDING");
  const second = await request("/food-order", {
    method: "POST",
    cookie: login.cookie,
    body,
  });
  assert.equal(second.status, 200);
  assert.equal(second.data.order._id, first.data.order._id);
  assert.equal(
    (await request("/food-order", { cookie: login.cookie })).data.orders.length,
    1,
  );
});
test("users cannot read other orders or change order status, and anonymous checkout is rejected", async (t) => {
  const { request } = await fixture(t);
  assert.equal(
    (await request("/food-order", { method: "POST", body: {} })).status,
    401,
  );
  const alice = await account(request, "alice@example.com"),
    bob = await account(request, "bob@example.com");
  assert.equal(
    (
      await request("/food-order/" + alice.data.user._id, {
        cookie: bob.cookie,
      })
    ).status,
    403,
  );
  assert.equal(
    (
      await request("/food-order/000000000000000000000001", {
        method: "PATCH",
        cookie: bob.cookie,
        body: { status: "DELIVERED" },
      })
    ).status,
    403,
  );
  assert.equal(
    (await request("/food", { method: "POST", cookie: bob.cookie, body: {} }))
      .status,
    403,
  );
});
test("invalid quantities, duplicate foods, missing addresses, and spoofed origins are rejected", async (t) => {
  const { request } = await fixture(t);
  const login = await account(request);
  assert.equal(
    (
      await request("/auth/sign-out", {
        method: "POST",
        cookie: login.cookie,
        origin: "https://untrusted.example",
      })
    ).status,
    403,
  );
  const body = {
    foodOrderItems: [{ food: catalog.foods[0]._id, quantity: 0 }],
    address: "Sample district building 1",
    requestId: "test-invalid-123456",
  };
  assert.equal(
    (
      await request("/food-order", {
        method: "POST",
        cookie: login.cookie,
        body,
      })
    ).status,
    400,
  );
  body.foodOrderItems[0].quantity = 1;
  body.address = "";
  assert.equal(
    (
      await request("/food-order", {
        method: "POST",
        cookie: login.cookie,
        body,
      })
    ).status,
    400,
  );
  body.address = "Sample district building 1";
  body.foodOrderItems.push({ ...body.foodOrderItems[0] });
  assert.equal(
    (
      await request("/food-order", {
        method: "POST",
        cookie: login.cookie,
        body,
      })
    ).status,
    400,
  );
});
test("password reset is one-time, invalidates sessions, and expired reset tokens fail", async (t) => {
  const { request, store } = await fixture(t);
  const login = await account(request);
  const reset = await request("/auth/reset-password-request", {
    method: "POST",
    body: { email: "test@example.com" },
  });
  const token = new URL(reset.data.devLink).searchParams.get("token");
  assert.equal(
    (await request("/auth/verify-reset-password-request?token=" + token))
      .status,
    200,
  );
  assert.equal(
    (
      await request("/auth/reset-password", {
        method: "POST",
        body: { token, password: "NewPassword123!" },
      })
    ).status,
    200,
  );
  assert.equal(
    (
      await request("/auth/reset-password", {
        method: "POST",
        body: { token, password: "AnotherPassword1!" },
      })
    ).status,
    400,
  );
  assert.equal(
    (await request("/auth/me", { cookie: login.cookie })).status,
    401,
  );
  assert.equal(
    (
      await request("/auth/sign-in", {
        method: "POST",
        body: { email: "test@example.com", password: "LocalTest123!" },
      })
    ).status,
    401,
  );
  assert.equal(
    (
      await request("/auth/sign-in", {
        method: "POST",
        body: { email: "test@example.com", password: "NewPassword123!" },
      })
    ).status,
    200,
  );
  const another = await request("/auth/reset-password-request", {
    method: "POST",
    body: { email: "test@example.com" },
  });
  const expired = new URL(another.data.devLink).searchParams.get("token");
  const record = await store.one("tokens", {
    hash: createHash("sha256").update(expired).digest("hex"),
  });
  await store.update("tokens", record._id, {
    expiresAt: new Date(0).toISOString(),
  });
  assert.equal(
    (await request("/auth/verify-reset-password-request?token=" + expired))
      .status,
    400,
  );
});
test("logout revokes the active session and keeps unrelated sessions valid", async (t) => {
  const { request } = await fixture(t);
  const first = await account(request);
  const second = await request("/auth/sign-in", {
    method: "POST",
    body: { email: "test@example.com", password: "LocalTest123!" },
  });
  assert.equal(
    (await request("/auth/sign-out", { method: "POST", cookie: first.cookie }))
      .status,
    200,
  );
  assert.equal(
    (await request("/auth/me", { cookie: first.cookie })).status,
    401,
  );
  assert.equal(
    (await request("/auth/refresh", { cookie: first.cookie })).status,
    401,
  );
  assert.equal(
    (await request("/auth/me", { cookie: second.cookie })).status,
    200,
  );
});

async function administrator(request, store, email = "admin@example.com") {
  const login = await account(request, email);
  await store.update("users", login.data.user._id, { role: "ADMIN" });
  return login;
}
async function sampleOrder(store, user, createdAt, status = "PENDING") {
  const food = catalog.foods[0];
  const order = await store.insert("orders", {
    user,
    requestId: crypto.randomUUID(),
    address: "Sukhbaatar district, office 4",
    status,
    totalPrice: 26.97,
    shipping: 0.99,
    foodOrderItems: [
      { food: food._id, snapshot: food, quantity: 2, unitPrice: food.price },
    ],
  });
  return store.update("orders", order._id, { createdAt });
}
test("admin list guards roles, paginates, sorts and exposes only customer identity", async (t) => {
  const { request, store } = await fixture(t);
  const admin = await administrator(request, store),
    user = await account(request, "buyer@example.com");
  assert.equal((await request("/admin/orders")).status, 401);
  assert.equal(
    (await request("/admin/orders", { cookie: user.cookie })).status,
    403,
  );
  for (let i = 0; i < 14; i++)
    await sampleOrder(
      store,
      user.data.user._id,
      new Date(Date.UTC(2026, 9, 10 + i, 6)).toISOString(),
      i % 2 ? "DELIVERED" : "PENDING",
    );
  const result = await request("/admin/orders?sort=date-asc&page=2", {
    cookie: admin.cookie,
  });
  assert.equal(result.status, 200);
  assert.equal(result.data.total, 14);
  assert.equal(result.data.totalPages, 2);
  assert.equal(result.data.orders.length, 2);
  assert.equal(result.data.page, 2);
  assert.deepEqual(Object.keys(result.data.orders[0].customer).sort(), [
    "_id",
    "email",
  ]);
  assert.equal(result.data.orders[0].customer.email, "buyer@example.com");
  assert.ok(!JSON.stringify(result.data).includes("password"));
  const sorted = await request("/admin/orders?sort=status-asc", {
    cookie: admin.cookie,
  });
  assert.equal(sorted.data.orders[0].status, "PENDING");
  assert.equal(sorted.data.orders.at(-1).status, "DELIVERED");
  assert.equal(
    (await request("/admin/orders?page=0", { cookie: admin.cookie })).status,
    400,
  );
  const clamped = await request("/admin/orders?page=999", {
    cookie: admin.cookie,
  });
  assert.equal(clamped.data.page, 2);
});
test("order date filter includes Ulaanbaatar day boundaries and rejects invalid ranges", async (t) => {
  const { request, store } = await fixture(t),
    admin = await administrator(request, store);
  for (const date of [
    "2026-10-14T15:59:59.999Z",
    "2026-10-14T16:00:00.000Z",
    "2026-10-15T15:59:59.999Z",
    "2026-10-15T16:00:00.000Z",
  ])
    await sampleOrder(store, admin.data.user._id, date);
  const filtered = await request(
    "/admin/orders?from=2026-10-15&to=2026-10-15",
    { cookie: admin.cookie },
  );
  assert.equal(filtered.status, 200);
  assert.equal(filtered.data.total, 2);
  for (const query of ["from=2026-02-30", "from=2026-10-17&to=2026-10-15"])
    assert.equal(
      (await request("/admin/orders?" + query, { cookie: admin.cookie }))
        .status,
      400,
    );
});
test("bulk order status validates every selected order before changing records", async (t) => {
  const { request, store } = await fixture(t),
    admin = await administrator(request, store),
    user = await account(request, "customer@example.com");
  const first = await sampleOrder(
      store,
      user.data.user._id,
      "2026-10-15T00:00:00Z",
    ),
    second = await sampleOrder(
      store,
      user.data.user._id,
      "2026-10-15T01:00:00Z",
    );
  const body = { orderIds: [first._id, second._id], status: "DELIVERED" };
  assert.equal(
    (
      await request("/admin/orders/status", {
        method: "PATCH",
        cookie: user.cookie,
        body,
      })
    ).status,
    403,
  );
  assert.equal(
    (
      await request("/admin/orders/status", {
        method: "PATCH",
        cookie: admin.cookie,
        body: { ...body, orderIds: [first._id, "000000000000000000000099"] },
      })
    ).status,
    404,
  );
  assert.equal(
    (await store.one("orders", { _id: first._id })).status,
    "PENDING",
  );
  assert.equal(
    (
      await request("/admin/orders/status", {
        method: "PATCH",
        cookie: admin.cookie,
        body: { ...body, orderIds: [first._id, first._id] },
      })
    ).status,
    400,
  );
  const saved = await request("/admin/orders/status", {
    method: "PATCH",
    cookie: admin.cookie,
    body,
  });
  assert.equal(saved.status, 200);
  assert.equal(saved.data.updatedCount, 2);
  const history = await request("/food-order", { cookie: user.cookie });
  assert.ok(history.data.orders.every((o) => o.status === "DELIVERED"));
});
test("dish edit moves categories; delete and one-time undo preserve order snapshots", async (t) => {
  const { request, store } = await fixture(t),
    admin = await administrator(request, store),
    other = await administrator(request, store, "other-admin@example.com");
  const original = catalog.foods[0];
  const order = await sampleOrder(
    store,
    admin.data.user._id,
    "2026-10-15T12:00:00Z",
  );
  const edited = await request(`/food/${original._id}`, {
    method: "PATCH",
    cookie: admin.cookie,
    body: {
      foodName: "Edited appetizer",
      category: catalog.categories[1]._id,
      price: 19.95,
    },
  });
  assert.equal(edited.status, 200);
  assert.equal(edited.data.food.category, catalog.categories[1]._id);
  assert.equal(
    (
      await request(`/food/${original._id}`, {
        method: "PATCH",
        cookie: admin.cookie,
        body: { price: 1.234 },
      })
    ).status,
    400,
  );
  const deleted = await request(`/food/${original._id}`, {
    method: "DELETE",
    cookie: admin.cookie,
  });
  assert.equal(deleted.status, 200);
  assert.equal(await store.one("foods", { _id: original._id }), null);
  const history = await request("/food-order", { cookie: admin.cookie });
  assert.equal(
    history.data.orders.find((o) => o._id === order._id).foodOrderItems[0].food
      .foodName,
    original.foodName,
  );
  const restoreBody = {
    method: "POST",
    cookie: admin.cookie,
    body: { undoToken: deleted.data.undoToken },
  };
  assert.equal(
    (
      await request(`/food/${original._id}/restore`, {
        ...restoreBody,
        cookie: other.cookie,
      })
    ).status,
    400,
  );
  const restored = await request(`/food/${original._id}/restore`, restoreBody);
  assert.equal(restored.status, 200);
  assert.equal(restored.data.food._id, original._id);
  assert.equal(restored.data.food.foodName, "Edited appetizer");
  assert.equal(
    (await request(`/food/${original._id}/restore`, restoreBody)).status,
    400,
  );
});
test("image upload checks admin, validates image bytes and saves a normalized local WebP", async (t) => {
  const { request, store, base } = await fixture(t),
    admin = await administrator(request, store),
    user = await account(request, "uploader@example.com");
  const sharp = (await import("sharp")).default;
  const buffer = await sharp({
    create: { width: 10, height: 10, channels: 3, background: "red" },
  })
    .png()
    .toBuffer();
  const form = () => {
    const data = new FormData();
    data.append("image", new Blob([buffer], { type: "image/png" }), "meal.png");
    return data;
  };
  assert.equal(
    (
      await request("/uploads", {
        method: "POST",
        cookie: user.cookie,
        body: form(),
      })
    ).status,
    403,
  );
  const bad = new FormData();
  bad.append(
    "image",
    new Blob(["invalid bytes"], { type: "image/png" }),
    "not-a-photo.png",
  );
  assert.equal(
    (
      await request("/uploads", {
        method: "POST",
        cookie: admin.cookie,
        body: bad,
      })
    ).status,
    400,
  );
  const saved = await request("/uploads", {
    method: "POST",
    cookie: admin.cookie,
    body: form(),
  });
  assert.equal(saved.status, 201);
  assert.match(saved.data.image, /^\/api\/uploads\/[a-f0-9]+\.webp$/);
  const image = await fetch(base + saved.data.image.replace(/^\/api/, ""));
  assert.equal(image.status, 200);
  assert.equal(image.headers.get("content-type"), "image/webp");
  const metadata = await sharp(
    Buffer.from(await image.arrayBuffer()),
  ).metadata();
  assert.equal(metadata.format, "webp");
  const added = await request("/food", {
    method: "POST",
    cookie: admin.cookie,
    body: {
      foodName: "Uploaded meal",
      price: 12.99,
      ingredients: "Rice, vegetables",
      category: catalog.categories[0]._id,
      image: saved.data.image,
    },
  });
  assert.equal(added.status, 201);
  const category = await request("/food-category", {
    method: "POST",
    cookie: admin.cookie,
    body: { categoryName: "New category" },
  });
  assert.equal(category.status, 201);
  assert.equal(
    (
      await request(`/food-category/${catalog.categories[0]._id}`, {
        method: "DELETE",
        cookie: admin.cookie,
      })
    ).status,
    409,
  );
});
