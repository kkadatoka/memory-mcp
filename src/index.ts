// SSE handler and variables at top-level scope
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import express, { Request, Response } from "express";
import { z } from "zod";
import { EventEmitter } from "events";
import { ObjectId } from "mongodb";
import {
  connect,
  saveMemories,
  getAllMemories,
  clearAllMemories,
  closeDatabase,
  archiveContext,
  retrieveContext,
  scoreRelevance,
  createSummary,
  getConversationSummaries,
  searchContextByTags,
} from "./db.js";
import {
  Memory,
  ContextItem,
} from "./types.js";

const server = new McpServer({
  name: "memory-mcp",
  version: "1.0.0",
  capabilities: {
    resources: {},
    tools: {},
  },
});

// Capture tool handlers when tools are registered so we can invoke them even if
// the SDK stores only metadata in other properties at runtime.
const _localToolHandlers: Record<string, any> = {};
if (typeof (server as any).tool === 'function') {
  const _origTool = (server as any).tool.bind(server);
  (server as any).tool = function (name: string, description: string, schema: any, handler: any) {
    try {
      if (name && typeof handler === 'function') {
        _localToolHandlers[name] = handler;
      }
    } catch (e) {}
    // Call original registration
    return _origTool(name, description, schema, handler);
  } as any;
}

// Tool to save memories (overwrites existing ones)
server.tool(
  "save-memories",
  "Save all memories to the database, overwriting existing ones",
  {
    memories: z.array(z.string()).describe("Array of memory strings to save"),
    llm: z.string().describe("Name of the LLM (e.g., 'chatgpt', 'claude')"),
    userId: z.string().optional().describe("Optional user identifier"),
  },
  async ({ memories, llm, userId }) => {
    try {
      await connect();
      await clearAllMemories();
      await saveMemories(memories, llm, userId);
      return {
        content: [
          {
            type: "text",
            text: `Successfully saved ${memories.length} memories to database.\nLLM: ${llm}\nTimestamp: ${new Date().toISOString()}`,
          },
        ],
      };
    } catch (error: any) {
      return {
        content: [
          {
            type: "text",
            text: `Error saving memories: ${error.message || "Unknown error"}`,
          },
        ],
      };
    }
  },
);

// Tool to retrieve all memories
server.tool(
  "get-memories",
  "Retrieve all memories from the database",
  {},
  async () => {
    try {
      await connect();
      const memories = await getAllMemories();
      if (memories.length === 0) {
        return {
          content: [
            {
              type: "text",
              text: "No memories found in database.",
            },
          ],
        };
      }
      let result = `**Memory Log (${memories.length} entries)**\n\n`;
      memories.forEach((memory, index) => {
        result += `**Entry ${index + 1}**\n`;
        result += `LLM: ${memory.llm}\n`;
        result += `Timestamp: ${memory.timestamp.toISOString()}\n`;
        if (memory.userId) {
          result += `User ID: ${memory.userId}\n`;
        }
        result += `Memories (${memory.memories.length}):\n`;
        memory.memories.forEach((mem, memIndex) => {
          result += `${memIndex + 1}. ${mem}\n`;
        });
        result += `\n---\n\n`;
      });
      return {
        content: [
          {
            type: "text",
            text: result,
          },
        ],
      };
    } catch (error: any) {
      return {
        content: [
          {
            type: "text",
            text: `Error retrieving memories: ${error.message || "Unknown error"}`,
          },
        ],
      };
    }
  },
);

// Tool to add memories without overwriting
server.tool(
  "add-memories",
  "Add new memories to the database without overwriting existing ones",
  {
    memories: z.array(z.string()).describe("Array of memory strings to add"),
    llm: z.string().describe("Name of the LLM (e.g., 'chatgpt', 'claude')"),
    userId: z.string().optional().describe("Optional user identifier"),
  },
  async ({ memories, llm, userId }) => {
    try {
      await connect();
      await saveMemories(memories, llm, userId);
      return {
        content: [
          {
            type: "text",
            text: `Successfully added ${memories.length} new memories to database.\nLLM: ${llm}\nTimestamp: ${new Date().toISOString()}`,
          },
        ],
      };
    } catch (error: any) {
      return {
        content: [
          {
            type: "text",
            text: `Error adding memories: ${error.message || "Unknown error"}`,
          },
        ],
      };
    }
  }
);
// Tool to clear all memories
server.tool(
  "clear-memories",
  "Clear all memories from the database",
  {},
  async () => {
    try {
      await connect();
      const deletedCount = await clearAllMemories();
      return {
        content: [
          {
            type: "text",
            text: `Successfully cleared ${deletedCount} memory entries from database.`,
          },
        ],
      };
    } catch (error: any) {
      return {
        content: [
          {
            type: "text",
            text: `Error clearing memories: ${error.message || "Unknown error"}`,
          },
        ],
      };
    }
  },
);

