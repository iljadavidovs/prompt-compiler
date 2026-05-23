import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import {
  pcrAddFeedbackTool,
  pcrCompileTool,
  pcrContextSearchTool,
  pcrGetHistoryTool,
  pcrListProfilesTool,
  pcrListTemplatesTool,
} from "./tools.js";

function jsonContent(value: unknown) {
  return {
    content: [
      {
        type: "text" as const,
        text: JSON.stringify(value, null, 2),
      },
    ],
  };
}

const ContextBlockSchema = z.object({
  id: z.string(),
  label: z.string(),
  kind: z.enum([
    "selection",
    "file",
    "repo",
    "clipboard",
    "memory",
    "manual",
    "diff",
    "error",
    "goal",
    "schedule",
    "preference",
    "history",
  ]),
  content: z.string(),
  metadata: z.record(z.unknown()).optional(),
});

export function createMcpServer(): McpServer {
  const server = new McpServer({
    name: "pcr-mcp",
    version: "0.1.0",
  });

  server.tool(
    "pcr_compile",
    "Compile rough intent into a local context-aware prompt.",
    {
      rawText: z.string(),
      mode: z.enum(["coding", "writing", "research", "analysis", "reply", "generic"]).optional(),
      templateId: z.string().optional(),
      profileId: z.string().optional(),
      contextHints: z.array(z.string()).optional(),
      contextBlocks: z.array(ContextBlockSchema).optional(),
      cwd: z.string().optional(),
      maxContextTokens: z.number().optional(),
      intelligenceEnabled: z.boolean().optional(),
      intelligenceProvider: z.enum(["deterministic", "openai", "local", "none"]).optional(),
      intelligenceModel: z.string().optional(),
    },
    async (input) => jsonContent(await pcrCompileTool(input)),
  );

  server.tool(
    "pcr_context_search",
    "Search PCR indexed local context.",
    {
      query: z.string(),
      kinds: z.array(ContextBlockSchema.shape.kind).optional(),
      limit: z.number().optional(),
      cwd: z.string().optional(),
    },
    async (input) => jsonContent(pcrContextSearchTool(input)),
  );

  server.tool(
    "pcr_add_feedback",
    "Attach feedback to a PCR compilation.",
    {
      compileId: z.string(),
      rating: z.enum(["like", "dislike", "neutral"]),
      outcome: z.string().optional(),
      comment: z.string().optional(),
      cwd: z.string().optional(),
    },
    async (input) => jsonContent(pcrAddFeedbackTool(input)),
  );

  server.tool(
    "pcr_list_templates",
    "List PCR templates.",
    {},
    async () => jsonContent(pcrListTemplatesTool()),
  );

  server.tool(
    "pcr_list_profiles",
    "List PCR profiles.",
    {},
    async () => jsonContent(pcrListProfilesTool()),
  );

  server.tool(
    "pcr_get_history",
    "List PCR compilation history.",
    {
      limit: z.number().optional(),
      cwd: z.string().optional(),
    },
    async (input) => jsonContent(pcrGetHistoryTool(input)),
  );

  return server;
}

export async function startMcpServer(): Promise<void> {
  const server = createMcpServer();
  const transport = new StdioServerTransport();
  await server.connect(transport);
}
