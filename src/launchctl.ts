import { $ } from "bun";
import { LAUNCH_LABEL, LAUNCH_PLIST, LOG_DIR, INSTALL_BIN, ensureDirs } from "./config";
import { existsSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";

const PLIST_TEMPLATE = (binary: string, logDir: string) => `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>${LAUNCH_LABEL}</string>
    <key>ProgramArguments</key>
    <array>
        <string>${binary}</string>
        <string>run</string>
    </array>
    <key>RunAtLoad</key>
    <true/>
    <key>KeepAlive</key>
    <true/>
    <key>ProcessType</key>
    <string>Background</string>
    <key>ThrottleInterval</key>
    <integer>30</integer>
    <key>StandardOutPath</key>
    <string>${logDir}/agent.out.log</string>
    <key>StandardErrorPath</key>
    <string>${logDir}/agent.err.log</string>
</dict>
</plist>
`;

export async function writePlist(): Promise<string> {
  ensureDirs();
  const launchAgentsDir = dirname(LAUNCH_PLIST);
  if (!existsSync(launchAgentsDir)) mkdirSync(launchAgentsDir, { recursive: true });

  const binary = resolveBinary();
  await Bun.write(LAUNCH_PLIST, PLIST_TEMPLATE(binary, LOG_DIR));
  return binary;
}

function resolveBinary(): string {
  // Prefer installed location; fall back to current argv[0] (useful during dev).
  if (existsSync(INSTALL_BIN)) return INSTALL_BIN;
  return process.argv[0] ?? INSTALL_BIN;
}

function uid(): string {
  return String(process.getuid?.() ?? "");
}

export async function isLoaded(): Promise<boolean> {
  try {
    const result = await $`launchctl print gui/${uid()}/${LAUNCH_LABEL}`.quiet().nothrow();
    return result.exitCode === 0;
  } catch {
    return false;
  }
}

export async function load(): Promise<void> {
  await $`launchctl bootstrap gui/${uid()} ${LAUNCH_PLIST}`.quiet();
}

export async function unload(): Promise<void> {
  await $`launchctl bootout gui/${uid()}/${LAUNCH_LABEL}`.quiet().nothrow();
}

export async function kickstart(): Promise<void> {
  await $`launchctl kickstart -k gui/${uid()}/${LAUNCH_LABEL}`.quiet().nothrow();
}
