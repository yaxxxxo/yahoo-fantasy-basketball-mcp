import { z } from "zod";
import { defineTool } from "./tool.js";
import { leagueKeyArg, resolveLeagueKey } from "./config-tools.js";
import { positionArg, sortTypeArg } from "./player-tools.js";

export const analyticsTools = [
  defineTool({
    name: "get_matchup_projection",
    description:
      "Project category totals for your matchup in a given week. Calculates projected stats based on each player's per-game averages multiplied by their number of scheduled games that week.",
    schema: {
      week: z.coerce.number().optional().describe("Week number, defaults to current/next week"),
      team_key: z.string().optional().describe("Your team key, defaults to your team"),
      league_key: leagueKeyArg,
    },
    async run(args, ctx) {
      const leagueKey = await resolveLeagueKey(ctx, args.league_key);
      const scoreboard: any = await ctx.yahoo.getScoreboard(leagueKey, args.week);

      const matchups: any[] =
        scoreboard?.scoreboard?.matchups?.matchup ?? scoreboard?.matchups ?? [];
      const teamsOf = (matchup: any): any[] => matchup?.teams?.team ?? matchup?.teams ?? [];
      const keyOf = (team: any): string => team?.team_key ?? team?.team?.[0]?.[1]?.team_key ?? team;

      // The matchup containing team_key if given, otherwise the first one
      const targetMatchup =
        (args.team_key && matchups.find((m) => teamsOf(m).some((t) => keyOf(t) === args.team_key))) ||
        matchups[0];

      const teams = await Promise.all(
        teamsOf(targetMatchup).map(async (team: any) => {
          const teamKey = keyOf(team);
          return {
            team_key: teamKey,
            team_name: team?.name ?? team?.team?.[0]?.[3]?.name ?? teamKey,
            roster: await ctx.yahoo.getTeamRoster(leagueKey, teamKey),
          };
        })
      );

      return {
        week: args.week ?? "current",
        note:
          "Per-game averages are provided per player. Multiply by each player's scheduled games this week to get projected totals. Game count data may be available in the roster.players entries if the API returns it.",
        matchup: { teams },
        scoreboard_raw: scoreboard,
      };
    },
  }),
  defineTool({
    name: "get_streaming_recommendations",
    description:
      "Find free agents to stream. Returns top-performing free agents sorted by a category (3PTM, PTS, REB, etc.) with recent stats attached, along with current matchup context. Use sort_category to target categories where you're losing or close.",
    schema: {
      week: z.coerce.number().optional().describe("Week number"),
      sort_category: z
        .string()
        .optional()
        .describe("Category to sort free agents by (e.g., '3PTM', 'PTS', 'REB', 'AST', 'STL', 'BLK')"),
      sort_type: sortTypeArg.describe(
        "Stats time window: 'lastweek' (7 days), 'lastmonth' (14 days), 'season', or 'average_season'. Defaults to 'lastmonth'."
      ),
      position: positionArg,
      limit: z.coerce.number().optional().describe("Max recommendations, default 15"),
      league_key: leagueKeyArg,
    },
    async run(args, ctx) {
      const leagueKey = await resolveLeagueKey(ctx, args.league_key);
      const sort_type = args.sort_type ?? "lastmonth";

      const [scoreboard, freeAgents] = await Promise.all([
        ctx.yahoo.getScoreboard(leagueKey, args.week),
        ctx.yahoo.getFreeAgents(leagueKey, {
          position: args.position,
          sort_by: args.sort_category,
          sort_type,
          limit: args.limit ?? 15,
        }),
      ]);

      return {
        week: args.week ?? "current",
        sort_category: args.sort_category ?? "default (Yahoo ranking)",
        sort_type,
        note: args.sort_category
          ? `Free agents sorted by ${args.sort_category} over the ${sort_type} time window. Stats are attached to each player for comparison. Cross-reference the scoreboard to see which categories you need help in.`
          : "No sort_category provided — returning default Yahoo free agent ranking. Pass sort_category (e.g., '3PTM') to get players ranked by a specific stat.",
        scoreboard,
        free_agents: freeAgents,
      };
    },
  }),
];
