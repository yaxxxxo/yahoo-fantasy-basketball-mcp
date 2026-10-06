import { z } from "zod";
import { yahooClient } from "./yahoo-client.js";
import { getDefaultLeagueKey } from "./config-tools.js";

const MatchupProjectionSchema = z.object({
  week: z.coerce.number().optional().describe("Week number, defaults to current/next week"),
  team_key: z.string().optional().describe("Your team key, defaults to your team"),
  league_key: z.string().optional().describe("Yahoo league key, uses default if not provided"),
});

const StreamingRecommendationsSchema = z.object({
  week: z.coerce.number().optional().describe("Week number"),
  sort_category: z.string().optional().describe(
    "Category to sort free agents by (e.g., '3PTM', 'PTS', 'REB', 'AST', 'STL', 'BLK'). Returns top performers in that category."
  ),
  sort_type: z.enum(["season", "lastweek", "lastmonth", "average_season"]).optional().describe(
    "Time window for stats sorting: 'lastweek' (7 days), 'lastmonth' (14 days), 'season', or 'average_season'. Defaults to 'lastmonth' for recent form."
  ),
  position: z.string().optional().describe("Filter by position: PG, SG, SF, PF, C, G, F, Util"),
  limit: z.coerce.number().optional().describe("Max recommendations, default 15"),
  league_key: z.string().optional().describe("Yahoo league key, uses default if not provided"),
});

export const analyticsToolDefinitions = [
  {
    name: "get_matchup_projection",
    description:
      "Project category totals for your matchup in a given week. Calculates projected stats based on each player's per-game averages multiplied by their number of scheduled games that week.",
    inputSchema: {
      type: "object",
      properties: {
        week: {
          type: "number",
          description: "Week number, defaults to current/next week",
        },
        team_key: {
          type: "string",
          description: "Your team key, defaults to your team",
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
    name: "get_streaming_recommendations",
    description:
      "Find free agents to stream. Returns top-performing free agents sorted by a category (3PTM, PTS, REB, etc.) with recent stats attached, along with current matchup context. Use sort_category to target categories where you're losing or close.",
    inputSchema: {
      type: "object",
      properties: {
        week: {
          type: "number",
          description: "Week number",
        },
        sort_category: {
          type: "string",
          description: "Category to sort free agents by (e.g., '3PTM', 'PTS', 'REB', 'AST', 'STL', 'BLK')",
        },
        sort_type: {
          type: "string",
          enum: ["season", "lastweek", "lastmonth", "average_season"],
          description: "Stats time window: 'lastweek' (7 days), 'lastmonth' (14 days), 'season', or 'average_season'. Defaults to 'lastmonth'.",
        },
        position: {
          type: "string",
          description: "Filter by position: PG, SG, SF, PF, C, G, F, Util",
        },
        limit: {
          type: "number",
          description: "Max recommendations, default 15",
        },
        league_key: {
          type: "string",
          description: "Yahoo league key, uses default if not provided",
        },
      },
      required: [],
    },
  },
];

export async function handleAnalyticsTool(
  name: string,
  args: unknown
): Promise<{ content: Array<{ type: "text"; text: string }> }> {
  if (name === "get_matchup_projection") {
    try {
      const parsed = MatchupProjectionSchema.parse(args);
      const leagueKey = await getDefaultLeagueKey(parsed.league_key);

      // Step 1: Get the scoreboard to find the current matchup
      const scoreboard = await yahooClient.getScoreboard(leagueKey, parsed.week);

      // Step 2: Identify both teams in the matchup
      // If team_key provided, find the matchup containing that team; otherwise use first matchup
      const matchups: any[] =
        scoreboard?.scoreboard?.matchups?.matchup ??
        scoreboard?.matchups ??
        [];

      let targetMatchup: any = null;
      if (parsed.team_key) {
        targetMatchup = matchups.find((m: any) => {
          const teams: any[] = m?.teams?.team ?? m?.teams ?? [];
          return teams.some(
            (t: any) =>
              (t?.team_key ?? t?.team?.[0]?.[1]?.team_key) === parsed.team_key
          );
        });
      }
      if (!targetMatchup && matchups.length > 0) {
        targetMatchup = matchups[0];
      }

      const matchupTeams: any[] =
        targetMatchup?.teams?.team ?? targetMatchup?.teams ?? [];

      // Step 3: Fetch roster (with stats) for each team in the matchup
      const rosterResults = await Promise.all(
        matchupTeams.map(async (teamEntry: any) => {
          const teamKey =
            teamEntry?.team_key ??
            teamEntry?.team?.[0]?.[1]?.team_key ??
            teamEntry;
          const teamName =
            teamEntry?.name ??
            teamEntry?.team?.[0]?.[3]?.name ??
            teamKey;
          const roster = await yahooClient.getTeamRoster(leagueKey, teamKey);
          return { teamKey, teamName, roster };
        })
      );

      const result = {
        week: parsed.week ?? "current",
        note:
          "Per-game averages are provided per player. Multiply by each player's scheduled games this week to get projected totals. Game count data may be available in the roster.players entries if the API returns it.",
        matchup: {
          teams: rosterResults.map(({ teamKey, teamName, roster }) => ({
            team_key: teamKey,
            team_name: teamName,
            roster,
          })),
        },
        scoreboard_raw: scoreboard,
      };

      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    } catch (error: any) {
      return { content: [{ type: "text", text: error.message }], isError: true } as any;
    }
  }

  if (name === "get_streaming_recommendations") {
    try {
      const parsed = StreamingRecommendationsSchema.parse(args);
      const leagueKey = await getDefaultLeagueKey(parsed.league_key);
      const limit = parsed.limit ?? 15;
      const sort_type = parsed.sort_type ?? "lastmonth";

      // Fetch scoreboard (matchup context) and top free agents in parallel
      const [scoreboard, freeAgents] = await Promise.all([
        yahooClient.getScoreboard(leagueKey, parsed.week),
        yahooClient.getFreeAgents(leagueKey, {
          position: parsed.position,
          sort_by: parsed.sort_category,
          sort_type,
          limit,
        }),
      ]);

      const result = {
        week: parsed.week ?? "current",
        sort_category: parsed.sort_category ?? "default (Yahoo ranking)",
        sort_type,
        note: parsed.sort_category
          ? `Free agents sorted by ${parsed.sort_category} over the ${sort_type} time window. Stats are attached to each player for comparison. Cross-reference the scoreboard to see which categories you need help in.`
          : "No sort_category provided — returning default Yahoo free agent ranking. Pass sort_category (e.g., '3PTM') to get players ranked by a specific stat.",
        scoreboard,
        free_agents: freeAgents,
      };

      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    } catch (error: any) {
      return { content: [{ type: "text", text: error.message }], isError: true } as any;
    }
  }

  throw new Error(`Unknown analytics tool: ${name}`);
}
