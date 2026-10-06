import { describe, it, expect } from "vitest";
import { z } from "zod";
import { describeYahooError, describeToolError } from "../src/errors.js";

describe("describeYahooError", () => {
  it("reads the description out of Yahoo's error object", () => {
    const yahooError = {
      "xml:lang": "en-us",
      "yahoo:uri": "/fantasy/v2/league/nba.l.1/settings?format=json",
      description: "League key nba.l.1 does not exist.",
      detail: "",
    };

    expect(describeYahooError(yahooError)).toBe("League key nba.l.1 does not exist.");
  });

  it("never renders an object as [object Object]", () => {
    expect(describeYahooError({ code: 999 })).toBe('{"code":999}');
  });

  it("passes through strings and Error messages", () => {
    expect(describeYahooError("socket hang up")).toBe("socket hang up");
    expect(describeYahooError(new Error("boom"))).toBe("boom");
  });

  it("tells the manager how to sign in again when Yahoo refuses the login", () => {
    const message = describeYahooError({
      description: "This application is not authorized to perform this action.",
      detail: "",
    });

    expect(message).toContain("not authorized");
    expect(message).toContain("tokens.json");
  });
});

describe("describeToolError", () => {
  it("names the offending argument for validation failures", () => {
    const failure = z.object({ team_key: z.string() }).safeParse({});
    if (failure.success) throw new Error("expected validation to fail");

    expect(describeToolError(failure.error)).toMatch(/^Invalid arguments: team_key: /);
  });
});
