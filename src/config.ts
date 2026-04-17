import { homedir } from "node:os";
import { join } from "node:path";
import { mkdirSync, existsSync } from "node:fs";

export const CONFIG_DIR = join(homedir(), "Library/Application Support/pm-watch");
export const LOG_DIR = join(homedir(), "Library/Logs/pm-watch");
export const CONFIG_FILE = join(CONFIG_DIR, "config.json");
export const DB_FILE = join(CONFIG_DIR, "buffer.db");
export const LOG_FILE = join(LOG_DIR, "agent.log");

export const LAUNCH_LABEL = "com.pmwatch.agent";
export const LAUNCH_PLIST = join(homedir(), "Library/LaunchAgents", `${LAUNCH_LABEL}.plist`);
export const INSTALL_BIN = join(homedir(), ".local/bin/pmw");

export interface Config {
  webhookUrl: string;
  syncIntervalMinutes: number;
  awUrl: string;
}

export const DEFAULT_CONFIG: Config = {
  webhookUrl: "",
  syncIntervalMinutes: 5,
  awUrl: "http://localhost:5600",
};

export type ConfigKey = keyof Config;

export function ensureDirs() {
  if (!existsSync(CONFIG_DIR)) mkdirSync(CONFIG_DIR, { recursive: true });
  if (!existsSync(LOG_DIR)) mkdirSync(LOG_DIR, { recursive: true });
}

export async function loadConfig(): Promise<Config> {
  ensureDirs();
  const file = Bun.file(CONFIG_FILE);
  if (!(await file.exists())) {
    await Bun.write(CONFIG_FILE, JSON.stringify(DEFAULT_CONFIG, null, 2));
    return { ...DEFAULT_CONFIG };
  }
  const parsed = (await file.json()) as Partial<Config>;
  return { ...DEFAULT_CONFIG, ...parsed };
}

export async function saveConfig(config: Config): Promise<void> {
  ensureDirs();
  await Bun.write(CONFIG_FILE, JSON.stringify(config, null, 2));
}

export async function setConfigValue<K extends ConfigKey>(key: K, value: Config[K]): Promise<void> {
  const current = await loadConfig();
  current[key] = value;
  await saveConfig(current);
}
