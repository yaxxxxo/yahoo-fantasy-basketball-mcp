import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { server } from "./server.js";

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("Yahoo Fantasy Basketball MCP server started");
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
