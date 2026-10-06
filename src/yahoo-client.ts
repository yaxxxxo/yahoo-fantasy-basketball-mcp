import YahooFantasy from "yahoo-fantasy";
import { getAccessToken } from "./auth.js";
import {
  cache,
  STANDINGS_TTL,
  SCOREBOARD_TTL,
  PLAYER_TTL,
  ROSTER_TTL,
  SESSION_TTL,
} from "./cache.js";
import { getStatMapping, mapStats } from "./stat-mapping.js";

function getCredentials(): { clientId: string; clientSecret: string } {
  const clientId = process.env.YAHOO_CLIENT_ID;
  const clientSecret = process.env.YAHOO_CLIENT_SECRET;

  if (!clientId) {
    throw new Error(
      "Missing required environment variable: YAHOO_CLIENT_ID."
    );
  }
  if (!clientSecret) {
    throw new Error(
      "Missing required environment variable: YAHOO_CLIENT_SECRET."
    );
  }

  return { clientId, clientSecret };
}

export class YahooClient {
  private yf: YahooFantasy;

  constructor() {
    const { clientId, clientSecret } = getCredentials();
    this.yf = new YahooFantasy(clientId, clientSecret);
  }

  /** Set a fresh access token before every API call. */
  private async authenticate(): Promise<void> {
    const token = await getAccessToken();
    this.yf.setUserToken(token);
  }

  // ---------------------------------------------------------------------------
  // League info
  // ---------------------------------------------------------------------------

  async getLeagueSettings(leagueKey: string): Promise<any> {
    const cacheKey = `league_settings:${leagueKey}`;
    const cached = cache.get<any>(cacheKey);
    if (cached !== undefined) return cached;

    await this.authenticate();
    try {
      const result = await this.yf.league.settings(leagueKey);
      cache.set(cacheKey, result, SESSION_TTL);
      return result;
    } catch (err: unknown) {
      return { error: formatError(err) };
    }
  }

  async getStandings(leagueKey: string): Promise<any> {
    const cacheKey = `standings:${leagueKey}`;
    const cached = cache.get<any>(cacheKey);
    if (cached !== undefined) return cached;

    await this.authenticate();
    try {
      const result = await this.yf.league.standings(leagueKey);
      cache.set(cacheKey, result, STANDINGS_TTL);
      return result;
    } catch (err: unknown) {
      return { error: formatError(err) };
    }
  }

  async getScoreboard(leagueKey: string, week?: number): Promise<any> {
    const cacheKey = `scoreboard:${leagueKey}:${week ?? "current"}`;
    const cached = cache.get<any>(cacheKey);
    if (cached !== undefined) return cached;

    await this.authenticate();
    try {
      // Only pass week if defined — yahoo-fantasy builds `;week=undefined` otherwise
      const result = week !== undefined
        ? await this.yf.league.scoreboard(leagueKey, week)
        : await this.yf.league.scoreboard(leagueKey);
      cache.set(cacheKey, result, SCOREBOARD_TTL);
      return result;
    } catch (err: unknown) {
      return { error: formatError(err) };
    }
  }

  async getTeams(leagueKey: string): Promise<any> {
    const cacheKey = `teams:${leagueKey}`;
    const cached = cache.get<any>(cacheKey);
    if (cached !== undefined) return cached;

    await this.authenticate();
    try {
      const result = await this.yf.league.teams(leagueKey);
      cache.set(cacheKey, result, STANDINGS_TTL);
      return result;
    } catch (err: unknown) {
      return { error: formatError(err) };
    }
  }

  async getTeamRoster(leagueKey: string, teamKey: string): Promise<any> {
    const cacheKey = `roster:${leagueKey}:${teamKey}`;
    const cached = cache.get<any>(cacheKey);
    if (cached !== undefined) return cached;

    await this.authenticate();
    try {
      const result = await this.yf.team.roster(teamKey);
      cache.set(cacheKey, result, ROSTER_TTL);
      return result;
    } catch (err: unknown) {
      return { error: formatError(err) };
    }
  }

