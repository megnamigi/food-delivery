import path from "node:path";
import { fileURLToPath } from "node:url";
import { createStore } from "./store.js";
import { createApp } from "./app.js";
import fs from "node:fs/promises";
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const catalog = JSON.parse(
  await fs.readFile(path.join(root, "src/catalog.json"), "utf8"),
);
const store = await createStore({
  uri: process.env.MONGODB_URI,
  directory: path.join(root, ".data"),
});
if (!(await store.list("categories")).length)
  for (const row of catalog.categories) await store.insert("categories", row);
if (!(await store.list("foods")).length)
  for (const row of catalog.foods) await store.insert("foods", row);
const app = createApp({
  store,
  catalog,
  secret: process.env.JWT_SECRET || undefined,
  origin: process.env.CLIENT_ORIGIN || "http://localhost:3000",
});
const port = Number(process.env.PORT || 4000),
  host = process.env.NODE_ENV === "production" ? "0.0.0.0" : "127.0.0.1";
const server = app.listen(port, host, () =>
  console.log(`NomNom API: http://${host}:${port} · storage: ${store.mode}`),
);
for (const signal of ["SIGTERM", "SIGINT"])
  process.on(signal, () => server.close(() => process.exit(0)));