// New Context Window Caching Tools

// Tool to archive context
server.tool(
  "archive-context",
  "Archive context messages for a conversation with tags and metadata",
  {
    conversationId: z
      .string()
      .describe("Unique identifier for the conversation"),
    contextMessages: z
      .array(z.string())
      .describe("Array of context messages to archive"),
    tags: z
      .array(z.string())
      .describe("Tags for categorizing the archived content"),
    llm: z.string().describe("Name of the LLM (e.g., 'chatgpt', 'claude')"),
    userId: z.string().optional().describe("Optional user identifier"),
  },
  async ({ conversationId, contextMessages, tags, llm, userId }) => {
    try {
      await connect();
      const archivedCount = await archiveContext(
        conversationId,
        contextMessages,
        tags,
        llm,
        userId,
      );
      return {
        content: [
          {
            type: "text",
            text: `Successfully archived ${archivedCount} context items for conversation ${conversationId}.\nTags: ${tags.join(", ")}\nLLM: ${llm}`,
          },
        ],
      };
    } catch (error: any) {
      return {
        content: [
          {
            type: "text",
            text: `Error archiving context: ${error.message || "Unknown error"}`,
          },
        ],
      };
    }
  },
);

// Tool to retrieve context
server.tool(
  "retrieve-context",
  "Retrieve relevant archived context for a conversation",
  {
    conversationId: z
      .string()
      .describe("Unique identifier for the conversation"),
    tags: z.array(z.string()).optional().describe("Optional tags to filter by"),
    minRelevanceScore: z
      .number()
      .min(0)
      .max(1)
      .optional()
      .default(0.1)
      .describe("Minimum relevance score (0-1)"),
    limit: z
      .number()
      .int()
      .min(1)
      .max(50)
      .optional()
      .default(10)
      .describe("Maximum number of items to return"),
  },
  async ({ conversationId, tags, minRelevanceScore, limit }) => {
    try {
      await connect();
      const contextItems = await retrieveContext(
        conversationId,
        tags,
        minRelevanceScore,
        limit,
      );

      if (contextItems.length === 0) {
        return {
          content: [
            {
              type: "text",
              text: `No relevant archived context found for conversation ${conversationId}.`,
            },
          ],
        };
      }

      let result = `**Retrieved Context for ${conversationId} (${contextItems.length} items)**\n\n`;

      contextItems.forEach((item, index) => {
        result += `**Item ${index + 1}**\n`;
        result += `Relevance Score: ${(item.relevanceScore || 0).toFixed(3)}\n`;
        result += `Tags: ${(item.tags || []).join(", ")}\n`;
        result += `Word Count: ${item.wordCount || 0}\n`;
        result += `Timestamp: ${item.timestamp.toISOString()}\n`;
        result += `Content:\n${item.memories.join("\n")}\n\n---\n\n`;
      });

      return {
        content: [
          {
            type: "text",
            text: result,
          },
        ],
      };
    } catch (error: any) {
      return {
        content: [
          {
            type: "text",
            text: `Error retrieving context: ${error.message || "Unknown error"}`,
          },
        ],
      };
    }
  },
);

// Tool to score relevance
server.tool(
  "score-relevance",
  "Score the relevance of archived context against current conversation context",
  {
    conversationId: z
      .string()
      .describe("Unique identifier for the conversation"),
    currentContext: z
      .string()
      .describe("Current conversation context to compare against"),
    llm: z.string().describe("Name of the LLM (e.g., 'chatgpt', 'claude')"),
  },
  async ({ conversationId, currentContext, llm }) => {
    try {
      await connect();
      const scoredCount = await scoreRelevance(
        conversationId,
        currentContext,
        llm,
      );
      return {
        content: [
          {
            type: "text",
            text: `Successfully scored relevance for ${scoredCount} archived items in conversation ${conversationId}.\nCurrent context length: ${currentContext.split(/\s+/).length} words`,
          },
        ],
      };
    } catch (error: any) {
      return {
        content: [
          {
            type: "text",
            text: `Error scoring relevance: ${error.message || "Unknown error"}`,
          },
        ],
      };
    }
  },
);

