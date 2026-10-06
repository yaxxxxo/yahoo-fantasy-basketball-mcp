import { describe, it, expect, vi, beforeEach } from "vitest";
import { handleConfigTool, getDefaultLeagueKey } from "../src/config-tools.js";

// Mock the token-store module to avoid filesystem access
vi.mock("../src/token-store.js", () => ({
  loadConfig: vi.fn(),
  saveConfig: vi.fn(),
}));

import { loadConfig, saveConfig } from "../src/token-store.js";

const mockLoadConfig = vi.mocked(loadConfig);
const mockSaveConfig = vi.mocked(saveConfig);

describe("handleConfigTool", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSaveConfig.mockResolvedValue(undefined);
  });

  it("set_default_league validates valid league_key format", async () => {
    const result = await handleConfigTool("set_default_league", {
      league_key: "nba.l.12345",
    });

    expect(mockSaveConfig).toHaveBeenCalledWith({ default_league_key: "nba.l.12345" });
    expect(result.content[0].type).toBe("text");
    expect(result.content[0].text).toContain("nba.l.12345");
  });

  it("rejects invalid league_key format (missing sport prefix)", async () => {
    await expect(
      handleConfigTool("set_default_league", { league_key: "invalid-key" })
    ).rejects.toThrow(/Invalid league_key format/);
  });

  it("rejects invalid league_key format (wrong separator)", async () => {
    await expect(
      handleConfigTool("set_default_league", { league_key: "nba_l_12345" })
    ).rejects.toThrow(/Invalid league_key format/);
  });

  it("rejects invalid league_key format (non-numeric league id)", async () => {
    await expect(
      handleConfigTool("set_default_league", { league_key: "nba.l.abc" })
    ).rejects.toThrow();
  });

  it("rejects uppercase sport prefix", async () => {
    await expect(
      handleConfigTool("set_default_league", { league_key: "NBA.l.12345" })
    ).rejects.toThrow(/Invalid league_key format/);
  });

  it("throws for unknown tool name", async () => {
    await expect(
      handleConfigTool("unknown_tool", {})
    ).rejects.toThrow(/Unknown config tool/);
  });

  it("throws when league_key is missing from args", async () => {
    await expect(
      handleConfigTool("set_default_league", {})
    ).rejects.toThrow();
  });
});

describe("getDefaultLeagueKey", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns explicit key when provided", async () => {
    const result = await getDefaultLeagueKey("nba.l.99999");
    expect(result).toBe("nba.l.99999");
    expect(mockLoadConfig).not.toHaveBeenCalled();
  });

  it("returns key from config when no explicit key provided", async () => {
    mockLoadConfig.mockResolvedValue({ default_league_key: "nba.l.54321" });
    const result = await getDefaultLeagueKey();
    expect(result).toBe("nba.l.54321");
  });

  it("throws when no key available and config has no default", async () => {
    mockLoadConfig.mockResolvedValue({});
    await expect(getDefaultLeagueKey()).rejects.toThrow(
      /No league specified/
    );
  });

  it("throws when no key available and config default_league_key is undefined", async () => {
    mockLoadConfig.mockResolvedValue({ default_league_key: undefined });
    await expect(getDefaultLeagueKey()).rejects.toThrow(
      /No league specified/
    );
  });
});