  // ---------------------------------------------------------------------------
  // Player data
  // ---------------------------------------------------------------------------

  async searchPlayers(leagueKey: string, name: string): Promise<any> {
    const cacheKey = `search_players:${leagueKey}:${name}`;
    const cached = cache.get<any>(cacheKey);
    if (cached !== undefined) return cached;

    await this.authenticate();
    try {
      // yahoo-fantasy exposes league player queries via yf.players.leagues
      const result = await this.yf.players.leagues(leagueKey, { search: name });
      cache.set(cacheKey, result, PLAYER_TTL);
      return result;
    } catch (err: unknown) {
      return { error: formatError(err) };
    }
  }

  async getFreeAgents(
    leagueKey: string,
    options: {
      position?: string;
      sort_by?: string;
      sort_type?: "season" | "lastweek" | "lastmonth" | "date" | "average_season";
      limit?: number;
    } = {}
  ): Promise<any> {
    const { position, sort_by, sort_type, limit } = options;
    const cacheKey = `free_agents:${leagueKey}:${position ?? ""}:${sort_by ?? ""}:${sort_type ?? ""}:${limit ?? ""}`;
    const cached = cache.get<any>(cacheKey);
    if (cached !== undefined) return cached;

    await this.authenticate();
    try {
      const filters: Record<string, unknown> = { status: "FA" };
      if (position) filters["position"] = position;
      if (sort_by) filters["sort"] = resolveSortKey(sort_by);
      if (sort_type) filters["sort_type"] = sort_type;
      if (limit !== undefined) filters["count"] = limit;

      // Request stats subresource so players come with their averages attached
      const result = await this.yf.players.leagues(leagueKey, filters, "stats");
      cache.set(cacheKey, result, PLAYER_TTL);
      return result;
    } catch (err: unknown) {
      return { error: formatError(err) };
    }
  }

  async getPlayerStats(leagueKey: string, playerKey: string): Promise<any> {
    const cacheKey = `player_stats:${leagueKey}:${playerKey}`;
    const cached = cache.get<any>(cacheKey);
    if (cached !== undefined) return cached;

    await this.authenticate();
    try {
      const rawStats = await this.yf.player.stats(playerKey);

      // Map stat IDs to human-readable names using league settings.
      const statMap = await getStatMapping(() => this.getLeagueSettings(leagueKey));

      // The yahoo-fantasy package typically returns stats under player_stats.stats.stat
      const statArray: Array<{ stat_id: string | number; value: string }> =
        rawStats?.player_stats?.stats?.stat ?? [];

      const result = {
        ...rawStats,
        mapped_stats: statArray.length > 0 ? mapStats(statArray, statMap) : {},
      };

      cache.set(cacheKey, result, PLAYER_TTL);
      return result;
    } catch (err: unknown) {
      return { error: formatError(err) };
    }
  }

}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

// Maps common stat abbreviations to Yahoo stat IDs for the Yahoo API `sort` filter.
// If the caller already passed a numeric stat ID, pass it through unchanged.
const SORT_ABBREVIATION_TO_STAT_ID: Record<string, string> = {
  FGA: "5", FGM: "6", "FG%": "7", FTA: "8", FTM: "9", "FT%": "10",
  "3PA": "11", "3PM": "12", "3PTM": "12", "3P%": "13", PTS: "15",
  OREB: "16", DREB: "17", REB: "18", AST: "19", ST: "20", STL: "20",
  BLK: "21", TO: "22", TOV: "22", MIN: "33",
};

function resolveSortKey(sortBy: string): string {
  if (/^\d+$/.test(sortBy)) return sortBy;
  const normalized = sortBy.toUpperCase();
  return SORT_ABBREVIATION_TO_STAT_ID[normalized] ?? sortBy;
}

function formatError(err: unknown): string {
  if (err instanceof Error) {
    return err.message;
  }
  return String(err);
}

export const yahooClient = new YahooClient();
