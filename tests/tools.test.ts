import { describe, it, expect } from "vitest";
import { allTools } from "../src/server.js";
import { runTool } from "../src/tool.js";
import { YahooApiError } from "../src/errors.js";
import { fakeContext } from "./helpers/fakes.js";

const tool = (name: string) => {
  const found = allTools.find((t) => t.name === name);
  if (!found) throw new Error(`no tool named ${name}`);
  return found;
};

describe("league tools", () => {
  it("get_standings returns Yahoo's standings for the default league as JSON", async () => {
    const { ctx, yahoo } = fakeContext({ default_league_key: "nba.l.7" });
    yahoo.getStandings.mockResolvedValue({ standings: [{ name: "Team A" }] });

    const result = await runTool(tool("get_standings"), {}, ctx);

    expect(yahoo.getStandings).toHaveBeenCalledWith("nba.l.7");
    expect(result.isError).toBeUndefined();
    expect(JSON.parse(result.content[0].text)).toEqual({ standings: [{ name: "Team A" }] });
  });

  it("an explicit league_key overrides the default league", async () => {
    const { ctx, yahoo } = fakeContext({ default_league_key: "nba.l.7" });
    yahoo.getTeams.mockResolvedValue({});

    await runTool(tool("get_teams"), { league_key: "nba.l.42" }, ctx);

    expect(yahoo.getTeams).toHaveBeenCalledWith("nba.l.42");
  });

  it("get_scoreboard accepts the week as a numeric string", async () => {
    const { ctx, yahoo } = fakeContext();
    yahoo.getScoreboard.mockResolvedValue({});

    await runTool(tool("get_scoreboard"), { week: "3" }, ctx);

    expect(yahoo.getScoreboard).toHaveBeenCalledWith("nba.l.1", 3);
  });

  it("get_team_roster requires a team key", async () => {
    const { ctx, yahoo } = fakeContext();

    const result = await runTool(tool("get_team_roster"), {}, ctx);

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toMatch(/team_key/);
    expect(yahoo.getTeamRoster).not.toHaveBeenCalled();
  });
});

describe("failures", () => {
  it("a Yahoo failure is reported as a tool error carrying Yahoo's message", async () => {
    const { ctx, yahoo } = fakeContext();
    yahoo.getLeagueSettings.mockRejectedValue(new YahooApiError("League key nba.l.1 does not exist."));

    const result = await runTool(tool("get_league_settings"), {}, ctx);

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toBe("League key nba.l.1 does not exist.");
  });

  it("having no league to act on is reported as a tool error", async () => {
    const { ctx, yahoo } = fakeContext({});

    const result = await runTool(tool("get_standings"), {}, ctx);

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toMatch(/No league specified/);
    expect(yahoo.getStandings).not.toHaveBeenCalled();
  });
});

describe("player tools", () => {
  it("get_free_agents forwards filters to Yahoo", async () => {
    const { ctx, yahoo } = fakeContext();
    yahoo.getFreeAgents.mockResolvedValue([]);

    await runTool(
      tool("get_free_agents"),
      { position: "C", sort_by: "BLK", sort_type: "lastweek", limit: 5 },
      ctx
    );

    expect(yahoo.getFreeAgents).toHaveBeenCalledWith("nba.l.1", {
      position: "C",
      sort_by: "BLK",
      sort_type: "lastweek",
      limit: 5,
    });
  });

  it("get_free_agents rejects an unknown sort_type", async () => {
    const { ctx } = fakeContext();

    const result = await runTool(tool("get_free_agents"), { sort_type: "yesterday" }, ctx);

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toMatch(/sort_type/);
  });
});

describe("analytics tools", () => {
  const scoreboard = {
    matchups: [
      { teams: [{ team_key: "nba.l.1.t.1", name: "Alpha" }, { team_key: "nba.l.1.t.2", name: "Beta" }] },
      { teams: [{ team_key: "nba.l.1.t.3", name: "Gamma" }, { team_key: "nba.l.1.t.4", name: "Delta" }] },
    ],
  };

  it("get_matchup_projection returns both rosters of the matchup containing team_key", async () => {
    const { ctx, yahoo } = fakeContext();
    yahoo.getScoreboard.mockResolvedValue(scoreboard);
    yahoo.getTeamRoster.mockImplementation(async (_league: string, teamKey: string) => ({
      roster_of: teamKey,
    }));

    const result = await runTool(tool("get_matchup_projection"), { team_key: "nba.l.1.t.4" }, ctx);

    const body = JSON.parse(result.content[0].text);
    expect(body.matchup.teams).toEqual([
      { team_key: "nba.l.1.t.3", team_name: "Gamma", roster: { roster_of: "nba.l.1.t.3" } },
      { team_key: "nba.l.1.t.4", team_name: "Delta", roster: { roster_of: "nba.l.1.t.4" } },
    ]);
  });

  it("get_streaming_recommendations asks for 15 free agents over the last month by default", async () => {
    const { ctx, yahoo } = fakeContext();
    yahoo.getScoreboard.mockResolvedValue(scoreboard);
    yahoo.getFreeAgents.mockResolvedValue([{ name: "Streamer" }]);

    const result = await runTool(tool("get_streaming_recommendations"), { sort_category: "3PTM" }, ctx);

    expect(yahoo.getFreeAgents).toHaveBeenCalledWith("nba.l.1", {
      position: undefined,
      sort_by: "3PTM",
      sort_type: "lastmonth",
      limit: 15,
    });
    expect(JSON.parse(result.content[0].text).free_agents).toEqual([{ name: "Streamer" }]);
  });
});
