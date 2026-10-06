import { describe, it, expect } from "vitest";
import { configTools, resolveLeagueKey } from "../src/config-tools.js";
import { runTool } from "../src/tool.js";
import { fakeContext } from "./helpers/fakes.js";

const [setDefaultLeague] = configTools;

describe("set_default_league", () => {
  it("saves a well-formed league key as the default", async () => {
    const { ctx, config } = fakeContext();

    const result = await runTool(setDefaultLeague, { league_key: "nba.l.12345" }, ctx);

    expect(config.save).toHaveBeenCalledWith({ default_league_key: "nba.l.12345" });
    expect(result.isError).toBeUndefined();
    expect(result.content[0].text).toContain("nba.l.12345");
  });

  it.each(["invalid-key", "nba_l_12345", "nba.l.abc", "NBA.l.12345"])(
    "rejects malformed league key %s without saving",
    async (league_key) => {
      const { ctx, config } = fakeContext();

      const result = await runTool(setDefaultLeague, { league_key }, ctx);

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toMatch(/Invalid league_key format/);
      expect(config.save).not.toHaveBeenCalled();
    }
  );

  it("reports a missing league key as an error", async () => {
    const { ctx } = fakeContext();

    const result = await runTool(setDefaultLeague, {}, ctx);

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toMatch(/league_key/);
  });
});

describe("resolveLeagueKey", () => {
  it("prefers an explicit key without reading config", async () => {
    const { ctx, config } = fakeContext();

    expect(await resolveLeagueKey(ctx, "nba.l.99999")).toBe("nba.l.99999");
    expect(config.load).not.toHaveBeenCalled();
  });

  it("falls back to the configured default league", async () => {
    const { ctx } = fakeContext({ default_league_key: "nba.l.54321" });

    expect(await resolveLeagueKey(ctx)).toBe("nba.l.54321");
  });

  it("fails when there is neither an explicit key nor a default", async () => {
    const { ctx } = fakeContext({});

    await expect(resolveLeagueKey(ctx)).rejects.toThrow(/No league specified/);
  });
});
