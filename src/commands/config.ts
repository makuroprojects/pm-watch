import pc from "picocolors";
import { loadConfig, setConfigValue, type ConfigKey } from "../config";
import { setToken, getToken, deleteToken } from "../keychain";

const KEY_ALIAS: Record<string, ConfigKey> = {
  hook: "webhookUrl",
  url: "webhookUrl",
  webhookUrl: "webhookUrl",
  dashboard: "dashboardUrl",
  dashboardUrl: "dashboardUrl",
  interval: "syncIntervalMinutes",
  syncIntervalMinutes: "syncIntervalMinutes",
  aw: "awUrl",
  awUrl: "awUrl",
  agentId: "agentId",
  agent: "agentId",
};

const READONLY_KEYS = new Set<ConfigKey>(["agentId"]);

function usageAndExit(): never {
  console.error(`Usage:
  pmw set <key> <value>       # hook | dashboard | interval | aw
  pmw set token               # prompts; pipe: echo $T | pmw set token --stdin
  pmw get [key]               # all, or one key
  pmw unset token
`);
  process.exit(1);
}

export async function setCommand(args: string[]) {
  const [keyRaw, ...rest] = args;
  if (!keyRaw) usageAndExit();

  if (keyRaw === "token") {
    const useStdin = rest.includes("--stdin");
    let token: string;
    if (useStdin) {
      token = (await Bun.stdin.text()).trim();
    } else {
      const inline = rest.filter((a) => !a.startsWith("--"))[0];
      if (inline) {
        token = inline;
      } else {
        process.stdout.write("Token: ");
        token = (await readHiddenLine()).trim();
      }
    }
    if (!token) {
      console.error(pc.red("✗"), "Empty token");
      process.exit(1);
    }
    await setToken(token);
    console.log(pc.green("✓"), "token saved to Keychain");
    return;
  }

  const key = KEY_ALIAS[keyRaw];
  if (!key) {
    console.error(pc.red("✗"), `Unknown key: ${keyRaw}`);
    usageAndExit();
  }
  if (READONLY_KEYS.has(key)) {
    console.error(pc.red("✗"), `${key} is auto-generated and cannot be set via CLI`);
    process.exit(1);
  }

  const value = rest.filter((a) => !a.startsWith("--")).join(" ");
  if (!value) usageAndExit();

  if (key === "syncIntervalMinutes") {
    const n = Number(value);
    if (!Number.isFinite(n) || n < 1) {
      console.error(pc.red("✗"), "interval must be a positive number");
      process.exit(1);
    }
    await setConfigValue(key, n);
  } else {
    await setConfigValue(key, value);
  }
  console.log(pc.green("✓"), `${key} = ${value}`);
}

export async function getCommand(args: string[]) {
  const config = await loadConfig();
  const hasTok = !!(await getToken());

  if (args.length === 0) {
    console.log(pc.bold("Config"));
    console.log(`  agentId             ${config.agentId}`);
    console.log(`  webhookUrl          ${config.webhookUrl || pc.dim("(unset)")}`);
    console.log(`  dashboardUrl        ${config.dashboardUrl || pc.dim("(unset)")}`);
    console.log(`  syncIntervalMinutes ${config.syncIntervalMinutes}`);
    console.log(`  awUrl               ${config.awUrl}`);
    console.log(`  token               ${hasTok ? pc.dim("••••••••  (in Keychain)") : pc.dim("(unset)")}`);
    return;
  }

  const keyRaw = args[0]!;
  if (keyRaw === "token") {
    console.log(hasTok ? "(set)" : "(unset)");
    return;
  }
  const key = KEY_ALIAS[keyRaw];
  if (!key) {
    console.error(pc.red("✗"), `Unknown key: ${keyRaw}`);
    process.exit(1);
  }
  console.log(config[key]);
}

export async function unsetCommand(args: string[]) {
  const [key] = args;
  if (key === "token") {
    await deleteToken();
    console.log(pc.green("✓"), "token removed");
    return;
  }
  console.error(pc.red("✗"), "Only 'token' can be unset currently");
  process.exit(1);
}

async function readHiddenLine(): Promise<string> {
  // @ts-ignore Bun provides process.stdin as a Node-style stream
  const stdin = process.stdin as NodeJS.ReadStream;
  if (!stdin.isTTY) return (await Bun.stdin.text()).split("\n")[0] ?? "";

  return new Promise((resolve) => {
    stdin.setRawMode?.(true);
    stdin.resume();
    stdin.setEncoding("utf8");
    let buf = "";
    const onData = (ch: string) => {
      if (ch === "\n" || ch === "\r" || ch === "\u0004") {
        stdin.setRawMode?.(false);
        stdin.pause();
        stdin.off("data", onData);
        process.stdout.write("\n");
        resolve(buf);
      } else if (ch === "\u0003") {
        process.exit(130);
      } else if (ch === "\u007f") {
        buf = buf.slice(0, -1);
      } else {
        buf += ch;
      }
    };
    stdin.on("data", onData);
  });
}