// Tool to create summary
server.tool(
  "create-summary",
  "Create a summary of context items and link them to the summary",
  {
    conversationId: z
      .string()
      .describe("Unique identifier for the conversation"),
    contextItems: z
      .array(
        z.object({
          _id: z.string().optional(),
          memories: z.array(z.string()),
          timestamp: z.string(),
          llm: z.string(),
          userId: z.string().optional(),
          conversationId: z.string().optional(),
          contextType: z.string().optional(),
          relevanceScore: z.number().optional(),
          tags: z.array(z.string()).optional(),
          parentContextId: z.string().optional(),
          messageIndex: z.number().optional(),
          wordCount: z.number().optional(),
          summaryText: z.string().optional(),
        }),
      )
      .describe("Context items to summarize"),
    summaryText: z.string().describe("Human-provided summary text"),
    llm: z.string().describe("Name of the LLM (e.g., 'chatgpt', 'claude')"),
    userId: z.string().optional().describe("Optional user identifier"),
  },
  async ({ conversationId, contextItems, summaryText, llm, userId }) => {
    try {
      await connect();

      // Convert string _id back to ObjectId if present
      const convertedItems: Memory[] = contextItems.map((item) => ({
        ...item,
        _id: item._id ? new ObjectId(item._id) : undefined,
        timestamp: new Date(item.timestamp),
        contextType: item.contextType as
          | "active"
          | "archived"
          | "summary"
          | undefined,
        parentContextId: item.parentContextId
          ? new ObjectId(item.parentContextId)
          : undefined,
      }));

      const summaryId = await createSummary(
        conversationId,
        convertedItems,
        summaryText,
        llm,
        userId,
      );
      return {
        content: [
          {
            type: "text",
            text: `Successfully created summary for conversation ${conversationId}.\nSummary ID: ${summaryId}\nItems summarized: ${contextItems.length}\nSummary length: ${summaryText.split(/\s+/).length} words`,
          },
        ],
      };
    } catch (error: any) {
      return {
        content: [
          {
            type: "text",
            text: `Error creating summary: ${error.message || "Unknown error"}`,
          },
        ],
      };
    }
  },
);

// Tool to get conversation summaries
server.tool(
  "get-conversation-summaries",
  "Get all summaries for a specific conversation",
  {
    conversationId: z
      .string()
      .describe("Unique identifier for the conversation"),
  },
  async ({ conversationId }) => {
    try {
      await connect();
      const summaries = await getConversationSummaries(conversationId);

      if (summaries.length === 0) {
        return {
          content: [
            {
              type: "text",
              text: `No summaries found for conversation ${conversationId}.`,
            },
          ],
        };
      }

      let result = `**Conversation Summaries for ${conversationId} (${summaries.length} summaries)**\n\n`;

      summaries.forEach((summary, index) => {
        result += `**Summary ${index + 1}**\n`;
        result += `Timestamp: ${summary.timestamp.toISOString()}\n`;
        result += `Word Count: ${summary.wordCount || 0}\n`;
        result += `Summary Text:\n${summary.summaryText || summary.memories.join("\n")}\n\n---\n\n`;
      });

      return {
        content: [
          {
            type: "text",
            text: result,
          },
        ],
      };
    } catch (error: any) {
      return {
        content: [
          {
            type: "text",
            text: `Error retrieving summaries: ${error.message || "Unknown error"}`,
          },
        ],
      };
    }
  },
);

// Tool to search context by tags
server.tool(
  "search-context-by-tags",
  "Search archived context and summaries by tags",
  {
    tags: z.array(z.string()).describe("Tags to search for"),
  },
  async ({ tags }) => {
    try {
      await connect();
      const results = await searchContextByTags(tags);

      if (results.length === 0) {
        return {
          content: [
            {
              type: "text",
              text: `No context found with tags: ${tags.join(", ")}`,
            },
          ],
        };
      }

      let result = `**Search Results for tags: ${tags.join(", ")} (${results.length} items)**\n\n`;

      results.forEach((item, index) => {
        result += `**Item ${index + 1}**\n`;
        result += `Type: ${item.contextType}\n`;
        result += `Conversation ID: ${item.conversationId}\n`;
        result += `Relevance Score: ${(item.relevanceScore || 0).toFixed(3)}\n`;
        result += `Tags: ${(item.tags || []).join(", ")}\n`;
        result += `Word Count: ${item.wordCount || 0}\n`;
        result += `Timestamp: ${item.timestamp.toISOString()}\n`;
        result += `Content:\n${item.memories.join("\n")}\n\n---\n\n`;
      });

      return {
        content: [
          {
            type: "text",
            text: result,
          },
        ],
      };
    } catch (error: any) {
      return {
        content: [
          {
            type: "text",
            text: `Error searching context: ${error.message || "Unknown error"}`,
          },
        ],
      };
    }
  },
);


