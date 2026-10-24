import path from "node:path";
import { fileURLToPath } from "node:url";
import { createApp } from "../src/app.js";
import { createStore } from "../src/store.js";

const root = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);

let appPromise;

async function getApp() {
  if (!appPromise) {
    appPromise = (async () => {
      const store = await createStore({
        uri: process.env.MONGODB_URI,
        directory: path.join(root, ".data"),
      });

      const catalog = JSON.parse(
        await (
          await import("node:fs/promises")
        ).readFile(path.join(root, "src/catalog.json"), "utf8"),
      );

      return createApp({
        store,
        catalog,
        secret: process.env.JWT_SECRET,
        origin: process.env.CLIENT_ORIGIN,
      });
    })().catch((error) => {
      appPromise = undefined;
      throw error;
    });
  }

  return appPromise;
}

export default async function handler(req, res) {
  const app = await getApp();
  return app(req, res);
}