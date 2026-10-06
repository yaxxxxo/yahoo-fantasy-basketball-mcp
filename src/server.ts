import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { configTools } from "./config-tools.js";
import { leagueTools } from "./league-tools.js";
import { playerTools } from "./player-tools.js";
import { analyticsTools } from "./analytics-tools.js";
import { runTool, type ToolContext, type ToolDef } from "./tool.js";

export const allTools: ToolDef<any>[] = [
  ...configTools,
  ...leagueTools,
  ...playerTools,
  ...analyticsTools,
];

export function createServer(ctx: ToolContext): McpServer {
  const server = new McpServer({ name: "yahoo-fantasy-basketball", version: "1.0.0" });

  for (const tool of allTools) {
    server.registerTool(
      tool.name,
      { description: tool.description, inputSchema: tool.schema },
      (args: unknown) => runTool(tool, args, ctx)
    );
  }

  return server;
}
