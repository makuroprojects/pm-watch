import pc from "picocolors";
import { unlinkSync, existsSync } from "node:fs";
import { unload } from "../launchctl";
import { LAUNCH_PLIST } from "../config";
import { deleteToken } from "../keychain";

export async function uninstallCommand(args: string[]) {
  const purge = args.includes("--purge");

  await unload();
  if (existsSync(LAUNCH_PLIST)) unlinkSync(LAUNCH_PLIST);
  console.log(pc.green("✓"), "LaunchAgent removed");

  if (purge) {
    await deleteToken();
    console.log(pc.green("✓"), "Keychain token removed");
    console.log(pc.dim("  Config + buffer preserved at ~/Library/Application Support/pm-watch"));
    console.log(pc.dim("  Remove manually if needed"));
  } else {
    console.log(pc.dim("  Config + token preserved. Use --purge to wipe."));
  }
}
