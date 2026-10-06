import { z } from "zod";
import { defineTool } from "./tool.js";
import { leagueKeyArg, resolveLeagueKey } from "./config-tools.js";

export const leagueTools = [
  defineTool({
    name: "get_league_settings",
    description: "Get league settings including scoring type, roster positions, and trade deadline",
    schema: { league_key: leagueKeyArg },
    async run(args, ctx) {
      return ctx.yahoo.getLeagueSettings(await resolveLeagueKey(ctx, args.league_key));
    },
  }),
  defineTool({
    name: "get_standings",
    description: "Get current league standings with win/loss records and category totals",
    schema: { league_key: leagueKeyArg },
    async run(args, ctx) {
      return ctx.yahoo.getStandings(await resolveLeagueKey(ctx, args.league_key));
    },
  }),
  defineTool({
    name: "get_scoreboard",
    description: "Get matchup scores for the current or specified week",
    schema: {
      league_key: leagueKeyArg,
      week: z.coerce.number().optional().describe("Week number, defaults to current week"),
    },
    async run(args, ctx) {
      return ctx.yahoo.getScoreboard(await resolveLeagueKey(ctx, args.league_key), args.week);
    },
  }),
  defineTool({
    name: "get_teams",
    description: "Get all teams in the league with basic info",
    schema: { league_key: leagueKeyArg },
    async run(args, ctx) {
      return ctx.yahoo.getTeams(await resolveLeagueKey(ctx, args.league_key));
    },
  }),
  defineTool({
    name: "get_team_roster",
    description: "Get a team's full roster with player details, stats, and positions",
    schema: {
      team_key: z.string().describe("The team key (e.g., 'nba.l.12345.t.1')"),
      league_key: leagueKeyArg,
    },
    async run(args, ctx) {
      const leagueKey = await resolveLeagueKey(ctx, args.league_key);
      return ctx.yahoo.getTeamRoster(leagueKey, args.team_key);
    },
  }),
];
