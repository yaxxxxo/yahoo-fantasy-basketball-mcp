import { ZodError } from "zod";
import { join } from "node:path";
import { getConfigDir } from "./token-store.js";

/** A failed call to the Yahoo Fantasy API, carrying a message fit to show the caller. */
export class YahooApiError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = "YahooApiError";
  }
}

function authorizationHint(): string {
  return (
    " The saved Yahoo login does not grant Fantasy Sports access. Delete " +
    join(getConfigDir(), "tokens.json") +
    " and call the tool again to sign in afresh; if it still fails, check that the Yahoo developer app has Fantasy Sports read permission."
  );
}

/** Turn anything thrown by yahoo-fantasy (Error, string, or Yahoo's error object) into readable text. */
export function describeYahooError(err: unknown): string {
  let message: string;
  if (err instanceof Error) {
    message = err.message;
  } else if (typeof err === "string") {
    message = err;
  } else if (err && typeof err === "object") {
    const { description, detail } = err as { description?: unknown; detail?: unknown };
    message =
      typeof description === "string" && description
        ? [description, typeof detail === "string" ? detail : ""].filter(Boolean).join(" ")
        : JSON.stringify(err);
  } else {
    message = String(err);
  }

  if (/not authorized/i.test(message)) message += authorizationHint();
  return message;
}

/** Text shown to the caller when a tool fails. */
export function describeToolError(err: unknown): string {
  if (err instanceof ZodError) {
    return (
      "Invalid arguments: " +
      err.issues.map((i) => `${i.path.join(".") || "(root)"}: ${i.message}`).join("; ")
    );
  }
  if (err instanceof Error) return err.message;
  return describeYahooError(err);
}
