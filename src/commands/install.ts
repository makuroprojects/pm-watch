import pc from "picocolors";
import { writePlist, unload, load } from "../launchctl";
import { LAUNCH_PLIST, INSTALL_BIN } from "../config";
import { existsSync } from "node:fs";

export async function installCommand(_args: string[]) {
  if (!existsSync(INSTALL_BIN)) {
    console.warn(pc.yellow(`⚠  ${INSTALL_BIN} not found — LaunchAgent will point at current binary.`));
    console.warn(pc.dim(`   Make sure to place pmw at ${INSTALL_BIN} before relying on auto-start.`));
  }

  const binary = await writePlist();
  await unload();
  await load();

  console.log(pc.green("✓"), "LaunchAgent installed");
  console.log(pc.dim("  binary:"), binary);
  console.log(pc.dim("  plist :"), LAUNCH_PLIST);
}
