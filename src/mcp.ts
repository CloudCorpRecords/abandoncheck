/**
 * abandoncheck MCP server. Tools: check_dep_maintenance.
 *
 * Why the low-level Server instead of McpServer: the high-level
 * helper converts zod schemas to JSON Schema and injects keys
 * not in this tool's defined spec ("$schema" and
 * "additionalProperties"), which breaks exact tool-list/schema
 * parity with the spec. This file serves tools/list with the
 * spec's exact input schema as an explicit literal, and every
 * tools/call is validated by the core, which names the
 * offending path on invalid input.
 *
 * The computation is pure and local: no upstream API, no
 * authentication, and no configuration — the caller supplies
 * every signal the verdict is based on.
 */
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ErrorCode,
  ListToolsRequestSchema,
  McpError,
} from "@modelcontextprotocol/sdk/types.js";
import { checkDepMaintenance, formatPayload, VERSION } from "./abandoncheck.js";

const TOOLS = [
  {
    name: "check_dep_maintenance",
    description:
      "Judge whether one dependency is maintained, from caller-supplied factual signals only: archival, days since last release and last commit, recent commit activity, and maintainer count. Returns a verdict, a score, the signal bands, and the reasons.",
    inputSchema: {
      type: "object" as const,
      properties: {
        name: {
          type: "string",
          description: "Dependency name",
        },
        archived: {
          type: "boolean",
          description: "Whether the dependency's repository is archived",
        },
        last_release_days: {
          type: "integer",
          description: "Days since the last release (optional; omit if none)",
        },
        last_commit_days: {
          type: "integer",
          description: "Days since the last commit (optional; omit if unknown)",
        },
        recent_commits_90d: {
          type: "integer",
          description: "Commits in the last 90 days (optional)",
        },
        maintainer_count: {
          type: "integer",
          description: "Number of active maintainers (optional)",
        },
        open_issues: {
          type: "integer",
          description: "Open issue count (optional; reported, never scored)",
        },
      },
      required: ["name", "archived"],
    },
  },
];

function textResult(value: unknown) {
  return {
    content: [
      {
        type: "text" as const,
        text: typeof value === "string" ? value : JSON.stringify(value, null, 2),
      },
    ],
  };
}

function errorResult(err: unknown) {
  return {
    content: [
      { type: "text" as const, text: err instanceof Error ? err.message : String(err) },
    ],
    isError: true,
  };
}

const server = new Server(
  { name: "abandoncheck", version: VERSION },
  { capabilities: { tools: {} } },
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: TOOLS }));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;
  try {
    let out: unknown;
    if (name === "check_dep_maintenance") {
      out = checkDepMaintenance(args ?? {});
    } else {
      throw new McpError(ErrorCode.MethodNotFound, `Unknown tool: ${name}`);
    }
    return textResult(formatPayload(out));
  } catch (err) {
    if (err instanceof McpError) throw err;
    return errorResult(err);
  }
});

async function main(): Promise<void> {
  await server.connect(new StdioServerTransport());
}

void main();
