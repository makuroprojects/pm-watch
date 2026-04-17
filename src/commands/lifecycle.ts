import pc from "picocolors";
import { existsSync } from "node:fs";
import { load, unload, kickstart, isLoaded } from "../launchctl";
import { LAUNCH_PLIST } from "../config";

export async function startCommand(_args: string[]) {
  if (!existsSync(LAUNCH_PLIST)) {
    console.error(pc.red("✗"), "LaunchAgent not installed. Run: pmw install");
    process.exit(1);
  }
  await load();
  console.log(pc.green("✓"), "agent started");
}

export async function stopCommand(_args: string[]) {
  await unload();
  console.log(pc.green("✓"), "agent stopped");
}

export async function restartCommand(_args: string[]) {
  if (!existsSync(LAUNCH_PLIST)) {
    console.error(pc.red("✗"), "LaunchAgent not installed. Run: pmw install");
    process.exit(1);
  }
  if (await isLoaded()) {
    await kickstart();
  } else {
    await load();
  }
  console.log(pc.green("✓"), "agent restarted");
}
