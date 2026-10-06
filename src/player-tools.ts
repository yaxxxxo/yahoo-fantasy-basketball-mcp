import { z } from "zod";
import { yahooClient } from "./yahoo-client.js";
import { getDefaultLeagueKey } from "./config-tools.js";

const SearchPlayersSchema = z.object({
  name: z.string().describe("Player name to search for"),
  league_key: z.string().optional().describe("Yahoo league key, uses default if not provided"),
});

const FreeAgentsSchema = z.object({
  position: z.string().optional().describe("Filter by position: PG, SG, SF, PF, C, G, F, Util"),
  sort_by: z.string().optional().describe("Sort by stat category (e.g., '3PTM', 'PTS', 'REB', 'AST', 'STL', 'BLK')"),
  sort_type: z.enum(["season", "lastweek", "lastmonth", "average_season"]).optional().describe(
    "Time window for stats: 'lastweek' (7 days), 'lastmonth' (14 days), 'season', or 'average_season'"
  ),
  limit: z.coerce.number().optional().describe("Max results to return, default 25"),
  league_key: z.string().optional().describe("Yahoo league key, uses default if not provided"),
});

const PlayerStatsSchema = z.object({
  player_key: z.string().describe("The player key (e.g., 'nba.p.12345')"),
  league_key: z.string().optional().describe("Yahoo league key, uses default if not provided"),
});

export const playerToolDefinitions = [
  {
    name: "search_players",
    description:
      "Search for players by name. Returns stats, position, and ownership status (free agent, owned, on waivers)",
    inputSchema: {
      type: "object",
      properties: {
        name: {
          type: "string",
          description: "Player name to search for",
        },
        league_key: {
          type: "string",
          description: "Yahoo league key, uses default if not provided",
        },
      },
      required: ["name"],
    },
  },
  {
    name: "get_free_agents",
    description:
      "Browse available free agents. Filter by position and sort by stat categories to find the best available players",
    inputSchema: {
      type: "object",
      properties: {
        position: {
          type: "string",
          description: "Filter by position: PG, SG, SF, PF, C, G, F, Util",
        },
        sort_by: {
          type: "string",
          description: "Sort by stat category (e.g., '3PTM', 'PTS', 'REB', 'AST', 'STL', 'BLK')",
        },
        sort_type: {
          type: "string",
          enum: ["season", "lastweek", "lastmonth", "average_season"],
          description: "Time window: 'lastweek' (7 days), 'lastmonth' (14 days), 'season', or 'average_season'",
        },
        limit: {
          type: "number",
          description: "Max results to return, default 25",
        },
        league_key: {
          type: "string",
          description: "Yahoo league key, uses default if not provided",
        },
      },
      required: [],
    },
  },
  {
    name: "get_player_stats",
    description:
      "Get detailed stats for a specific player including season averages and recent performance",
    inputSchema: {
      type: "object",
      properties: {
        player_key: {
          type: "string",
          description: "The player key (e.g., 'nba.p.12345')",
        },
        league_key: {
          type: "string",
          description: "Yahoo league key, uses default if not provided",
        },
      },
      required: ["player_key"],
    },
  },
];

export async function handlePlayerTool(
  name: string,
  args: unknown
): Promise<{ content: Array<{ type: "text"; text: string }> }> {
  if (name === "search_players") {
    try {
      const parsed = SearchPlayersSchema.parse(args);
      const leagueKey = await getDefaultLeagueKey(parsed.league_key);
      const result = await yahooClient.searchPlayers(leagueKey, parsed.name);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    } catch (error: any) {
      return { content: [{ type: "text", text: error.message }], isError: true } as any;
    }
  }

  if (name === "get_free_agents") {
    try {
      const parsed = FreeAgentsSchema.parse(args);
      const leagueKey = await getDefaultLeagueKey(parsed.league_key);
      const result = await yahooClient.getFreeAgents(leagueKey, {
        position: parsed.position,
        sort_by: parsed.sort_by,
        sort_type: parsed.sort_type,
        limit: parsed.limit,
      });
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    } catch (error: any) {
      return { content: [{ type: "text", text: error.message }], isError: true } as any;
    }
  }

  if (name === "get_player_stats") {
    try {
      const parsed = PlayerStatsSchema.parse(args);
      const leagueKey = await getDefaultLeagueKey(parsed.league_key);
      const result = await yahooClient.getPlayerStats(leagueKey, parsed.player_key);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    } catch (error: any) {
      return { content: [{ type: "text", text: error.message }], isError: true } as any;
    }
  }

  throw new Error(`Unknown player tool: ${name}`);
}
