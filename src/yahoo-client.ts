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
import { YahooApiError, describeYahooError } from "./errors.js";

export interface FreeAgentOptions {
  position?: string;
  sort_by?: string;
  sort_type?: "season" | "lastweek" | "lastmonth" | "date" | "average_season";
  limit?: number;
}

/** What the tools need from Yahoo. Every method rejects with YahooApiError on failure. */
export interface YahooApi {
  getLeagueSettings(leagueKey: string): Promise<unknown>;
  getStandings(leagueKey: string): Promise<unknown>;
  getScoreboard(leagueKey: string, week?: number): Promise<unknown>;
  getTeams(leagueKey: string): Promise<unknown>;
  getTeamRoster(leagueKey: string, teamKey: string): Promise<unknown>;
  searchPlayers(leagueKey: string, name: string): Promise<unknown>;
  getFreeAgents(leagueKey: string, options?: FreeAgentOptions): Promise<unknown>;
  getPlayerStats(leagueKey: string, playerKey: string): Promise<unknown>;
}

function createYahooFantasy(): YahooFantasy {
  const clientId = process.env.YAHOO_CLIENT_ID;
  const clientSecret = process.env.YAHOO_CLIENT_SECRET;

  if (!clientId) {
    throw new Error("Missing required environment variable: YAHOO_CLIENT_ID.");
  }
  if (!clientSecret) {
    throw new Error("Missing required environment variable: YAHOO_CLIENT_SECRET.");
  }

  return new YahooFantasy(clientId, clientSecret);
}

export interface YahooClientDeps {
  createYahooFantasy?: () => YahooFantasy;
  getAccessToken?: () => Promise<string>;
}

export class YahooClient implements YahooApi {
  private yf?: YahooFantasy;
  private readonly createYahooFantasy: () => YahooFantasy;
  private readonly getAccessToken: () => Promise<string>;

  constructor(deps: YahooClientDeps = {}) {
    this.createYahooFantasy = deps.createYahooFantasy ?? createYahooFantasy;
    this.getAccessToken = deps.getAccessToken ?? getAccessToken;
  }

  /** Serve from cache, or call Yahoo with a fresh access token and cache the answer. Failures are never cached. */
  private async cached<T>(
    cacheKey: string,
    ttlMs: number,
    request: (yf: YahooFantasy) => Promise<T>
  ): Promise<T> {
    const hit = cache.get<T>(cacheKey);
    if (hit !== undefined) return hit;

    this.yf ??= this.createYahooFantasy();
    this.yf.setUserToken(await this.getAccessToken());

    let result: T;
    try {
      result = await request(this.yf);
    } catch (err: unknown) {
      throw new YahooApiError(describeYahooError(err), { cause: err });
    }
    cache.set(cacheKey, result, ttlMs);
    return result;
  }

  // ---------------------------------------------------------------------------
  // League info
  // ---------------------------------------------------------------------------

  getLeagueSettings(leagueKey: string): Promise<any> {
    return this.cached(`league_settings:${leagueKey}`, SESSION_TTL, (yf) =>
      yf.league.settings(leagueKey)
    );
  }

  getStandings(leagueKey: string): Promise<any> {
    return this.cached(`standings:${leagueKey}`, STANDINGS_TTL, (yf) =>
      yf.league.standings(leagueKey)
    );
  }

  getScoreboard(leagueKey: string, week?: number): Promise<any> {
    return this.cached(`scoreboard:${leagueKey}:${week ?? "current"}`, SCOREBOARD_TTL, (yf) =>
      // Only pass week if defined — yahoo-fantasy builds `;week=undefined` otherwise
      week !== undefined ? yf.league.scoreboard(leagueKey, week) : yf.league.scoreboard(leagueKey)
    );
  }

  getTeams(leagueKey: string): Promise<any> {
    return this.cached(`teams:${leagueKey}`, STANDINGS_TTL, (yf) => yf.league.teams(leagueKey));
  }

  getTeamRoster(leagueKey: string, teamKey: string): Promise<any> {
    return this.cached(`roster:${leagueKey}:${teamKey}`, ROSTER_TTL, (yf) =>
      yf.team.roster(teamKey)
    );
  }

  // ---------------------------------------------------------------------------
  // Player data
  // ---------------------------------------------------------------------------

  searchPlayers(leagueKey: string, name: string): Promise<any> {
    return this.cached(`search_players:${leagueKey}:${name}`, PLAYER_TTL, (yf) =>
      // yahoo-fantasy exposes league player queries via yf.players.leagues
      yf.players.leagues(leagueKey, { search: name })
    );
  }

  getFreeAgents(leagueKey: string, options: FreeAgentOptions = {}): Promise<any> {
    const { position, sort_by, sort_type, limit } = options;
    const cacheKey = `free_agents:${leagueKey}:${position ?? ""}:${sort_by ?? ""}:${sort_type ?? ""}:${limit ?? ""}`;

    return this.cached(cacheKey, PLAYER_TTL, (yf) => {
      const filters: Record<string, unknown> = { status: "FA" };
      if (position) filters["position"] = position;
      if (sort_by) filters["sort"] = resolveSortKey(sort_by);
      if (sort_type) filters["sort_type"] = sort_type;
      if (limit !== undefined) filters["count"] = limit;

      // Request stats subresource so players come with their averages attached
      return yf.players.leagues(leagueKey, filters, "stats");
    });
  }

  async getPlayerStats(leagueKey: string, playerKey: string): Promise<any> {
    const rawStats = await this.cached(`player_stats:${leagueKey}:${playerKey}`, PLAYER_TTL, (yf) =>
      yf.player.stats(playerKey)
    );

    // Map stat IDs to human-readable names using league settings.
    const statMap = await getStatMapping(leagueKey, () => this.getLeagueSettings(leagueKey));

    // The yahoo-fantasy package typically returns stats under player_stats.stats.stat
    const statArray: Array<{ stat_id: string | number; value: string }> =
      rawStats?.player_stats?.stats?.stat ?? [];

    return {
      ...rawStats,
      mapped_stats: statArray.length > 0 ? mapStats(statArray, statMap) : {},
    };
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
