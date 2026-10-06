import { describe, it, expect, vi, beforeEach } from "vitest";
import { DEFAULT_STAT_MAP, mapStats, getStatMapping } from "../src/stat-mapping.js";
import { cache } from "../src/cache.js";

describe("DEFAULT_STAT_MAP", () => {
  it('contains "15" -> "PTS"', () => {
    expect(DEFAULT_STAT_MAP["15"]).toBe("PTS");
  });

  it('contains "18" -> "REB"', () => {
    expect(DEFAULT_STAT_MAP["18"]).toBe("REB");
  });

  it('contains "19" -> "AST"', () => {
    expect(DEFAULT_STAT_MAP["19"]).toBe("AST");
  });

  it('contains "20" -> "ST"', () => {
    expect(DEFAULT_STAT_MAP["20"]).toBe("ST");
  });

  it('contains "21" -> "BLK"', () => {
    expect(DEFAULT_STAT_MAP["21"]).toBe("BLK");
  });
});

describe("mapStats", () => {
  it("correctly maps raw stat arrays to named objects", () => {
    const rawStats = [
      { stat_id: "15", value: "25" },
      { stat_id: "18", value: "10" },
      { stat_id: "19", value: "7" },
    ];
    const result = mapStats(rawStats, DEFAULT_STAT_MAP);
    expect(result).toEqual({ PTS: "25", REB: "10", AST: "7" });
  });

  it("skips unknown stat IDs", () => {
    const rawStats = [
      { stat_id: "15", value: "30" },
      { stat_id: "9999", value: "999" }, // unknown
    ];
    const result = mapStats(rawStats, DEFAULT_STAT_MAP);
    expect(result).toEqual({ PTS: "30" });
    expect(Object.keys(result)).not.toContain("9999");
  });

  it("handles empty input", () => {
    const result = mapStats([], DEFAULT_STAT_MAP);
    expect(result).toEqual({});
  });

  it("handles numeric stat_id", () => {
    const rawStats = [{ stat_id: 15, value: "20" }];
    const result = mapStats(rawStats, DEFAULT_STAT_MAP);
    expect(result).toEqual({ PTS: "20" });
  });

  it("maps with a custom stat map", () => {
    const customMap = { "999": "CUSTOM_STAT" };
    const rawStats = [{ stat_id: "999", value: "42" }];
    const result = mapStats(rawStats, customMap);
    expect(result).toEqual({ CUSTOM_STAT: "42" });
  });
});

describe("getStatMapping", () => {
  beforeEach(() => {
    // Clear the shared cache before each test to avoid cross-test contamination
    cache.clear();
  });

  it("returns cached value if available", async () => {
    const customMap = { "15": "PTS_CUSTOM" };
    cache.set("stat_mapping", customMap, Number.MAX_SAFE_INTEGER);

    const fetchLeagueSettings = vi.fn().mockResolvedValue({});
    const result = await getStatMapping(fetchLeagueSettings);

    expect(result).toEqual(customMap);
    expect(fetchLeagueSettings).not.toHaveBeenCalled();
  });

  it("falls back to DEFAULT_STAT_MAP on fetch error", async () => {
    const fetchLeagueSettings = vi.fn().mockRejectedValue(new Error("Network error"));
    const result = await getStatMapping(fetchLeagueSettings);

    expect(result).toEqual(DEFAULT_STAT_MAP);
  });

  it("falls back to DEFAULT_STAT_MAP when settings have no stat categories", async () => {
    const fetchLeagueSettings = vi.fn().mockResolvedValue({});
    const result = await getStatMapping(fetchLeagueSettings);

    expect(result).toEqual(DEFAULT_STAT_MAP);
  });

  it("builds mapping from league settings when available", async () => {
    const fetchLeagueSettings = vi.fn().mockResolvedValue({
      stat_categories: {
        stats: {
          stat: [
            { stat_id: "1", display_name: "GP" },
            { stat_id: "2", display_name: "GS" },
          ],
        },
      },
    });

    const result = await getStatMapping(fetchLeagueSettings);
    expect(result).toEqual({ "1": "GP", "2": "GS" });
  });
});
