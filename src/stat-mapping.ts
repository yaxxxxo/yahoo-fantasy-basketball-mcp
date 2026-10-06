import { cache, SESSION_TTL } from "./cache.js";

const STAT_MAP_CACHE_KEY = "stat_mapping";

export const DEFAULT_STAT_MAP: Record<string, string> = {
  "5": "FGA",
  "6": "FGM",
  "7": "FG%",
  "8": "FTA",
  "9": "FTM",
  "10": "FT%",
  "11": "3PA",
  "12": "3PM",
  "13": "3P%",
  "15": "PTS",
  "16": "OREB",
  "17": "DREB",
  "18": "REB",
  "19": "AST",
  "20": "ST",
  "21": "BLK",
  "22": "TO",
  "23": "A/T",
  "24": "PF",
  "25": "DISQ",
  "26": "TECH",
  "27": "EJCT",
  "28": "FF",
  "29": "MPG",
  "30": "DD",
  "31": "TD",
  "32": "QD",
  "33": "MIN",
};

export async function getStatMapping(
  fetchLeagueSettings: () => Promise<any>
): Promise<Record<string, string>> {
  const cached = cache.get<Record<string, string>>(STAT_MAP_CACHE_KEY);
  if (cached !== undefined) {
    return cached;
  }

  try {
    const settings = await fetchLeagueSettings();

    // League settings typically expose stat categories under various paths.
    // Try common shapes returned by Yahoo Fantasy API.
    const categories: Array<{ stat_id: string | number; display_name: string }> =
      settings?.stat_categories?.stats?.stat ??
      settings?.stat_categories ??
      settings?.stats ??
      [];

    if (Array.isArray(categories) && categories.length > 0) {
      const mapping: Record<string, string> = {};
      for (const cat of categories) {
        if (cat.stat_id !== undefined && cat.display_name !== undefined) {
          mapping[String(cat.stat_id)] = cat.display_name;
        }
      }
      if (Object.keys(mapping).length > 0) {
        cache.set(STAT_MAP_CACHE_KEY, mapping, SESSION_TTL);
        return mapping;
      }
    }
  } catch {
    // Fall through to default map
  }

  cache.set(STAT_MAP_CACHE_KEY, DEFAULT_STAT_MAP, SESSION_TTL);
  return DEFAULT_STAT_MAP;
}

export function mapStats(
  rawStats: Array<{ stat_id: string | number; value: string }>,
  statMap: Record<string, string>
): Record<string, string> {
  const result: Record<string, string> = {};
  for (const { stat_id, value } of rawStats) {
    const key = statMap[String(stat_id)];
    if (key !== undefined) {
      result[key] = value;
    }
  }
  return result;
}
