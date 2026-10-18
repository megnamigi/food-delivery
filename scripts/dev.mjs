import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const children = [];
async function isRunning(url) {
  try {
    return (await fetch(url, { signal: AbortSignal.timeout(1500) })).ok;
  } catch {
    return false;
  }
}
function launch(directory) {
  const child = spawn("npm", ["run", "dev"], {
    cwd: path.join(root, directory),
    stdio: "inherit",
  });
  children.push(child);
  child.on("exit", (code) => {
    if (code && code !== 0) shutdown(code);
  });
}
function shutdown(code = 0) {
  for (const child of children) child.kill("SIGTERM");
  process.exit(code);
}
if (await isRunning("http://127.0.0.1:4000/health"))
  console.log("API already running on port 4000.");
else launch("server");
if (await isRunning("http://localhost:3000"))
  console.log("Frontend already running: http://localhost:3000");
else launch("client");
for (const signal of ["SIGINT", "SIGTERM"])
  process.on(signal, () => shutdown());
