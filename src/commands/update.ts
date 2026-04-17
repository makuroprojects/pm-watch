import pc from "picocolors";
import { isLoaded, kickstart } from "../launchctl";
import { downloadAndInstall, fetchLatestRelease, isNewer } from "../updater";
import { VERSION } from "../version";

export async function updateCommand(args: string[]) {
  const check = args.includes("--check");
  const force = args.includes("--force");

  console.log(`Current : ${pc.cyan(`v${VERSION}`)}`);

  const latest = await fetchLatestRelease();
  if (!latest) {
    console.error(pc.red("✗"), "Failed to reach GitHub releases");
    process.exit(1);
  }

  console.log(`Latest  : ${pc.cyan(latest.tag)}`);

  const needUpgrade = isNewer(latest.tag, VERSION);
  if (!needUpgrade && !force) {
    console.log(pc.green("✓"), "Already on the latest version");
    return;
  }

  if (check) {
    console.log("");
    console.log(pc.yellow("→"), `Update available: ${VERSION} → ${latest.tag}`);
    console.log(`  run ${pc.cyan("pmw update")} to apply`);
    return;
  }

  console.log(`→ Downloading ${latest.url}`);
  try {
    await downloadAndInstall(latest.url);
  } catch (err) {
    console.error(pc.red("✗"), "Update failed:", String(err));
    process.exit(1);
  }
  console.log(pc.green("✓"), `Installed ${latest.tag}`);

  if (await isLoaded()) {
    console.log("→ Restarting background agent");
    await kickstart();
    console.log(pc.green("✓"), "Agent restarted on new binary");
  } else {
    console.log(pc.dim("  agent not running; start with `pmw start`"));
  }
}
