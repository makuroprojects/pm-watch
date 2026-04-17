import { $ } from "bun";
import { LOG_FILE } from "../config";
import { existsSync } from "node:fs";
import pc from "picocolors";

export async function logsCommand(args: string[]) {
  if (!existsSync(LOG_FILE)) {
    console.log(pc.dim(`No log file yet at ${LOG_FILE}`));
    return;
  }
  const follow = args.includes("-f") || args.includes("--follow");
  const tailIdx = args.findIndex((a) => a === "-n" || a === "--tail");
  const n = tailIdx >= 0 ? Number(args[tailIdx + 1]) || 100 : 200;

  if (follow) {
    await $`tail -n ${n} -f ${LOG_FILE}`;
  } else {
    await $`tail -n ${n} ${LOG_FILE}`;
  }
}
