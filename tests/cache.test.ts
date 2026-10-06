import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  Cache,
  SESSION_TTL,
  STANDINGS_TTL,
  SCOREBOARD_TTL,
  PLAYER_TTL,
  ROSTER_TTL,
} from "../src/cache.js";

describe("Cache", () => {
  let cache: Cache;

  beforeEach(() => {
    cache = new Cache();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("get returns undefined for missing keys", () => {
    expect(cache.get("nonexistent")).toBeUndefined();
  });

  it("set + get returns stored data", () => {
    cache.set("key1", { foo: "bar" }, 60_000);
    expect(cache.get("key1")).toEqual({ foo: "bar" });
  });

  it("get returns undefined for expired entries", () => {
    cache.set("key2", "some value", 1_000);
    // Advance time past TTL
    vi.advanceTimersByTime(1_001);
    expect(cache.get("key2")).toBeUndefined();
  });

  it("get returns value just before expiry", () => {
    cache.set("key3", 42, 1_000);
    vi.advanceTimersByTime(999);
    expect(cache.get("key3")).toBe(42);
  });

  it("clear removes all entries", () => {
    cache.set("a", 1, 60_000);
    cache.set("b", 2, 60_000);
    cache.clear();
    expect(cache.get("a")).toBeUndefined();
    expect(cache.get("b")).toBeUndefined();
  });
});

describe("TTL constants", () => {
  it("SESSION_TTL is Number.MAX_SAFE_INTEGER", () => {
    expect(SESSION_TTL).toBe(Number.MAX_SAFE_INTEGER);
  });

  it("STANDINGS_TTL is 5 minutes in ms", () => {
    expect(STANDINGS_TTL).toBe(5 * 60 * 1000);
  });

  it("SCOREBOARD_TTL is 1 minute in ms", () => {
    expect(SCOREBOARD_TTL).toBe(60 * 1000);
  });

  it("PLAYER_TTL is 2 minutes in ms", () => {
    expect(PLAYER_TTL).toBe(2 * 60 * 1000);
  });

  it("ROSTER_TTL is 1 minute in ms", () => {
    expect(ROSTER_TTL).toBe(60 * 1000);
  });
});
