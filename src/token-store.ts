import { readFile, writeFile, mkdir, chmod } from "node:fs/promises";
import { join } from "node:path";
import { homedir } from "node:os";

export interface Tokens {
  access_token: string;
  refresh_token: string;
  token_type: string;
  expires_at: number;
}

export interface AppConfig {
  default_league_key?: string;
}

export function getConfigDir(): string {
  return join(homedir(), ".config", "yahoo-fantasy-mcp");
}

async function ensureConfigDir(): Promise<void> {
  await mkdir(getConfigDir(), { recursive: true });
}

export async function loadTokens(): Promise<Tokens | null> {
  const filePath = join(getConfigDir(), "tokens.json");
  try {
    const content = await readFile(filePath, "utf-8");
    return JSON.parse(content) as Tokens;
  } catch (err: unknown) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") {
      return null;
    }
    throw err;
  }
}

export async function saveTokens(tokens: Tokens): Promise<void> {
  await ensureConfigDir();
  const filePath = join(getConfigDir(), "tokens.json");
  await writeFile(filePath, JSON.stringify(tokens, null, 2), { encoding: "utf-8", mode: 0o600 });
  // mode only applies when the file is created; tighten files written by older versions
  await chmod(filePath, 0o600);
}

export async function loadConfig(): Promise<AppConfig> {
  const filePath = join(getConfigDir(), "config.json");
  try {
    const content = await readFile(filePath, "utf-8");
    return JSON.parse(content) as AppConfig;
  } catch (err: unknown) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") {
      return {};
    }
    throw err;
  }
}

export async function saveConfig(config: AppConfig): Promise<void> {
  await ensureConfigDir();
  const filePath = join(getConfigDir(), "config.json");
  await writeFile(filePath, JSON.stringify(config, null, 2), "utf-8");
}
