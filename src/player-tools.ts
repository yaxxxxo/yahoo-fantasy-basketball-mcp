import { z } from "zod";
import { defineTool } from "./tool.js";
import { leagueKeyArg, resolveLeagueKey } from "./config-tools.js";

export const positionArg = z
  .string()
  .optional()
  .describe("Filter by position: PG, SG, SF, PF, C, G, F, Util");

export const sortTypeArg = z.enum(["season", "lastweek", "lastmonth", "average_season"]).optional();

export const playerTools = [
  defineTool({
    name: "search_players",
    description:
      "Search for players by name. Returns stats, position, and ownership status (free agent, owned, on waivers)",
    schema: {
      name: z.string().describe("Player name to search for"),
      league_key: leagueKeyArg,
    },
    async run(args, ctx) {
      return ctx.yahoo.searchPlayers(await resolveLeagueKey(ctx, args.league_key), args.name);
    },
  }),
  defineTool({
    name: "get_free_agents",
    description:
      "Browse available free agents. Filter by position and sort by stat categories to find the best available players",
    schema: {
      position: positionArg,
      sort_by: z
        .string()
        .optional()
        .describe("Sort by stat category (e.g., '3PTM', 'PTS', 'REB', 'AST', 'STL', 'BLK')"),
      sort_type: sortTypeArg.describe(
        "Time window: 'lastweek' (7 days), 'lastmonth' (14 days), 'season', or 'average_season'"
      ),
      limit: z.coerce.number().optional().describe("Max results to return, default 25"),
      league_key: leagueKeyArg,
    },
    async run(args, ctx) {
      const leagueKey = await resolveLeagueKey(ctx, args.league_key);
      return ctx.yahoo.getFreeAgents(leagueKey, {
        position: args.position,
        sort_by: args.sort_by,
        sort_type: args.sort_type,
        limit: args.limit,
      });
    },
  }),
  defineTool({
    name: "get_player_stats",
    description:
      "Get detailed stats for a specific player including season averages and recent performance",
    schema: {
      player_key: z.string().describe("The player key (e.g., 'nba.p.12345')"),
      league_key: leagueKeyArg,
    },
    async run(args, ctx) {
      const leagueKey = await resolveLeagueKey(ctx, args.league_key);
      return ctx.yahoo.getPlayerStats(leagueKey, args.player_key);
    },
  }),
];
