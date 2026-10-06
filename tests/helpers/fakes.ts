import { vi } from "vitest";
import type { ToolContext } from "../../src/tool.js";
import type { AppConfig } from "../../src/token-store.js";

export function fakeContext(config: AppConfig = { default_league_key: "nba.l.1" }) {
  const yahoo = {
    getLeagueSettings: vi.fn(),
    getStandings: vi.fn(),
    getScoreboard: vi.fn(),
    getTeams: vi.fn(),
    getTeamRoster: vi.fn(),
    searchPlayers: vi.fn(),
    getFreeAgents: vi.fn(),
    getPlayerStats: vi.fn(),
  };
  const store = {
    load: vi.fn(async () => config),
    save: vi.fn(async (_config: AppConfig) => {}),
  };
  const ctx: ToolContext = { yahoo, config: store };
  return { ctx, yahoo, config: store };
}