const app = express();
// permissive CORS for LM Studio / remote clients
import cors from 'cors';
app.use(cors());
const serverPort = process.env.PORT ? parseInt(process.env.PORT) : 3000;

// SSE clients (track optional sessionId for /messages/ compatibility)
const sseClients: Array<{ res: express.Response; sessionId?: string }> = [];

app.get("/sse", (req: Request, res: Response) => {
  res.set({
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    "Connection": "keep-alive",
  });
  res.write("retry: 10000\n\n");
  // Create a short-lived session identifier for clients that expect an endpoint
  const sessionId = new ObjectId().toHexString();
  const endpointPath = `/messages/?session_id=${sessionId}`;
  sseClients.push({ res, sessionId });

  // On connect, send available tools as a named event so clients can discover capabilities
  try {
    // First inform clients where a message stream endpoint is (many MCP SSE servers
    // send an `endpoint` event with a path like `/messages/?session_id=...`).
    // Send endpoint as a raw string (no JSON quoting) so clients that expect
    // `data: /messages/?session_id=...` receive the same format.
    res.write(`event: endpoint\n`);
    res.write(`data: ${endpointPath}\n\n`);

    // Then send available tools for discovery
    const tools = discoverTools();
    res.write(`event: tools\n`);
    res.write(`data: ${JSON.stringify(tools)}\n\n`);
  } catch (err) {
    // ignore discovery errors for SSE
  }

  const interval = setInterval(() => {
    // Emit a comment-style ping line many servers use for keepalive. This
    // appears as lines beginning with ':' in curl output.
    try {
      res.write(`: ping - ${new Date().toISOString()}\n\n`);
    } catch (e) {}
  }, 15000);

  req.on("close", () => {
    clearInterval(interval);
    const idx = sseClients.findIndex((c) => c.res === res);
    if (idx !== -1) sseClients.splice(idx, 1);
    res.end();
  });
});

// Support Streamable HTTP clients that POST to /sse for initialize or to invoke
// tools over HTTP while receiving results via existing SSE connections. Some
// clients attempt to POST /sse (instead of /messages) during initialization,
// return a sessionId+endpoint when asked to initialize, and accept {tool,args}
// shapes for invocation. Implement a small, safe compatibility shim here.
app.post('/sse', async (req: Request, res: Response) => {
  const body = req.body || {};
  // Initialize handshake
  if ((body.method && body.method === 'initialize') || (body.tool && body.tool === 'initialize')) {
    const sessionId = new ObjectId().toHexString();
    const endpoint = `/messages/?session_id=${sessionId}`;
    if (body?.jsonrpc === '2.0') {
      return res.json({ jsonrpc: '2.0', result: { sessionId, endpoint }, id: body.id || null });
    }
    return res.json({ sessionId, endpoint });
  }

  // If client posts a tool invocation to /sse, try to invoke and broadcast
  const tool = body.tool || body.method || (body.params && body.params.tool);
  const args = body.args || body.params || {};
  if (!tool) return res.status(400).json({ error: "Missing 'tool' in request body" });
  try {
    const result = await invokeToolByName(tool, args || {});
    if (result === null || result === undefined) return res.status(404).json({ error: `Tool '${tool}' not found` });

    // Broadcast result to SSE clients as 'tool-result' event
    try {
      const payload = { tool, params: args || {}, result };
      const data = JSON.stringify(payload);
      sseClients.forEach((c) => {
        try {
          c.res.write(`event: tool-result\n`);
          c.res.write(`data: ${data}\n\n`);
        } catch (e) {}
      });
    } catch (e) {}

    return res.json(result);
  } catch (err: any) {
    return res.status(500).json({ error: err.message || String(err) });
  }
});

// A compatibility endpoint used by some MCP clients: they open an SSE stream
// on `/messages/?session_id=...`. Mirror the same behaviour as `/sse` but
// allow clients to supply their own session_id.
app.get('/messages/', (req: Request, res: Response) => {
  const sessionId = String(req.query.session_id || new ObjectId().toHexString());
  res.set({
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
  });
  res.write('retry: 10000\n\n');
  sseClients.push({ res, sessionId });

  try {
    // Inform client of the tools immediately after connect
    const tools = discoverTools();
    res.write(`event: tools\n`);
    res.write(`data: ${JSON.stringify(tools)}\n\n`);
  } catch (e) {}

    const interval = setInterval(() => {
      try {
        res.write(`: ping - ${new Date().toISOString()}\n\n`);
      } catch (e) {}
    }, 15000);

  req.on('close', () => {
    clearInterval(interval);
    const idx = sseClients.findIndex((c) => c.res === res && c.sessionId === sessionId);
    if (idx !== -1) sseClients.splice(idx, 1);
    res.end();
  });
});

