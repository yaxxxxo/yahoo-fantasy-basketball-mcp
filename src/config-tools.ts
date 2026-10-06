import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { z } from "zod";
import { loadConfig, saveConfig } from "./token-store.js";

const SetDefaultLeagueSchema = z.object({
  league_key: z.string().describe("The Yahoo league key (e.g., 'nba.l.12345')"),
});

export const configToolDefinitions = [
  {
    name: "set_default_league",
    description:
      "Set the default Yahoo Fantasy Basketball league. Once set, all tools will use this league unless a league_key is explicitly provided.",
    inputSchema: {
      type: "object",
      properties: {
        league_key: {
          type: "string",
          description: "The Yahoo league key (e.g., 'nba.l.12345')",
        },
      },
      required: ["league_key"],
    },
  },
];

export async function handleConfigTool(
  name: string,
  args: unknown
): Promise<{ content: Array<{ type: "text"; text: string }> }> {
  if (name === "set_default_league") {
    const parsed = SetDefaultLeagueSchema.parse(args);
    const { league_key } = parsed;

    // Validate league_key format (e.g., nba.l.12345)
    if (!/^[a-z]+\.l\.\d+$/.test(league_key)) {
      throw new Error(
        `Invalid league_key format: "${league_key}". Expected format like 'nba.l.12345'.`
      );
    }

    await saveConfig({ default_league_key: league_key });

    return {
      content: [
        {
          type: "text",
          text: `Default league set to ${league_key}`,
        },
      ],
    };
  }

  throw new Error(`Unknown config tool: ${name}`);
}

export function registerConfigTools(server: Server): void {
  // This function is provided for direct server registration if needed,
  // but the preferred pattern is to use configToolDefinitions + handleConfigTool
  // for composable multi-module registration in server.ts.
  void server; // suppress unused warning — registration is handled via exported arrays
}

export async function getDefaultLeagueKey(explicitKey?: string): Promise<string> {
  if (explicitKey) {
    return explicitKey;
  }

  const config = await loadConfig();
  if (config.default_league_key) {
    return config.default_league_key;
  }

  throw new Error(
    "No league specified. Use set_default_league tool first, or pass league_key parameter."
  );
}
