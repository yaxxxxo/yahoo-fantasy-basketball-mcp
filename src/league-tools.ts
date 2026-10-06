import { z } from "zod";
import { yahooClient } from "./yahoo-client.js";
import { getDefaultLeagueKey } from "./config-tools.js";

const LeagueKeySchema = z.object({
  league_key: z.string().optional().describe("Yahoo league key, uses default if not provided"),
});

const ScoreboardSchema = z.object({
  league_key: z.string().optional().describe("Yahoo league key, uses default if not provided"),
  week: z.coerce.number().optional().describe("Week number, defaults to current week"),
});

const TeamRosterSchema = z.object({
  team_key: z.string().describe("The team key (e.g., 'nba.l.12345.t.1')"),
  league_key: z.string().optional().describe("Yahoo league key, uses default if not provided"),
});

export const leagueToolDefinitions = [
  {
    name: "get_league_settings",
    description: "Get league settings including scoring type, roster positions, and trade deadline",
    inputSchema: {
      type: "object",
      properties: {
        league_key: {
          type: "string",
          description: "Yahoo league key, uses default if not provided",
        },
      },
      required: [],
    },
  },
  {
    name: "get_standings",
    description: "Get current league standings with win/loss records and category totals",
    inputSchema: {
      type: "object",
      properties: {
        league_key: {
          type: "string",
          description: "Yahoo league key, uses default if not provided",
        },
      },
      required: [],
    },
  },
  {
    name: "get_scoreboard",
    description: "Get matchup scores for the current or specified week",
    inputSchema: {
      type: "object",
      properties: {
        league_key: {
          type: "string",
          description: "Yahoo league key, uses default if not provided",
        },
        week: {
          type: "number",
          description: "Week number, defaults to current week",
        },
      },
      required: [],
    },
  },
  {
    name: "get_teams",
    description: "Get all teams in the league with basic info",
    inputSchema: {
      type: "object",
      properties: {
        league_key: {
          type: "string",
          description: "Yahoo league key, uses default if not provided",
        },
      },
      required: [],
    },
  },
  {
    name: "get_team_roster",
    description: "Get a team's full roster with player details, stats, and positions",
    inputSchema: {
      type: "object",
      properties: {
        team_key: {
          type: "string",
          description: "The team key (e.g., 'nba.l.12345.t.1')",
        },
        league_key: {
          type: "string",
          description: "Yahoo league key, uses default if not provided",
        },
      },
      required: ["team_key"],
    },
  },
];

export async function handleLeagueTool(
  name: string,
  args: unknown
): Promise<{ content: Array<{ type: "text"; text: string }> }> {
  if (name === "get_league_settings") {
    try {
      const parsed = LeagueKeySchema.parse(args);
      const leagueKey = await getDefaultLeagueKey(parsed.league_key);
      const result = await yahooClient.getLeagueSettings(leagueKey);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    } catch (error: any) {
      return { content: [{ type: "text", text: error.message }], isError: true } as any;
    }
  }

  if (name === "get_standings") {
    try {
      const parsed = LeagueKeySchema.parse(args);
      const leagueKey = await getDefaultLeagueKey(parsed.league_key);
      const result = await yahooClient.getStandings(leagueKey);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    } catch (error: any) {
      return { content: [{ type: "text", text: error.message }], isError: true } as any;
    }
  }

  if (name === "get_scoreboard") {
    try {
      const parsed = ScoreboardSchema.parse(args);
      const leagueKey = await getDefaultLeagueKey(parsed.league_key);
      const result = await yahooClient.getScoreboard(leagueKey, parsed.week);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    } catch (error: any) {
      return { content: [{ type: "text", text: error.message }], isError: true } as any;
    }
  }

  if (name === "get_teams") {
    try {
      const parsed = LeagueKeySchema.parse(args);
      const leagueKey = await getDefaultLeagueKey(parsed.league_key);
      const result = await yahooClient.getTeams(leagueKey);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    } catch (error: any) {
      return { content: [{ type: "text", text: error.message }], isError: true } as any;
    }
  }

  if (name === "get_team_roster") {
    try {
      const parsed = TeamRosterSchema.parse(args);
      const leagueKey = await getDefaultLeagueKey(parsed.league_key);
      const result = await yahooClient.getTeamRoster(leagueKey, parsed.team_key);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    } catch (error: any) {
      return { content: [{ type: "text", text: error.message }], isError: true } as any;
    }
  }

  throw new Error(`Unknown league tool: ${name}`);
}
