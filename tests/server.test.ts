import { describe, it, expect } from "vitest";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { createServer } from "../src/server.js";
import { YahooApiError } from "../src/errors.js";
import { fakeContext } from "./helpers/fakes.js";

async function connect(ctx = fakeContext()) {
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  const client = new Client({ name: "test", version: "0" });
  await Promise.all([createServer(ctx.ctx).connect(serverTransport), client.connect(clientTransport)]);
  return { client, ...ctx };
}

describe("MCP server", () => {
  it("advertises every tool with its argument schema", async () => {
    const { client } = await connect();

    const { tools } = await client.listTools();

    expect(tools.map((t) => t.name).sort()).toEqual([
      "get_free_agents",
      "get_league_settings",
      "get_matchup_projection",
      "get_player_stats",
      "get_scoreboard",
      "get_standings",
      "get_streaming_recommendations",
      "get_team_roster",
      "get_teams",
      "search_players",
      "set_default_league",
    ]);
    const roster = tools.find((t) => t.name === "get_team_roster")!;
    expect(roster.inputSchema.required).toEqual(["team_key"]);
    expect(Object.keys(roster.inputSchema.properties!)).toEqual(["team_key", "league_key"]);
  });

  it("answers a tool call end to end", async () => {
    const { client, yahoo } = await connect();
    yahoo.getTeams.mockResolvedValue([{ name: "Alpha" }]);

    const result = await client.callTool({ name: "get_teams", arguments: {} });

    expect(result.isError).toBeFalsy();
    expect(JSON.parse((result.content as any)[0].text)).toEqual([{ name: "Alpha" }]);
  });

  it("marks a Yahoo failure as an error result", async () => {
    const { client, yahoo } = await connect();
    yahoo.getTeams.mockRejectedValue(
      new YahooApiError("This application is not authorized to perform this action.")
    );

    const result = await client.callTool({ name: "get_teams", arguments: {} });

    expect(result.isError).toBe(true);
    expect((result.content as any)[0].text).toContain("not authorized");
  });
});
