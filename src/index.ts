import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { createServer } from "./server.js";
import { YahooClient } from "./yahoo-client.js";
import { loadConfig, saveConfig } from "./token-store.js";

async function main() {
  const server = createServer({
    yahoo: new YahooClient(),
    config: { load: loadConfig, save: saveConfig },
  });
  await server.connect(new StdioServerTransport());
  console.error("Yahoo Fantasy Basketball MCP server started");
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
