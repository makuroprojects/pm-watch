import pc from "picocolors";
import { ActivityWatchClient } from "../activitywatch";
import { Buffer } from "../buffer";
import { loadConfig, CONFIG_FILE, DB_FILE, LOG_FILE, LAUNCH_PLIST } from "../config";
import { getHostname, getOsUser } from "../identity";
import { getToken } from "../keychain";
import { isLoaded } from "../launchctl";
import { existsSync } from "node:fs";

export async function statusCommand(_args: string[]) {
  const config = await loadConfig();
  const aw = new ActivityWatchClient(config.awUrl);

  const [awOk, agentLoaded, token] = await Promise.all([
    aw.ping(),
    isLoaded(),
    getToken(),
  ]);

  const buf = new Buffer();
  const stats = buf.stats();
  buf.close();

  const dot = agentLoaded ? pc.green("●") : pc.yellow("○");
  const state = agentLoaded ? pc.green("running") : pc.yellow("not running");

  console.log(`${pc.bold("pm-watch")} ${dot} ${state}`);
  console.log(pc.dim("─".repeat(40)));
  console.log(`  Agent ID      ${pc.cyan(config.agentId)}`);
  console.log(`  Host / User   ${getHostname()} / ${getOsUser()}`);
  console.log(`  Webhook       ${config.webhookUrl || pc.dim("(unset)")}`);
  console.log(`  Dashboard     ${config.dashboardUrl || pc.dim("(unset)")}`);
  console.log(`  Token         ${token ? pc.dim("••••••••  (Keychain)") : pc.red("missing")}`);
  console.log(`  Interval      ${config.syncIntervalMinutes} min`);
  console.log(`  ActivityWatch ${awOk ? pc.green("✓ reachable") : pc.red("✗ unreachable")} ${pc.dim(config.awUrl)}`);
  console.log(`  Buffer        ${stats.total} total, ${stats.pending} pending`);
  console.log(`  LaunchAgent   ${existsSync(LAUNCH_PLIST) ? pc.green("installed") : pc.yellow("not installed")}`);
  console.log("");
  console.log(pc.dim(`  config : ${CONFIG_FILE}`));
  console.log(pc.dim(`  buffer : ${DB_FILE}`));
  console.log(pc.dim(`  log    : ${LOG_FILE}`));
}
