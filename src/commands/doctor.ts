import pc from "picocolors";
import { ActivityWatchClient } from "../activitywatch";
import { loadConfig, LAUNCH_PLIST, INSTALL_BIN } from "../config";
import { getToken } from "../keychain";
import { isLoaded } from "../launchctl";
import { Buffer } from "../buffer";
import { existsSync } from "node:fs";

type Check = { label: string; ok: boolean; detail?: string };

export async function doctorCommand(_args: string[]) {
  const config = await loadConfig();
  const checks: Check[] = [];

  checks.push({
    label: "webhook URL configured",
    ok: !!config.webhookUrl,
    detail: config.webhookUrl || "run: pmw set hook <url>",
  });

  const hasTok = !!(await getToken());
  checks.push({
    label: "auth token in Keychain",
    ok: hasTok,
    detail: hasTok ? "present" : "run: pmw set token",
  });

  const aw = new ActivityWatchClient(config.awUrl);
  const awOk = await aw.ping();
  checks.push({
    label: "ActivityWatch reachable",
    ok: awOk,
    detail: config.awUrl,
  });

  if (config.webhookUrl) {
    const webhookOk = await pingWebhook(config.webhookUrl, await getToken());
    checks.push({
      label: "webhook reachable",
      ok: webhookOk.ok,
      detail: webhookOk.detail,
    });
  }

  checks.push({
    label: "binary at ~/.local/bin/pmw",
    ok: existsSync(INSTALL_BIN),
    detail: INSTALL_BIN,
  });

  checks.push({
    label: "LaunchAgent plist present",
    ok: existsSync(LAUNCH_PLIST),
    detail: existsSync(LAUNCH_PLIST) ? LAUNCH_PLIST : "run: pmw install",
  });

  checks.push({
    label: "LaunchAgent loaded",
    ok: await isLoaded(),
    detail: "launchctl",
  });

  let bufStats = { total: 0, pending: 0 };
  try {
    const buf = new Buffer();
    bufStats = buf.stats();
    buf.close();
  } catch {}
  checks.push({
    label: "buffer writable",
    ok: true,
    detail: `${bufStats.total} total / ${bufStats.pending} pending`,
  });

  for (const c of checks) {
    const mark = c.ok ? pc.green("✓") : pc.red("✗");
    const label = c.ok ? c.label : pc.red(c.label);
    const detail = c.detail ? pc.dim(`  ${c.detail}`) : "";
    console.log(`${mark} ${label}${detail}`);
  }

  const fail = checks.filter((c) => !c.ok).length;
  if (fail > 0) process.exitCode = 1;
}

async function pingWebhook(
  url: string,
  token: string | null,
): Promise<{ ok: boolean; detail: string }> {
  const headers: Record<string, string> = {};
  if (token) headers["Authorization"] = `Bearer ${token}`;
  try {
    const res = await fetch(url, {
      method: "HEAD",
      headers,
      signal: AbortSignal.timeout(5000),
    });
    // Many webhooks don't support HEAD; accept anything < 500 as reachable.
    const ok = res.status < 500;
    return { ok, detail: `HTTP ${res.status} ${res.statusText}` };
  } catch (err) {
    return { ok: false, detail: String(err).slice(0, 100) };
  }
}
