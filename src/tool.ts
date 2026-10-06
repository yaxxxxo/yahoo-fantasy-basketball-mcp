import { z } from "zod";
import type { YahooApi } from "./yahoo-client.js";
import type { AppConfig } from "./token-store.js";
import { describeToolError } from "./errors.js";

export interface ConfigStore {
  load(): Promise<AppConfig>;
  save(config: AppConfig): Promise<void>;
}

export interface ToolContext {
  yahoo: YahooApi;
  config: ConfigStore;
}

export interface ToolDef<S extends z.ZodRawShape = z.ZodRawShape> {
  name: string;
  description: string;
  /** The single source of truth for the tool's arguments: validates calls and is advertised to clients. */
  schema: S;
  run(args: z.infer<z.ZodObject<S>>, ctx: ToolContext): Promise<unknown>;
}

export function defineTool<S extends z.ZodRawShape>(tool: ToolDef<S>): ToolDef<S> {
  return tool;
}

export interface ToolResult {
  [key: string]: unknown;
  content: Array<{ type: "text"; text: string }>;
  isError?: boolean;
}

export async function runTool<S extends z.ZodRawShape>(
  tool: ToolDef<S>,
  rawArgs: unknown,
  ctx: ToolContext
): Promise<ToolResult> {
  try {
    const args = z.object(tool.schema).parse(rawArgs ?? {});
    const result = await tool.run(args, ctx);
    const text = typeof result === "string" ? result : JSON.stringify(result, null, 2);
    return { content: [{ type: "text", text }] };
  } catch (err: unknown) {
    return { content: [{ type: "text", text: describeToolError(err) }], isError: true };
  }
}
