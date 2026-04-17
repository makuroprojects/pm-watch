import { intro, outro, text, password, confirm, isCancel, cancel, note, spinner } from "@clack/prompts";
import pc from "picocolors";
import { loadConfig, saveConfig } from "../config";
import { setToken } from "../keychain";
import { doctorCommand } from "./doctor";
import { installCommand } from "./install";

function bail(): never {
  cancel("Setup cancelled.");
  process.exit(0);
}

export async function initCommand(_args: string[]) {
  intro(pc.bgCyan(pc.black(" pm-watch setup ")));

  const existing = await loadConfig();

  const hook = await text({
    message: "Webhook URL",
    placeholder: "https://pm-dashboard.corp.com/webhooks/aw",
    initialValue: existing.webhookUrl,
    validate: (v) => {
      if (!v) return "Required";
      if (!/^https?:\/\//.test(v)) return "Must start with http(s)://";
    },
  });
  if (isCancel(hook)) bail();

  const dashboard = await text({
    message: "Dashboard URL (optional, shown on `pmw pair`)",
    placeholder: "https://pm-dashboard.corp.com",
    initialValue: existing.dashboardUrl,
  });
  if (isCancel(dashboard)) bail();

  const token = await password({
    message: "Auth token (leave blank to keep existing)",
  });
  if (isCancel(token)) bail();

  const intervalStr = await text({
    message: "Sync interval (minutes)",
    placeholder: "5",
    initialValue: String(existing.syncIntervalMinutes),
    validate: (v) => {
      const n = Number(v);
      if (!Number.isFinite(n) || n < 1) return "Must be a positive number";
    },
  });
  if (isCancel(intervalStr)) bail();

  const awUrl = await text({
    message: "ActivityWatch URL",
    initialValue: existing.awUrl,
  });
  if (isCancel(awUrl)) bail();

  const doInstall = await confirm({
    message: "Install as background service (LaunchAgent)?",
    initialValue: true,
  });
  if (isCancel(doInstall)) bail();

  const s = spinner();
  s.start("Saving configuration");
  await saveConfig({
    agentId: existing.agentId,
    webhookUrl: hook,
    dashboardUrl: dashboard,
    syncIntervalMinutes: Number(intervalStr),
    awUrl,
  });
  if (token) await setToken(token);
  s.stop("Configuration saved");

  if (doInstall) {
    await installCommand([]);
  }

  note("Running doctor...", "Health check");
  await doctorCommand([]);

  console.log("");
  console.log(pc.bold("Next step — claim this agent:"));
  console.log(`  ${pc.cyan("pmw pair")}   ${pc.dim("shows agent ID + claim instructions")}`);
  console.log("");

  outro(pc.green("pm-watch ready ✓"));
}
