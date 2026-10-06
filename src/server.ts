import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { CallToolRequestSchema, ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import { configToolDefinitions, handleConfigTool } from "./config-tools.js";
import { leagueToolDefinitions, handleLeagueTool } from "./league-tools.js";
import { playerToolDefinitions, handlePlayerTool } from "./player-tools.js";
import { analyticsToolDefinitions, handleAnalyticsTool } from "./analytics-tools.js";

export const server = new Server(
  { name: "yahoo-fantasy-basketball", version: "1.0.0" },
  { capabilities: { tools: {} } }
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [...configToolDefinitions, ...leagueToolDefinitions, ...playerToolDefinitions, ...analyticsToolDefinitions],
}));

type ToolHandler = (
  name: string,
  args: unknown
) => Promise<{ content: Array<{ type: "text"; text: string }> }>;

const toolHandlerMap: Record<string, ToolHandler> = {
  set_default_league: handleConfigTool,
  get_league_settings: handleLeagueTool,
  get_standings: handleLeagueTool,
  get_scoreboard: handleLeagueTool,
  get_teams: handleLeagueTool,
  get_team_roster: handleLeagueTool,
  search_players: handlePlayerTool,
  get_free_agents: handlePlayerTool,
  get_player_stats: handlePlayerTool,
  get_matchup_projection: handleAnalyticsTool,
  get_streaming_recommendations: handleAnalyticsTool,
};

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;
  const handler = toolHandlerMap[name];

  if (!handler) {
    return {
      content: [{ type: "text", text: `Unknown tool: ${name}` }],
      isError: true,
    };
  }

  return handler(name, args);
});
