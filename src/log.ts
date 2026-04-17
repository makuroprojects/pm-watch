import { appendFileSync } from "node:fs";
import { LOG_FILE, ensureDirs } from "./config";

export function log(...args: unknown[]) {
  ensureDirs();
  const serialized = args
    .map((a) => (typeof a === "string" ? a : JSON.stringify(a)))
    .join(" ");
  const line = `[${new Date().toISOString()}] ${serialized}\n`;
  try {
    appendFileSync(LOG_FILE, line);
  } catch {}
  console.log(line.trimEnd());
}
