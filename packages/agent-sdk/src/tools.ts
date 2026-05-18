import { z } from 'zod';

/**
 * Tool registry. Every tool an agent can invoke is declared here with its zod schema.
 * The SDK serializes the zod schema to Anthropic's tool-schema format before each call.
 *
 * IMPORTANT: tool handlers run on the server. They have access to DB and external APIs.
 * Never expose a handler that lets the agent run arbitrary SQL or shell commands.
 */
export interface ToolDef<I, O> {
  name: string;
  description: string;
  inputSchema: z.ZodType<I>;
  /** Fresh-invoked per call. Treat errors as tool failures — do not leak to the user. */
  handler: (input: I, ctx: ToolContext) => Promise<O>;
}

export interface ToolContext {
  tenantId: string;
  userId: string | null;
  caseId: string | null;
  runId: string;
  locale: string;
}

const registry = new Map<string, ToolDef<unknown, unknown>>();

export function registerTool<I, O>(tool: ToolDef<I, O>): void {
  if (registry.has(tool.name)) {
    // Hot-reload in dev is fine, so don't throw — overwrite and log.
    console.warn(`[agent-sdk] overwriting tool ${tool.name}`);
  }
  registry.set(tool.name, tool as unknown as ToolDef<unknown, unknown>);
}

export function getTool(name: string): ToolDef<unknown, unknown> | undefined {
  return registry.get(name);
}

/** Emit Anthropic-format tool schema for the given tool names. */
export function toolsForAnthropic(names: string[]) {
  return names
    .map((n) => {
      const t = registry.get(n);
      if (!t) {
        console.warn(`[agent-sdk] unknown tool requested: ${n}`);
        return null;
      }
      return {
        name: t.name,
        description: t.description,
        input_schema: zodToJsonSchema(t.inputSchema),
      };
    })
    .filter(Boolean) as { name: string; description: string; input_schema: unknown }[];
}

/** Very small zod→JSON-Schema shim. Enough for our tool inputs; swap for zod-to-json-schema if we outgrow it. */
function zodToJsonSchema(schema: z.ZodType<unknown>): unknown {
  // We rely on zod's `_def` shape, which is a runtime detail — fine for internal use.
  const def = (schema as unknown as { _def: { typeName: string; shape?: () => Record<string, z.ZodType<unknown>> } })._def;
  if (def.typeName === 'ZodObject' && def.shape) {
    const shape = def.shape();
    const properties: Record<string, unknown> = {};
    const required: string[] = [];
    for (const [k, v] of Object.entries(shape)) {
      properties[k] = zodToJsonSchema(v);
      if (!(v as unknown as { isOptional: () => boolean }).isOptional?.()) {
        required.push(k);
      }
    }
    return { type: 'object', properties, required };
  }
  if (def.typeName === 'ZodString') return { type: 'string' };
  if (def.typeName === 'ZodNumber') return { type: 'number' };
  if (def.typeName === 'ZodBoolean') return { type: 'boolean' };
  if (def.typeName === 'ZodArray') return { type: 'array' };
  return {};
}
