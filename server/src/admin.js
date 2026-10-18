import { z } from "zod";
import express from "express";
import multer from "multer";
import sharp from "sharp";
import { v2 as cloudinary } from "cloudinary";
import fs from "node:fs/promises";
import path from "node:path";
import { randomBytes } from "node:crypto";
const fail = (status, message) => Object.assign(new Error(message), { status });
const identifier = z.string().regex(/^[0-9a-f]{24}$/);
const state = z.enum(["PENDING", "DELIVERED", "CANCELED"]);
const date = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine((value) => {
    const d = new Date(value + "T00:00:00Z");
    return !Number.isNaN(d.valueOf()) && d.toISOString().slice(0, 10) === value;
  }, "Invalid date");
const querySchema = z
  .object({
    page: z.coerce.number().int().min(1).max(100000).default(1),
    pageSize: z.coerce.number().int().min(1).max(100).default(12),
    from: date.optional(),
    to: date.optional(),
    sort: z
      .enum(["date-desc", "date-asc", "status-asc", "status-desc"])
      .default("date-desc"),
  })
  .refine((q) => !q.from || !q.to || q.from <= q.to, {
    message: "Start date must be before end date.",
  });
export function registerAdminRoutes(
  app,
  { store, requireAuth, admin, orderOutput, uploadDirectory },
) {
  const withCustomer = async (orders) => {
    const users = await store.list("users");
    const lookup = new Map(users.map((user) => [user._id, user]));
    return orders.map((order) => ({
      ...orderOutput(order),
      customer: {
        _id: order.user,
        email: lookup.get(order.user)?.email || "Deleted account",
      },
    }));
  };
  app.get("/admin/orders", requireAuth, admin, async (req, res) => {
    const query = querySchema.parse(req.query);
    let rows = await store.list("orders");
    if (query.from) {
      const start = new Date(query.from + "T00:00:00+08:00");
      rows = rows.filter((row) => new Date(row.createdAt) >= start);
    }
    if (query.to) {
      const end = new Date(
        new Date(query.to + "T00:00:00+08:00").valueOf() + 86400000,
      );
      rows = rows.filter((row) => new Date(row.createdAt) < end);
    }
    const rank = { PENDING: 0, DELIVERED: 1, CANCELED: 2 };
    rows.sort((a, b) => {
      const difference = query.sort.startsWith("status")
        ? rank[a.status] - rank[b.status]
        : new Date(a.createdAt) - new Date(b.createdAt);
      return (
        (query.sort.endsWith("desc") ? -difference : difference) ||
        a._id.localeCompare(b._id)
      );
    });
    const total = rows.length,
      totalPages = Math.max(1, Math.ceil(total / query.pageSize)),
      page = Math.min(query.page, totalPages);
    res.json({
      orders: await withCustomer(
        rows.slice((page - 1) * query.pageSize, page * query.pageSize),
      ),
      page,
      pageSize: query.pageSize,
      total,
      totalPages,
    });
  });
  app.patch("/admin/orders/status", requireAuth, admin, async (req, res) => {
    const { orderIds, status } = z
      .object({
        orderIds: z
          .array(identifier)
          .min(1)
          .max(100)
          .refine(
            (ids) => new Set(ids).size === ids.length,
            "Duplicate orders are not allowed.",
          ),
        status: state,
      })
      .parse(req.body);
    const ids = new Set(orderIds),
      rows = (await store.list("orders")).filter((row) => ids.has(row._id));
    if (rows.length !== orderIds.length)
      throw fail(
        404,
        "One or more selected orders no longer exist. Refresh and try again.",
      );
    await store.updateMany("orders", orderIds, { status });
    res.json({ updatedCount: orderIds.length, status });
  });
  const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 5 * 1024 * 1024, files: 1 },
    fileFilter: (_req, file, done) => {
      if (!["image/jpeg", "image/png", "image/webp"].includes(file.mimetype))
        return done(fail(400, "Choose a JPG, PNG, or WebP image."));
      done(null, true);
    },
  });
  app.use(
    "/uploads",
    express.static(uploadDirectory, {
      maxAge: "1y",
      immutable: true,
      dotfiles: "deny",
      index: false,
    }),
  );
  app.post(
    "/uploads",
    requireAuth,
    admin,
    (req, res, next) =>
      upload.single("image")(req, res, (error) =>
        error
          ? next(
              fail(
                error.code === "LIMIT_FILE_SIZE" ? 413 : 400,
                error.code === "LIMIT_FILE_SIZE"
                  ? "Image must be smaller than 5 MB."
                  : error.message,
              ),
            )
          : next(),
      ),
    async (req, res) => {
      if (!req.file) throw fail(400, "Choose an image to upload.");
      let buffer;
      try {
        buffer = await sharp(req.file.buffer, { limitInputPixels: 20000000 })
          .rotate()
          .resize({
            width: 1600,
            height: 1600,
            fit: "inside",
            withoutEnlargement: true,
          })
          .webp({ quality: 85 })
          .toBuffer();
      } catch {
        throw fail(
          400,
          "This image could not be read. Choose a valid JPG, PNG, or WebP image under 20 megapixels.",
        );
      }
      const configured =
        process.env.CLOUDINARY_CLOUD_NAME &&
        process.env.CLOUDINARY_API_KEY &&
        process.env.CLOUDINARY_API_SECRET;
      if (configured) {
        cloudinary.config({
          cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
          api_key: process.env.CLOUDINARY_API_KEY,
          api_secret: process.env.CLOUDINARY_API_SECRET,
          secure: true,
        });
        const result = await cloudinary.uploader.upload(
          `data:image/webp;base64,${buffer.toString("base64")}`,
          { folder: "nomnom-foods", resource_type: "image" },
        );
        return res
          .status(201)
          .json({ image: result.secure_url, storage: "cloudinary" });
      }
      if (process.env.NODE_ENV === "production")
        throw fail(503, "Image uploads require Cloudinary configuration.");
      await fs.mkdir(uploadDirectory, { recursive: true });
      const name = randomBytes(18).toString("hex") + ".webp";
      await fs.writeFile(path.join(uploadDirectory, name), buffer, {
        mode: 0o600,
      });
      res
        .status(201)
        .json({ image: `/api/uploads/${name}`, storage: "local-development" });
    },
  );
}
