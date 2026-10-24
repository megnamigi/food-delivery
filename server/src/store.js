import fs from "node:fs/promises";
import path from "node:path";
import { randomBytes } from "node:crypto";
import mongoose from "mongoose";
export const newId = () => randomBytes(12).toString("hex");
const timestamps = { timestamps: true, versionKey: false };
const schemas = {
  users: new mongoose.Schema(
    {
      email: { type: String, unique: true, required: true },
      password: String,
      phoneNumber: String,
      address: String,
      role: { type: String, enum: ["USER", "ADMIN"], default: "USER" },
      isVerified: { type: Boolean, default: false },
      authVersion: { type: Number, default: 0 },
    },
    timestamps,
  ),
  categories: new mongoose.Schema(
    { categoryName: { type: String, required: true } },
    timestamps,
  ),
  foods: new mongoose.Schema(
    {
      foodName: String,
      price: Number,
      image: String,
      ingredients: String,
      category: { type: mongoose.Schema.Types.ObjectId, ref: "Category" },
    },
    timestamps,
  ),
  orders: new mongoose.Schema(
    {
      user: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
      totalPrice: Number,
      shipping: Number,
      address: String,
      status: {
        type: String,
        enum: ["PENDING", "CANCELED", "DELIVERED"],
        default: "PENDING",
      },
      requestId: String,
      foodOrderItems: [
        {
          _id: false,
          food: { type: mongoose.Schema.Types.ObjectId, ref: "Food" },
          quantity: Number,
          unitPrice: Number,
          snapshot: mongoose.Schema.Types.Mixed,
        },
      ],
    },
    timestamps,
  ),
  tokens: new mongoose.Schema(
    {
      user: String,
      hash: { type: String, unique: true },
      kind: String,
      expiresAt: Date,
    },
    timestamps,
  ),
  sessions: new mongoose.Schema({ user: String, expiresAt: Date }, timestamps),
};
schemas.tokens.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
schemas.sessions.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
schemas.orders.index({ user: 1, requestId: 1 }, { unique: true });
const names = {
  users: "User",
  categories: "Category",
  foods: "Food",
  orders: "FoodOrder",
  tokens: "AuthToken",
  sessions: "Session",
};
export async function createStore({ uri, directory }) {
 if (uri) {
  if (mongoose.connection.readyState !== 1) {
    await mongoose.connect(uri, {
      serverSelectionTimeoutMS: 8000,
    });
  }
    const models = Object.fromEntries(
      Object.entries(schemas).map(([key, schema]) => [
        key,
        mongoose.model(names[key], schema),
      ]),
    );
    const plain = (value) => (value ? JSON.parse(JSON.stringify(value)) : null);
    return {
      mode: "mongodb",
      async list(table, filter = {}) {
        return plain(await models[table].find(filter).lean());
      },
      async one(table, filter) {
        return plain(await models[table].findOne(filter).lean());
      },
      async insert(table, data) {
        return plain(await models[table].create(data));
      },
      async update(table, id, data) {
        return plain(
          await models[table]
            .findByIdAndUpdate(
              id,
              { $set: data },
              { new: true, runValidators: true },
            )
            .lean(),
        );
      },
      async updateMany(table, ids, data) {
        await models[table].updateMany(
          { _id: { $in: ids } },
          { $set: data },
          { runValidators: true },
        );
        return plain(await models[table].find({ _id: { $in: ids } }).lean());
      },
      async remove(table, filter) {
        return plain(await models[table].findOneAndDelete(filter).lean());
      },
    };
  }
  if (process.env.NODE_ENV === "production")
    throw new Error("MONGODB_URI is required in production.");
  await fs.mkdir(directory, { recursive: true });
  const filename = path.join(directory, "database.json");
  let data;
  try {
    data = JSON.parse(await fs.readFile(filename, "utf8"));
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
    data = Object.fromEntries(Object.keys(schemas).map((k) => [k, []]));
  }
  let queue = Promise.resolve();
  const matches = (row, filter) =>
    Object.entries(filter).every(([k, v]) => row[k] === v);
  const clone = (x) => (x == null ? null : structuredClone(x));
  const mutate = (fn) => {
    const next = queue.then(async () => {
      const before = clone(data);
      try {
        const result = fn();
        const temp = filename + ".tmp";
        await fs.writeFile(temp, JSON.stringify(data, null, 2), {
          mode: 0o600,
        });
        await fs.rename(temp, filename);
        return clone(result);
      } catch (error) {
        data = before;
        throw error;
      }
    });
    queue = next.catch(() => {});
    return next;
  };
  return {
    mode: "local-development",
    async list(table, filter = {}) {
      await queue;
      return clone(data[table].filter((r) => matches(r, filter)));
    },
    async one(table, filter) {
      await queue;
      return clone(data[table].find((r) => matches(r, filter)));
    },
    insert(table, row) {
      return mutate(() => {
        if (table === "users" && data.users.some((u) => u.email === row.email))
          throw Object.assign(new Error("Email already registered."), {
            status: 409,
          });
        if (
          table === "orders" &&
          data.orders.some(
            (o) => o.user === row.user && o.requestId === row.requestId,
          )
        )
          throw Object.assign(new Error("Order already submitted."), {
            status: 409,
          });
        if (row._id && data[table].some((record) => record._id === row._id))
          throw Object.assign(new Error("Record already exists."), {
            status: 409,
          });
        const now = new Date().toISOString(),
          record = {
            ...row,
            _id: row._id || newId(),
            createdAt: row.createdAt || now,
            updatedAt: now,
          };
        data[table].push(record);
        return record;
      });
    },
    update(table, id, row) {
      return mutate(() => {
        const existing = data[table].find((r) => r._id === id);
        if (!existing) return null;
        Object.assign(existing, row, { updatedAt: new Date().toISOString() });
        return existing;
      });
    },
    updateMany(table, ids, row) {
      return mutate(() => {
        const selected = data[table].filter((record) =>
          ids.includes(record._id),
        );
        if (selected.length !== ids.length)
          throw Object.assign(new Error("One or more records do not exist."), {
            status: 404,
          });
        for (const record of selected)
          Object.assign(record, row, { updatedAt: new Date().toISOString() });
        return selected;
      });
    },
    remove(table, filter) {
      return mutate(() => {
        const index = data[table].findIndex((r) => matches(r, filter));
        return index < 0 ? null : data[table].splice(index, 1)[0];
      });
    },
  };
}
