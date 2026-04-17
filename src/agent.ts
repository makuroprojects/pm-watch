import pc from "picocolors";
import { initCommand } from "./commands/init";
import { runCommand } from "./commands/run";
import { statusCommand } from "./commands/status";
import { syncCommand } from "./commands/sync";
import { setCommand, getCommand, unsetCommand } from "./commands/config";
import { installCommand } from "./commands/install";
import { uninstallCommand } from "./commands/uninstall";
import { startCommand, stopCommand, restartCommand } from "./commands/lifecycle";
import { doctorCommand } from "./commands/doctor";
import { logsCommand } from "./commands/logs";
import { pairCommand } from "./commands/pair";

const commands: Record<string, (args: string[]) => Promise<void>> = {
  init: initCommand,
  run: runCommand,
  status: statusCommand,
  sync: syncCommand,
  "sync-now": syncCommand,
  pair: pairCommand,
  set: setCommand,
  get: getCommand,
  unset: unsetCommand,
  install: installCommand,
  uninstall: uninstallCommand,
  start: startCommand,
  stop: stopCommand,
  restart: restartCommand,
  doctor: doctorCommand,
  logs: logsCommand,
};

const help = `${pc.bold("pmw")} — ActivityWatch sync agent

${pc.bold("Setup")}
  pmw init                  Interactive setup wizard
  pmw pair                  Show Agent ID for claiming in pm-dashboard
  pmw set hook <url>        Set webhook URL
  pmw set dashboard <url>   Set dashboard URL (shown on pair)
  pmw set token             Set auth token (prompt or --stdin)
  pmw set interval <n>      Sync interval in minutes
  pmw get [key]             Show config

${pc.bold("Lifecycle")}
  pmw install               Install LaunchAgent (auto-start at login)
  pmw start | stop | restart
  pmw uninstall [--purge]   Remove LaunchAgent (add --purge to drop token)

${pc.bold("Ops")}
  pmw status                Show status (includes Agent ID)
  pmw doctor                Run all health checks
  pmw sync                  Force sync now
  pmw logs [-f] [-n N]      Tail agent log

${pc.dim("Hidden: pmw run   (called by LaunchAgent)")}
`;

const [, , cmd, ...args] = process.argv;

if (!cmd || cmd === "--help" || cmd === "-h" || cmd === "help") {
  console.log(help);
  process.exit(0);
}

const handler = commands[cmd];
if (!handler) {
  console.error(pc.red(`Unknown command: ${cmd}`));
  console.error(help);
  process.exit(1);
}

await handler(args);
