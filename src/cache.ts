export const SESSION_TTL = Number.MAX_SAFE_INTEGER;
export const STANDINGS_TTL = 5 * 60 * 1000;
export const SCOREBOARD_TTL = 60 * 1000;
export const PLAYER_TTL = 2 * 60 * 1000;
export const ROSTER_TTL = 60 * 1000;

interface CacheEntry {
  data: unknown;
  expiry: number;
}

export class Cache {
  private store = new Map<string, CacheEntry>();

  get<T>(key: string): T | undefined {
    const entry = this.store.get(key);
    if (entry === undefined) return undefined;
    if (Date.now() > entry.expiry) {
      this.store.delete(key);
      return undefined;
    }
    return entry.data as T;
  }

  set<T>(key: string, data: T, ttlMs: number): void {
    this.store.set(key, { data, expiry: Date.now() + ttlMs });
  }

  clear(): void {
    this.store.clear();
  }
}

export const cache = new Cache();
