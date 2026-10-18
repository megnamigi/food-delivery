import express from "express";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { registerAdminRoutes } from "./admin.js";
import cors from "cors";
import helmet from "helmet";
import cookieParser from "cookie-parser";
import { rateLimit } from "express-rate-limit";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import nodemailer from "nodemailer";
import { randomBytes, createHash } from "node:crypto";
import { z } from "zod";
const hash = (value) => createHash("sha256").update(value).digest("hex");
const cleanUser = ({ _id, email, role, isVerified, address }) => ({
  _id,
  email,
  role,
  isVerified,
  address,
});
const authFields = {
  email: z
    .email()
    .max(254)
    .transform((v) => v.toLowerCase()),
  password: z
    .string()
    .min(8)
    .max(72)
    .regex(/[a-zA-Z]/)
    .regex(/[0-9]/)
    .regex(/[^a-zA-Z0-9]/)
    .refine(
      (value) => Buffer.byteLength(value, "utf8") <= 72,
      "Password must be at most 72 bytes.",
    ),
};
const id = z.string().regex(/^[0-9a-f]{24}$/);
const fail = (status, message) => Object.assign(new Error(message), { status });
export function createApp({
  store,
  catalog,
  secret = randomBytes(48).toString("hex"),
  origin = "http://localhost:3000",
  test = false,
  uploadDirectory = path.resolve(
    path.dirname(fileURLToPath(import.meta.url)),
    "../.data/uploads",
  ),
}) {
  const app = express();
  const production = process.env.NODE_ENV === "production";
  if (production && !process.env.JWT_SECRET)
    throw new Error("JWT_SECRET is required in production.");
  const allowedOrigins = new Set([
    origin,
    ...(!production ? ["http://localhost:3001"] : []),
  ]);
  const cookieOptions = {
    httpOnly: true,
    secure: production,
    sameSite: "lax",
    path: "/",
  };
  app.disable("x-powered-by");
  app.use(helmet());
  app.use(cors({ origin: [...allowedOrigins], credentials: true }));
  app.use(express.json({ limit: "100kb" }));
  app.use(cookieParser());
  app.use((req, res, next) => {
    if (
      !["GET", "HEAD", "OPTIONS"].includes(req.method) &&
      req.headers.origin &&
      !allowedOrigins.has(req.headers.origin)
    )
      return res
        .status(403)
        .json({ message: "Request origin is not allowed." });
    next();
  });
  if (!test)
    app.use(
      "/auth",
      rateLimit({
        windowMs: 15 * 60 * 1000,
        limit: 60,
        standardHeaders: "draft-8",
        legacyHeaders: false,
        message: {
          message: "Too many attempts. Please try again in 15 minutes.",
        },
      }),
    );
  const signSession = (res, user, session) => {
    const payload = {
      sub: user._id,
      sid: session._id,
      ver: user.authVersion || 0,
    };
    res.cookie(
      "nomnom_access",
      jwt.sign(payload, secret, {
        expiresIn: "1h",
        issuer: "nomnom",
        audience: "nomnom-client",
      }),
      { ...cookieOptions, maxAge: 3600000 },
    );
    res.cookie(
      "nomnom_refresh",
      jwt.sign({ ...payload, kind: "refresh" }, secret, {
        expiresIn: "7d",
        issuer: "nomnom",
        audience: "nomnom-client",
      }),
      { ...cookieOptions, maxAge: 604800000 },
    );
  };
  const identity = async (token, refresh = false) => {
    let claims;
    try {
      claims = jwt.verify(token || "", secret, {
        algorithms: ["HS256"],
        issuer: "nomnom",
        audience: "nomnom-client",
      });
    } catch {
      throw fail(401, "Please log in to continue.");
    }
    if (Boolean(claims.kind === "refresh") !== refresh)
      throw fail(401, "Invalid session.");
    const [user, session] = await Promise.all([
      store.one("users", { _id: claims.sub }),
      store.one("sessions", { _id: claims.sid }),
    ]);
    if (
      !user ||
      !session ||
      session.user !== user._id ||
      !user.isVerified ||
      new Date(session.expiresAt) <= new Date() ||
      (user.authVersion || 0) !== claims.ver
    )
      throw fail(401, "Your session has expired. Please log in again.");
    return { user, session };
  };
  const requireAuth = async (req, res, next) => {
    try {
      Object.assign(req, await identity(req.cookies.nomnom_access));
      next();
    } catch (error) {
      next(error);
    }
  };
  const admin = (req, res, next) =>
    req.user.role === "ADMIN"
      ? next()
      : next(fail(403, "Admin access required."));
  const mailer = process.env.SMTP_HOST
    ? nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: Number(process.env.SMTP_PORT || 587),
        secure: process.env.SMTP_PORT === "465",
        auth: process.env.SMTP_USER
          ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD }
          : undefined,
      })
    : null;
  if (production && !mailer)
    throw new Error("SMTP configuration is required in production.");
  const issueLink = async (user, kind) => {
    const token = randomBytes(32).toString("hex");
    await store.insert("tokens", {
      user: user._id,
      hash: hash(token),
      kind,
      expiresAt: new Date(
        Date.now() + (kind === "verify" ? 24 * 3600000 : 30 * 60000),
      ).toISOString(),
    });
    const link = `${origin}/${kind === "verify" ? "verify-email" : "reset-password"}?token=${token}`;
    if (mailer) {
      await mailer.sendMail({
        from: process.env.SMTP_FROM || "NomNom <no-reply@localhost>",
        to: user.email,
        subject:
          kind === "verify"
            ? "Verify your NomNom account"
            : "Reset your NomNom password",
        text: `${kind === "verify" ? "Verify your email" : "Reset your password"}: ${link}\nThis link expires ${kind === "verify" ? "in 24 hours" : "in 30 minutes"}.`,
      });
      return { mailMode: "smtp" };
    }
    return { mailMode: "development", devLink: link };
  };
  app.get("/health", (_req, res) =>
    res.json({
      ok: true,
      storageMode: store.mode,
      mailMode: mailer ? "smtp" : "development",
    }),
  );
  app.get("/food-category", async (_req, res) =>
    res.json({ categories: await store.list("categories") }),
  );
  app.get("/food", async (req, res) => {
    let foods = await store.list("foods");
    if (req.query.search)
      foods = foods.filter((f) =>
        `${f.foodName} ${f.ingredients}`
          .toLowerCase()
          .includes(String(req.query.search).toLowerCase()),
      );
    res.json({ foods });
  });
  app.get("/food/:categoryId", async (req, res) => {
    id.parse(req.params.categoryId);
    res.json({
      foods: await store.list("foods", { category: req.params.categoryId }),
    });
  });
  app.post("/auth/sign-up", async (req, res) => {
    const { email, password } = z.object(authFields).parse(req.body);
    if (await store.one("users", { email }))
      throw fail(
        409,
        "An account with this email already exists. Please log in.",
      );
    const user = await store.insert("users", {
      email,
      password: await bcrypt.hash(password, 12),
      role: "USER",
      isVerified: false,
      authVersion: 0,
      address: "",
    });
    const delivery = await issueLink(user, "verify");
    res.status(201).json({
      message: "Please verify your email to activate your account.",
      email,
      ...delivery,
    });
  });
  app.post("/auth/resend-verification", async (req, res) => {
    const { email } = z.object({ email: authFields.email }).parse(req.body);
    const user = await store.one("users", { email });
    const delivery =
      user && !user.isVerified ? await issueLink(user, "verify") : {};
    res.json({
      message: "If this account needs verification, a new link has been sent.",
      ...delivery,
    });
  });
  app.post("/auth/verify-email", async (req, res) => {
    const { token } = z
      .object({ token: z.string().length(64) })
      .parse(req.body);
    const record = await store.one("tokens", {
      hash: hash(token),
      kind: "verify",
    });
    if (!record || new Date(record.expiresAt) <= new Date())
      throw fail(
        400,
        "This verification link has expired or has already been used.",
      );
    const consumed = await store.remove("tokens", { _id: record._id });
    if (!consumed) throw fail(400, "This link has already been used.");
    await store.update("users", record.user, { isVerified: true });
    res.json({ message: "Your email is verified. You can now log in." });
  });
  app.post("/auth/sign-in", async (req, res) => {
    const { email, password } = z
      .object({ email: authFields.email, password: z.string().min(1).max(72) })
      .parse(req.body);
    const user = await store.one("users", { email });
    const valid = await bcrypt.compare(
      password,
      user?.password ||
        "$2b$12$RnSsW/y6FV/fTSp8xLwr3eWJzIncbXNLVBIaLG2rKCJrQUz3HB5RO",
    );
    if (!user || !valid) throw fail(401, "Email or password is incorrect.");
    if (!user.isVerified)
      throw fail(403, "Please verify your email before logging in.");
    const session = await store.insert("sessions", {
      user: user._id,
      expiresAt: new Date(Date.now() + 604800000).toISOString(),
    });
    signSession(res, user, session);
    res.json({ user: cleanUser(user) });
  });
  app.get("/auth/me", requireAuth, (req, res) =>
    res.json({ user: cleanUser(req.user) }),
  );
  app.get("/auth/refresh", async (req, res) => {
    const { user, session } = await identity(req.cookies.nomnom_refresh, true);
    await store.update("sessions", session._id, {
      expiresAt: new Date(Date.now() + 604800000).toISOString(),
    });
    signSession(res, user, session);
    res.json({ user: cleanUser(user) });
  });
  app.post("/auth/sign-out", async (req, res) => {
    try {
      const { session } = await identity(req.cookies.nomnom_refresh, true);
      await store.remove("sessions", { _id: session._id });
    } catch {}
    res.clearCookie("nomnom_access", cookieOptions);
    res.clearCookie("nomnom_refresh", cookieOptions);
    res.json({ ok: true });
  });
  app.post("/auth/reset-password-request", async (req, res) => {
    const { email } = z.object({ email: authFields.email }).parse(req.body);
    const user = await store.one("users", { email });
    const delivery = user ? await issueLink(user, "reset") : {};
    res.json({
      message:
        "If this email is registered, you will receive a password reset link.",
      ...delivery,
    });
  });
  app.get("/auth/verify-reset-password-request", async (req, res) => {
    const token = z.string().length(64).parse(req.query.token);
    const record = await store.one("tokens", {
      hash: hash(token),
      kind: "reset",
    });
    if (!record || new Date(record.expiresAt) <= new Date())
      throw fail(400, "This reset link has expired or has already been used.");
    res.json({ valid: true });
  });
  app.post("/auth/reset-password", async (req, res) => {
    const { token, password } = z
      .object({ token: z.string().length(64), password: authFields.password })
      .parse(req.body);
    const record = await store.one("tokens", {
      hash: hash(token),
      kind: "reset",
    });
    if (!record || new Date(record.expiresAt) <= new Date())
      throw fail(400, "This reset link has expired or has already been used.");
    const passwordHash = await bcrypt.hash(password, 12);
    const consumed = await store.remove("tokens", { _id: record._id });
    if (!consumed) throw fail(400, "This link has already been used.");
    const user = await store.one("users", { _id: record.user });
    await store.update("users", user._id, {
      password: passwordHash,
      authVersion: (user.authVersion || 0) + 1,
    });
    for (const t of await store.list("tokens", {
      user: user._id,
      kind: "reset",
    }))
      await store.remove("tokens", { _id: t._id });
    res.clearCookie("nomnom_access", cookieOptions);
    res.clearCookie("nomnom_refresh", cookieOptions);
    res.json({ message: "Your password has been updated. Please log in." });
  });
  const orderOutput = (order) => ({
    ...order,
    foodOrderItems: order.foodOrderItems.map((i) => ({
      food: i.snapshot,
      quantity: i.quantity,
      unitPrice: i.unitPrice,
    })),
  });
  app.post("/food-order", requireAuth, async (req, res) => {
    const { foodOrderItems, address, requestId } = z
      .object({
        foodOrderItems: z
          .array(
            z.object({ food: id, quantity: z.number().int().min(1).max(20) }),
          )
          .min(1)
          .max(50),
        address: z.string().trim().min(8).max(500),
        requestId: z.string().min(12).max(100),
      })
      .parse(req.body);
    const existing = await store.one("orders", {
      user: req.user._id,
      requestId,
    });
    if (existing) return res.json({ order: orderOutput(existing) });
    if (
      new Set(foodOrderItems.map((i) => i.food)).size !== foodOrderItems.length
    )
      throw fail(400, "Duplicate foods are not allowed.");
    const all = await store.list("foods");
    let subtotal = 0;
    const items = foodOrderItems.map((i) => {
      const food = all.find((f) => f._id === i.food);
      if (!food)
        throw fail(
          400,
          "A selected food is no longer available. Please refresh the menu.",
        );
      subtotal += Math.round(food.price * 100) * i.quantity;
      return {
        food: food._id,
        quantity: i.quantity,
        unitPrice: food.price,
        snapshot: food,
      };
    });
    const order = await store.insert("orders", {
      user: req.user._id,
      totalPrice: (subtotal + 99) / 100,
      shipping: 0.99,
      address,
      status: "PENDING",
      requestId,
      foodOrderItems: items,
    });
    await store.update("users", req.user._id, { address });
    res.status(201).json({ order: orderOutput(order) });
  });
  app.get("/food-order", requireAuth, async (req, res) => {
    const rows = await store.list(
      "orders",
      req.user.role === "ADMIN" ? {} : { user: req.user._id },
    );
    res.json({
      orders: rows
        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
        .map(orderOutput),
    });
  });
  app.get("/food-order/:userId", requireAuth, async (req, res) => {
    id.parse(req.params.userId);
    if (req.user.role !== "ADMIN" && req.params.userId !== req.user._id)
      throw fail(403, "You can only view your own orders.");
    res.json({
      orders: (await store.list("orders", { user: req.params.userId })).map(
        orderOutput,
      ),
    });
  });
  app.patch(
    "/food-order/:foodOrderId",
    requireAuth,
    admin,
    async (req, res) => {
      const { status } = z
        .object({ status: z.enum(["PENDING", "CANCELED", "DELIVERED"]) })
        .parse(req.body);
      const order = await store.update(
        "orders",
        id.parse(req.params.foodOrderId),
        { status },
      );
      if (!order) throw fail(404, "Order not found.");
      res.json({ order: orderOutput(order) });
    },
  );
  const foodSchema = z.object({
    foodName: z.string().trim().min(1).max(100),
    price: z
      .number()
      .positive()
      .max(10000)
      .refine(
        (n) =>
          Number.isInteger(Math.round(n * 100)) &&
          Math.abs(n * 100 - Math.round(n * 100)) < 1e-7,
      ),
    image: z
      .string()
      .min(1)
      .max(2000)
      .refine(
        (s) =>
          s.startsWith("/images/") ||
          s.startsWith("/api/uploads/") ||
          s.startsWith("https://"),
      ),
    ingredients: z.string().trim().min(1).max(1000),
    category: id,
  });
  app.post("/food", requireAuth, admin, async (req, res) => {
    const data = foodSchema.parse(req.body);
    if (!(await store.one("categories", { _id: data.category })))
      throw fail(400, "Category not found.");
    res.status(201).json({ food: await store.insert("foods", data) });
  });
  app.patch("/food/:foodId", requireAuth, admin, async (req, res) => {
    const data = foodSchema.partial().parse(req.body);
    if (
      data.category &&
      !(await store.one("categories", { _id: data.category }))
    )
      throw fail(400, "Category not found.");
    const food = await store.update("foods", id.parse(req.params.foodId), data);
    if (!food) throw fail(404, "Food not found.");
    res.json({ food });
  });
  // Undo receipts are server-owned, short lived, and bound to the deleting admin.
  const deletedFoods = new Map();
  app.delete("/food/:foodId", requireAuth, admin, async (req, res) => {
    const removed = await store.remove("foods", {
      _id: id.parse(req.params.foodId),
    });
    if (!removed) throw fail(404, "Food not found.");
    for (const [key, value] of deletedFoods)
      if (value.expiresAt < Date.now()) deletedFoods.delete(key);
    const undoToken = randomBytes(32).toString("hex");
    deletedFoods.set(undoToken, {
      food: removed,
      user: req.user._id,
      expiresAt: Date.now() + 60000,
    });
    setTimeout(() => deletedFoods.delete(undoToken), 60000).unref();
    res.json({ ok: true, undoToken, undoSeconds: 60 });
  });
  app.post("/food/:foodId/restore", requireAuth, admin, async (req, res) => {
    const foodId = id.parse(req.params.foodId);
    const { undoToken } = z
      .object({ undoToken: z.string().length(64) })
      .parse(req.body);
    const receipt = deletedFoods.get(undoToken);
    if (
      !receipt ||
      receipt.food._id !== foodId ||
      receipt.user !== req.user._id ||
      receipt.expiresAt < Date.now()
    )
      throw fail(
        400,
        "This undo link has expired. Add the dish again if needed.",
      );
    if (!(await store.one("categories", { _id: receipt.food.category })))
      throw fail(409, "The original category no longer exists.");
    if (await store.one("foods", { _id: foodId }))
      throw fail(409, "This dish has already been restored.");
    deletedFoods.delete(undoToken);
    try {
      res.json({ food: await store.insert("foods", receipt.food) });
    } catch (error) {
      deletedFoods.set(undoToken, receipt);
      throw error;
    }
  });
  app.post("/food-category", requireAuth, admin, async (req, res) => {
    const data = z
      .object({ categoryName: z.string().trim().min(1).max(80) })
      .parse(req.body);
    res.status(201).json({ category: await store.insert("categories", data) });
  });
  app.patch(
    "/food-category/:categoryId",
    requireAuth,
    admin,
    async (req, res) => {
      const data = z
        .object({ categoryName: z.string().trim().min(1).max(80) })
        .parse(req.body);
      const category = await store.update(
        "categories",
        id.parse(req.params.categoryId),
        data,
      );
      if (!category) throw fail(404, "Category not found.");
      res.json({ category });
    },
  );
  app.delete(
    "/food-category/:categoryId",
    requireAuth,
    admin,
    async (req, res) => {
      const categoryId = id.parse(req.params.categoryId);
      if ((await store.list("foods", { category: categoryId })).length)
        throw fail(409, "Move or remove the foods in this category first.");
      if (!(await store.remove("categories", { _id: categoryId })))
        throw fail(404, "Category not found.");
      res.json({ ok: true });
    },
  );
  registerAdminRoutes(app, {
    store,
    requireAuth,
    admin,
    orderOutput,
    uploadDirectory,
  });
  app.use((_req, res) =>
    res.status(404).json({ message: "Endpoint not found." }),
  );
  app.use((error, _req, res, _next) => {
    if (error instanceof z.ZodError)
      return res.status(400).json({
        message: "Please check the form fields and try again.",
        fields: error.flatten().fieldErrors,
      });
    const status = error.status || (error.code === 11000 ? 409 : 500);
    if (status >= 500 && !test) console.error(error.message);
    res.status(status).json({
      message:
        status >= 500
          ? "The server could not complete this request. Please try again."
          : error.message,
    });
  });
  return app;
}
