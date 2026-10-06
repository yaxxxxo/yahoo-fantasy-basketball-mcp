import { describe, it, expect, vi, beforeEach } from "vitest";
import { YahooClient } from "../src/yahoo-client.js";
import { YahooApiError } from "../src/errors.js";
import { cache } from "../src/cache.js";

function clientWith(yf: Record<string, unknown>) {
  const setUserToken = vi.fn();
  const client = new YahooClient({
    createYahooFantasy: () => ({ setUserToken, ...yf }) as any,
    getAccessToken: async () => "token-123",
  });
  return { client, setUserToken };
}

describe("YahooClient", () => {
  beforeEach(() => cache.clear());

  it("calls Yahoo with the current access token", async () => {
    const standings = vi.fn().mockResolvedValue({ standings: [] });
    const { client, setUserToken } = clientWith({ league: { standings } });

    expect(await client.getStandings("nba.l.1")).toEqual({ standings: [] });
    expect(setUserToken).toHaveBeenCalledWith("token-123");
    expect(standings).toHaveBeenCalledWith("nba.l.1");
  });

  it("serves a repeat request from cache", async () => {
    const standings = vi.fn().mockResolvedValue({ standings: [] });
    const { client } = clientWith({ league: { standings } });

    await client.getStandings("nba.l.1");
    await client.getStandings("nba.l.1");

    expect(standings).toHaveBeenCalledTimes(1);
  });

  it("rejects with Yahoo's own description when Yahoo refuses the request", async () => {
    const settings = vi.fn().mockRejectedValue({
      description: "League key nba.l.1 does not exist.",
      detail: "",
    });
    const { client } = clientWith({ league: { settings } });

    const failure = client.getLeagueSettings("nba.l.1");

    await expect(failure).rejects.toBeInstanceOf(YahooApiError);
    await expect(failure).rejects.toThrow("League key nba.l.1 does not exist.");
  });

  it("does not cache a failure", async () => {
    const settings = vi
      .fn()
      .mockRejectedValueOnce("socket hang up")
      .mockResolvedValueOnce({ name: "My League" });
    const { client } = clientWith({ league: { settings } });

    await expect(client.getLeagueSettings("nba.l.1")).rejects.toThrow("socket hang up");
    expect(await client.getLeagueSettings("nba.l.1")).toEqual({ name: "My League" });
  });

  it("omits the week when asking for the current scoreboard", async () => {
    const scoreboard = vi.fn().mockResolvedValue({});
    const { client } = clientWith({ league: { scoreboard } });

    await client.getScoreboard("nba.l.1");
    await client.getScoreboard("nba.l.1", 4);

    expect(scoreboard.mock.calls).toEqual([["nba.l.1"], ["nba.l.1", 4]]);
  });

  it("translates a category abbreviation into Yahoo's stat id when sorting free agents", async () => {
    const leagues = vi.fn().mockResolvedValue([]);
    const { client } = clientWith({ players: { leagues } });

    await client.getFreeAgents("nba.l.1", { sort_by: "stl", limit: 5 });

    expect(leagues).toHaveBeenCalledWith("nba.l.1", { status: "FA", sort: "20", count: 5 }, "stats");
  });

  it("attaches named stats to a player's raw stats", async () => {
    const stats = vi.fn().mockResolvedValue({
      name: "Player One",
      player_stats: { stats: { stat: [{ stat_id: "15", value: "25.1" }] } },
    });
    const settings = vi.fn().mockRejectedValue("unavailable");
    const { client } = clientWith({ player: { stats }, league: { settings } });

    const result = await client.getPlayerStats("nba.l.1", "nba.p.1");

    expect(result.mapped_stats).toEqual({ PTS: "25.1" });
  });
});
