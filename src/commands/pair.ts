import pc from "picocolors";
import { loadConfig } from "../config";
import { getHostname, getOsUser } from "../identity";

export async function pairCommand(_args: string[]) {
  const config = await loadConfig();
  const id = config.agentId;

  console.log("");
  console.log(pc.bold("Agent ID"));
  console.log("  " + pc.cyan(pc.bold(id)));
  console.log("");
  console.log(pc.dim(`  hostname : ${getHostname()}`));
  console.log(pc.dim(`  os user  : ${getOsUser()}`));
  console.log("");
  console.log(pc.bold("Claim this agent"));
  if (config.dashboardUrl) {
    console.log(`  1. Open ${pc.underline(config.dashboardUrl)}`);
  } else {
    console.log(`  1. Open the pm-dashboard in your browser`);
  }
  console.log(`  2. Sign in with your account`);
  console.log(`  3. Go to ${pc.bold("My Agents → + Pair agent")}`);
  console.log(`  4. Paste the Agent ID above and submit`);
  console.log(`  5. An admin will approve your claim`);
  console.log("");
}
