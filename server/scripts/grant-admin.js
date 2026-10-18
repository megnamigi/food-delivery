import path from "node:path";
import { fileURLToPath } from "node:url";
import mongoose from "mongoose";
import { createStore } from "../src/store.js";
const emailIndex = process.argv.indexOf("--email"),
  email = process.argv[emailIndex + 1]?.toLowerCase().trim();
if (emailIndex < 0 || !email || !email.includes("@")) {
  console.error(
    "Usage: npm run admin:grant -- --email your-verified-email@example.com",
  );
  process.exit(1);
}
if (!process.env.MONGODB_URI) {
  let running = false;
  try {
    await fetch(`http://127.0.0.1:${process.env.PORT || 4000}/health`, {
      signal: AbortSignal.timeout(800),
    });
    running = true;
  } catch {}
  if (running) {
    console.error(
      "Stop the local API with Ctrl+C before granting a role, then restart it afterwards. This prevents overwriting its in-memory data.",
    );
    process.exit(1);
  }
}
try {
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
  const store = await createStore({
    uri: process.env.MONGODB_URI,
    directory: path.join(root, ".data"),
  });
  const user = await store.one("users", { email });
  if (!user?.isVerified)
    throw new Error(
      "An existing, verified account is required. Sign up and verify the email first.",
    );
  await store.update("users", user._id, { role: "ADMIN" });
  console.log(
    `Admin role granted to ${email}. Restart the API and log in again.`,
  );
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
} finally {
  await mongoose.disconnect();
}
