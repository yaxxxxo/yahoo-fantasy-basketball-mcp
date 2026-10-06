import { z } from "zod";
import { defineTool, type ToolContext } from "./tool.js";

export const leagueKeyArg = z
  .string()
  .optional()
  .describe("Yahoo league key, uses default if not provided");

export const configTools = [
  defineTool({
    name: "set_default_league",
    description:
      "Set the default Yahoo Fantasy Basketball league. Once set, all tools will use this league unless a league_key is explicitly provided.",
    schema: {
      league_key: z
        .string()
        .regex(/^[a-z]+\.l\.\d+$/, "Invalid league_key format. Expected format like 'nba.l.12345'.")
        .describe("The Yahoo league key (e.g., 'nba.l.12345')"),
    },
    async run({ league_key }, ctx) {
      await ctx.config.save({ default_league_key: league_key });
      return `Default league set to ${league_key}`;
    },
  }),
];

export async function resolveLeagueKey(ctx: ToolContext, explicitKey?: string): Promise<string> {
  if (explicitKey) return explicitKey;

  const config = await ctx.config.load();
  if (config.default_league_key) return config.default_league_key;

  throw new Error(
    "No league specified. Use set_default_league tool first, or pass league_key parameter."
  );
}
