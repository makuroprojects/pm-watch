import { $ } from "bun";
import { chmodSync, renameSync } from "node:fs";
import { INSTALL_BIN } from "./config";
import { log } from "./log";
import { REPO, VERSION } from "./version";

export interface ReleaseInfo {
  tag: string;
  url: string;
}

function detectArch(): "arm64" | "x64" {
  return process.arch === "arm64" ? "arm64" : "x64";
}

function normalize(v: string): string {
  return v.startsWith("v") ? v.slice(1) : v;
}

export function isNewer(remote: string, local: string): boolean {
  const r = normalize(remote).split(".").map((n) => Number(n) || 0);
  const l = normalize(local).split(".").map((n) => Number(n) || 0);
  const len = Math.max(r.length, l.length);
  for (let i = 0; i < len; i++) {
    const ri = r[i] ?? 0;
    const li = l[i] ?? 0;
    if (ri > li) return true;
    if (ri < li) return false;
  }
  return false;
}

export async function fetchLatestRelease(): Promise<ReleaseInfo | null> {
  try {
    const res = await fetch(`https://api.github.com/repos/${REPO}/releases`, {
      headers: { "User-Agent": `pm-watch/${VERSION}` },
    });
    if (!res.ok) return null;
    const releases = (await res.json()) as Array<{ tag_name: string; draft: boolean }>;
    const first = releases.find((r) => !r.draft);
    if (!first) return null;
    const arch = detectArch();
    return {
      tag: first.tag_name,
      url: `https://github.com/${REPO}/releases/download/${first.tag_name}/pmw-darwin-${arch}`,
    };
  } catch {
    return null;
  }
}

export async function downloadAndInstall(url: string): Promise<void> {
  const tmp = `${INSTALL_BIN}.new`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const bytes = await res.arrayBuffer();
  await Bun.write(tmp, bytes);
  chmodSync(tmp, 0o755);
  await $`xattr -cr ${tmp}`.quiet().nothrow();
  renameSync(tmp, INSTALL_BIN);
}

export async function maybeAutoUpdate(opts: {
  autoUpdate: boolean;
  pendingCount: number;
}): Promise<boolean> {
  if (!opts.autoUpdate) return false;
  if (opts.pendingCount > 10_000) {
    log("auto-update skipped", `pending=${opts.pendingCount} (backlog too large)`);
    return false;
  }
  const latest = await fetchLatestRelease();
  if (!latest) return false;
  if (!isNewer(latest.tag, VERSION)) return false;

  log(`auto-update ${VERSION} → ${latest.tag}`);
  try {
    await downloadAndInstall(latest.url);
    log(`auto-update applied ${latest.tag}; exiting for LaunchAgent restart`);
    return true;
  } catch (err) {
    log("auto-update failed", String(err));
    return false;
  }
}