// SSE clients may also request the tools list over HTTP
app.get("/sse/list-tools", (req: Request, res: Response) => {
  try {
    const tools = discoverTools();
    res.json(tools);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.use(express.json());

app.post("/mcp/:tool", async (req: Request, res: Response) => {
  const toolName = req.params.tool as string;
  const params = req.body;
  try {
    // If the client posted to /mcp/list-tools (or similar discovery aliases)
    // return the discovery list immediately instead of attempting to invoke
    // a tool named "list-tools" which likely does not exist as an executable
    // tool. This preserves compatibility with clients that prefer POST+JSON.
    if (toolName === 'list-tools' || toolName === 'tools' || toolName === 'list') {
      const tools = discoverTools();
      return res.json(tools);
    }
    // Prefer the invocation helper which knows how to call local handlers
    // and various SDK registry shapes. This ensures /mcp/:tool works even
    // when the SDK stores only metadata objects (no direct handler ref).
    const result = await invokeToolByName(toolName, params || {});
    if (result !== null && result !== undefined) {
      return res.json(result);
    }
    return res.status(404).json({ error: `Tool '${toolName}' not found` });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST endpoint for SSE clients to invoke tools and receive results via SSE broadcasts
app.post("/sse/:tool", async (req: Request, res: Response) => {
  const toolName = req.params.tool as string;
  const params = req.body;
  try {
    if ((server as any)._tools && (server as any)._tools[toolName]) {
      const result = await (server as any)._tools[toolName].handler(params, {});

      // Broadcast the result to all connected SSE clients as a named event
      try {
        const payload = { tool: toolName, params, result };
        const data = JSON.stringify(payload);
        sseClients.forEach((c) => {
          try {
            c.res.write(`event: tool-result\n`);
            c.res.write(`data: ${data}\n\n`);
          } catch (e) {
            // ignore write errors per-client
          }
        });
      } catch (broadcastErr) {
        // ignore broadcasting errors
      }

      res.json(result);
    } else {
      res.status(404).json({ error: `Tool '${toolName}' not found` });
    }
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Canonical MCP endpoints (tools/list and tools/call) for compatibility with MCP clients
app.get("/tools/list", (req, res) => {
  try {
    const tools = discoverTools();
    res.json(tools);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/tools/list", (req: Request, res: Response) => {
  try {
    const tools = discoverTools();
    res.json(tools);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/tools/call", async (req: Request, res: Response) => {
  const { tool, args } = req.body || {};
  if (!tool) {
    return res.status(400).json({ error: "Missing 'tool' in request body" });
  }
  try {
    const result = await invokeToolByName(tool, args || {});
    if (result !== null && result !== undefined) {
      try {
        const payload = { tool, params: args || {}, result };
        const data = JSON.stringify(payload);
        sseClients.forEach((c) => {
          try {
            c.res.write(`event: tool-result\n`);
            c.res.write(`data: ${data}\n\n`);
          } catch (e) {}
        });
      } catch (e) {}
      return res.json(result);
    }

    return res.status(404).json({ error: `Tool '${tool}' not found` });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || String(err) });
  }
});

// Extracted invocation helper so we can reuse it for multiple alias endpoints
async function invokeToolByName(name: string, payload: any) {
  // prefer locally captured handlers
  try {
    if (_localToolHandlers[name]) return await _localToolHandlers[name](payload || {}, {});
  } catch (e) {}

  const registries = [
    (server as any)._tools,
    (server as any).tools,
    (server as any).toolRegistry,
    (server as any).registry,
    (server as any)._toolRegistry,
    (server as any).registeredTools,
    (server as any)._registeredTools,
  ];

  const tryInvokeFromObj = async (obj: any) => {
    if (!obj) return null;
    if (typeof obj.handler === 'function') return await obj.handler(payload || {}, {});
    if (typeof obj.call === 'function') return await obj.call(payload || {}, {});
    if (typeof obj.run === 'function') return await obj.run(payload || {}, {});
    return null;
  };

  for (const reg of registries) {
    try {
      if (!reg || typeof reg !== 'object') continue;
      if (reg[name]) {
        const r = await tryInvokeFromObj(reg[name]);
        if (r !== null) return r;
      }
    } catch (e) {}
  }

  const serverCallCandidates = [(server as any).call, (server as any).invoke, (server as any).execute, (server as any).handle];
  for (const fn of serverCallCandidates) {
    try {
      if (typeof fn === 'function') {
        const maybe = await fn.call(server, name, payload || {});
        if (maybe !== undefined) return maybe;
      }
    } catch (e) {}
  }

  // recursive find
  const visited = new Set<any>();
  let foundObj: any = null;
  const walkFind = (node: any, depth = 0) => {
    if (!node || depth > 4) return;
    if (visited.has(node)) return;
    visited.add(node);
    if (typeof node === 'object') {
      for (const [k, v] of Object.entries(node)) {
        try {
          const vv: any = v as any;
          if (k === name || (vv && vv.name === name)) {
            if (vv && (typeof vv.handler === 'function' || typeof vv.call === 'function' || typeof vv.run === 'function')) {
              foundObj = vv; return;
            }
          }
        } catch (e) {}
      }
      for (const v of Object.values(node)) {
        try { if (typeof v === 'object') walkFind(v, depth + 1); } catch (e) {}
        if (foundObj) return;
      }
    }
  };
  try { walkFind(server, 0); } catch (e) {}
  if (foundObj) return await tryInvokeFromObj(foundObj);

  return null;
}

// Alias endpoints for compatibility with various clients
app.post('/tools/invoke', async (req: Request, res: Response) => {
  const { tool, args } = req.body || {};
  if (!tool) return res.status(400).json({ error: "Missing 'tool' in request body" });
  try {
    const result = await invokeToolByName(tool, args || {});
    if (result === null || result === undefined) return res.status(404).json({ error: `Tool '${tool}' not found` });
    return res.json(result);
  } catch (err: any) {
    return res.status(500).json({ error: err.message || String(err) });
  }
});

app.post('/tools/execute', async (req: Request, res: Response) => {
  const { tool, args } = req.body || {};
  if (!tool) return res.status(400).json({ error: "Missing 'tool' in request body" });
  try {
    const result = await invokeToolByName(tool, args || {});
    if (result === null || result === undefined) return res.status(404).json({ error: `Tool '${tool}' not found` });
    return res.json(result);
  } catch (err: any) {
    return res.status(500).json({ error: err.message || String(err) });
  }
});

app.post('/mcp/call', async (req: Request, res: Response) => {
  // Mirror /tools/call semantics
  const { tool, args } = req.body || {};
  if (!tool) return res.status(400).json({ error: "Missing 'tool' in request body" });
  try {
    const result = await invokeToolByName(tool, args || {});
    if (result === null || result === undefined) return res.status(404).json({ error: `Tool '${tool}' not found` });
    return res.json(result);
  } catch (err: any) {
    return res.status(500).json({ error: err.message || String(err) });
  }
});

// POST /messages - compatibility for legacy SSE clients that post messages to the server
app.post('/messages', async (req: Request, res: Response) => {
  // Accept either { tool, args } or { method, params } shapes
  const body = req.body || {};
  const tool = body.tool || body.method || (body.params && body.params.tool);
  const args = body.args || body.params || {};
  // Support Streamable HTTP / SSE initialize handshake used by some clients.
  // If the client posts { method: 'initialize' } or { tool: 'initialize' }
  // return a session id and the messages endpoint so they can open a stream.
  if ((body.method && body.method === 'initialize') || (body.tool && body.tool === 'initialize')) {
    const sessionId = new ObjectId().toHexString();
    const endpoint = `/messages/?session_id=${sessionId}`;
    // If JSON-RPC style, return jsonrpc structure
    if (body?.jsonrpc === '2.0') {
      return res.json({ jsonrpc: '2.0', result: { sessionId, endpoint }, id: body.id || null });
    }
    return res.json({ sessionId, endpoint });
  }
  if (!tool) return res.status(400).json({ error: "Missing 'tool' in request body" });
  try {
    const result = await invokeToolByName(tool, args || {});
    if (result === null || result === undefined) return res.status(404).json({ error: `Tool '${tool}' not found` });
    return res.json(result);
  } catch (err: any) {
    return res.status(500).json({ error: err.message || String(err) });
  }
});

// Lightweight Streamable HTTP compatibility endpoint (/mcp)
// Accepts JSON-RPC initialize requests and simple tool-invoke shapes.
app.post('/mcp', async (req: Request, res: Response) => {
  const body = req.body || {};

  // Handle JSON-RPC initialize requests: return a generated session id
  if (body?.jsonrpc === '2.0' && body?.method === 'initialize') {
    const sessionId = new ObjectId().toHexString();
    return res.json({ jsonrpc: '2.0', result: { sessionId }, id: body.id || null });
  }

  // If the body is a simple { tool, args } shape, invoke directly
  if (body && (body.tool || body.method)) {
    const tool = body.tool || body.method;
    const params = body.args || body.params || {};
    try {
      const result = await invokeToolByName(tool, params || {});
      if (result === null || result === undefined) {
        return res.status(404).json({ jsonrpc: '2.0', error: { code: -32601, message: `Tool '${tool}' not found` }, id: body.id || null });
      }
      return res.json({ jsonrpc: '2.0', result, id: body.id || null });
    } catch (err: any) {
      return res.status(500).json({ jsonrpc: '2.0', error: { code: -32603, message: err.message || String(err) }, id: body.id || null });
    }
  }

  return res.status(400).json({ jsonrpc: '2.0', error: { code: -32600, message: 'Invalid Request' }, id: body.id || null });
});

// GET/DELETE /mcp are used by some transports to check session validity
app.get('/mcp', (req: Request, res: Response) => {
  const sessionId = req.headers['mcp-session-id'] as string | undefined;
  if (!sessionId) return res.status(400).send('Invalid or missing session ID');
  return res.status(200).send('OK');
});

app.delete('/mcp', (req: Request, res: Response) => {
  const sessionId = req.headers['mcp-session-id'] as string | undefined;
  if (!sessionId) return res.status(400).send('Invalid or missing session ID');
  return res.status(200).send('OK');
});

// Endpoint to list available tools (discovery for HTTP/SSE clients)
// Helper: discover registered tools from the MCP SDK instance
function discoverTools() {
  const seen = new Set<string>();
  const out: Array<{ name: string; description: string; params: string[] }> = [];

  // Candidate places the SDK might store tool metadata in different versions
  const candidates = [
    (server as any)._tools,
    (server as any).tools,
    (server as any).toolRegistry,
    (server as any).registry,
    (server as any)._toolRegistry,
    (server as any).registeredTools,
    (server as any)._registeredTools,
  ];

  const pushMeta = (name: string, meta: any) => {
    if (!name || seen.has(name)) return;
    seen.add(name);

    const m: any = meta || {};
    const description = m.description || m.desc || m.title || m.summary || "";

    let params: string[] = [];
    try {
      // Zod schema shape
      if (m.schema && m.schema._def && m.schema._def.shape) {
        params = Object.keys(m.schema._def.shape);
      } else if (m.inputSchema && m.inputSchema._def && m.inputSchema._def.shape) {
        params = Object.keys(m.inputSchema._def.shape);
      }

      // JSON Schema shape
      else if (m.schema && m.schema.properties) {
        params = Object.keys(m.schema.properties);
      } else if (m.inputSchema && m.inputSchema.properties) {
        params = Object.keys(m.inputSchema.properties);
      }

      // SDK older shapes: args / parameters
      else if (m.args && typeof m.args === "object") {
        params = Object.keys(m.args);
      } else if (m.parameters && typeof m.parameters === "object") {
        params = Object.keys(m.parameters);
      }
    } catch (e) {
      // ignore schema parsing errors
    }

    out.push({ name, description, params });
  };

  for (const reg of candidates) {
    if (!reg) continue;
    try {
      // If it's an array of tool descriptors
      if (Array.isArray(reg)) {
        for (const item of reg) {
          if (!item) continue;
          if (typeof item === "string") pushMeta(item, {});
          else if (item.name) pushMeta(item.name, item);
        }
        continue;
      }

      // If it's a map/object of name -> meta
      if (typeof reg === "object") {
        for (const [name, meta] of Object.entries(reg)) {
          pushMeta(name, meta as any);
        }
      }
    } catch (e) {
      // ignore and continue
    }
  }

  // Try calling any exported helper/listing on the server instance
  try {
    const maybeList = (server as any).listTools?.() || (server as any).list?.() || (server as any)._list?.();
    if (Array.isArray(maybeList) && maybeList.length > 0) {
      // Normalize items to our descriptor shape
      for (const item of maybeList) {
        if (!item) continue;
        if (typeof item === "string") pushMeta(item, {});
        else if (item.name) pushMeta(item.name, item);
      }
    }
  } catch (e) {
    // ignore call errors
  }

  // Extra fallback: recursively scan server object for tool-like shapes
  try {
    const maxDepth = 3;
    const visited = new Set<any>();

    const looksLikeTool = (obj: any) => {
      if (!obj || typeof obj !== 'object') return false;
      // Look for handler/call/run functions or a schema
      if (typeof obj.handler === 'function') return true;
      if (typeof obj.call === 'function' || typeof obj.run === 'function') return true;
      if (obj.schema || obj.inputSchema || obj.args || obj.parameters) return true;
      return false;
    };

    const walk = (node: any, depth = 0) => {
      if (!node || depth > maxDepth) return;
      if (visited.has(node)) return;
      visited.add(node);

      try {
        // If it's an object mapping names to tool-like entries, add them
        if (typeof node === 'object') {
          for (const [k, vRaw] of Object.entries(node)) {
            const v: any = vRaw as any;
            try {
              if (looksLikeTool(v)) {
                // use key as name if v has no explicit name
                  const name = (v && v.name) || k;
                  pushMeta(name, v);
              }
            } catch (e) {}
          }
        }
      } catch (e) {}

      // Recurse into own property values
      try {
        for (const v of Object.values(node)) {
          try {
            if (typeof v === 'object') walk(v, depth + 1);
          } catch (e) {}
        }
      } catch (e) {}
    };

    walk(server, 0);
  } catch (e) {
    // ignore
  }

  return out;
}

// Return tools as a plain array per MCP spec
app.get("/mcp/tools", (req: Request, res: Response) => {
  try {
    const tools = discoverTools();
    res.json(tools);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST variant for clients that prefer JSON body (keeps parity with /mcp/:tool)
app.post("/mcp/list-tools", (req: Request, res: Response) => {
  try {
    const tools = discoverTools();
    res.json(tools);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Debug endpoint (read-only) to inspect the internal objects used during discovery.
// This is intended for development/troubleshooting only — do not expose in production.
app.get('/debug/_tool_internals', (req: Request, res: Response) => {
  try {
    // Collect the raw candidate locations
    const candidates: Record<string, any> = {
      '_tools': (server as any)._tools,
      'tools': (server as any).tools,
      'toolRegistry': (server as any).toolRegistry,
      'registry': (server as any).registry,
      '_toolRegistry': (server as any)._toolRegistry,
      'registeredTools': (server as any).registeredTools,
      '_registeredTools': (server as any)._registeredTools,
    };

    // Helper to create a JSON-safe shallow summary of an object
    const summarize = (obj: any) => {
      if (obj == null) return null;
      if (typeof obj !== 'object') return obj;
      const out: any = {};
      try {
        for (const [k, vRaw] of Object.entries(obj)) {
          try {
            const v: any = vRaw as any;
            const entry: any = { type: typeof v };
            if (v && typeof v === 'object') {
              if (v.schema) entry.schemaKeys = Object.keys(v.schema || {});
              if (v.inputSchema) entry.inputSchemaKeys = Object.keys(v.inputSchema || {});
              if (v.args) entry.argsKeys = Object.keys(v.args || {});
              if (v.parameters) entry.parametersKeys = Object.keys(v.parameters || {});
              entry.hasHandler = !!(v.handler || v.call || v.run);
            }
            out[k] = entry;
          } catch (e) {
            out[k] = { type: typeof vRaw, error: 'summary-error' };
          }
        }
      } catch (e) {
        return { error: 'summarize-failed' };
      }
      return out;
    };

    const candidateSummaries: Record<string, any> = {};
    for (const [k, v] of Object.entries(candidates)) {
      candidateSummaries[k] = summarize(v as any);
    }

    // Run the recursive scan used by discoverTools but record the raw matches found
    const rawMatches: Array<{ name: string; metaSample: any }> = [];
    try {
      const visited = new Set<any>();
      const maxDepth = 3;
      const looksLikeTool = (obj: any) => {
        if (!obj || typeof obj !== 'object') return false;
        if (typeof obj.handler === 'function') return true;
        if (typeof obj.call === 'function' || typeof obj.run === 'function') return true;
        if (obj.schema || obj.inputSchema || obj.args || obj.parameters) return true;
        return false;
      };

      const walk = (node: any, depth = 0) => {
        if (!node || depth > maxDepth) return;
        if (visited.has(node)) return;
        visited.add(node);
        if (typeof node === 'object') {
          for (const [k, v] of Object.entries(node)) {
            try {
              const vv: any = v as any;
              if (looksLikeTool(vv)) {
                rawMatches.push({ name: vv.name || k, metaSample: summarize({ sample: vv }) });
              }
            } catch (e) {}
          }
        }
        try {
          for (const v of Object.values(node)) {
            try {
              if (typeof v === 'object') walk(v, depth + 1);
            } catch (e) {}
          }
        } catch (e) {}
      };

      walk(server, 0);
    } catch (e) {}

    res.json({ candidates: candidateSummaries, rawMatches });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.listen(serverPort, () => {
  console.error(`Unified HTTP server (MCP + SSE) listening on port ${serverPort}`);
});


