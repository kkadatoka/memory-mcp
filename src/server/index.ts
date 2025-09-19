
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";

import { tools, toolHandlers } from "../tools/index.js";
import { TransportProvider } from "../transports/types.js";
import { logger } from "../utils/logger.js";
import { closeDatabase } from "../db/db.js"; // Placeholder import for DB connection functions

/**
 * Create MCP server instance
 * @returns MCP server instance
 */
function createServer() {
  const server = new Server(
    {
      name: "memory-mcp",
      version: "1.1.0",
    },
    {
      capabilities: {
        tools: {},
      },
    }
  );

  server.setRequestHandler(
    ListToolsRequestSchema,
    (async (_request: any, _context: any, _connection: any, _meta?: any) => {
      logger.info(`[Tools] Listing available tools: ${tools.map(t => t.name).join(", ")}`);
      return {
        tools,
      };
    }) as any
  );

  /**
   * Handle tool call requests
   * Dispatch to the appropriate tool implementation
   */
  server.setRequestHandler(
    CallToolRequestSchema,
    (async (request: any, _context: any, _connection: any, _meta?: any) => {
    const toolName = request.params.name;
    const handler = toolHandlers[toolName];

    logger.info(`[Tools] Invoking tool: ${toolName}`);
    if (!handler) {
      throw new Error(`Unknown tool: ${toolName}`);
    }

    return handler(request.params.arguments);
    }) as any
  );
    // Some handlers are strongly typed to expect multiple context arguments; cast to any
    // so we can invoke with the single arguments payload as used here.
    /*
    const raw = await (handler)(request.params.arguments);

    // Normalize raw results into a plain object or ServerResult-compatible shape
    let normalized: any;
    if (raw === null || raw === undefined) {
      normalized = {};
    } else if (typeof raw === "object" && !Array.isArray(raw)) {
      normalized = raw;
    } else {
      normalized = { value: raw };
    }

    // Convert MongoDB ObjectId to string when present to ensure JSON-serializable results
    function stringifyObjectIds(obj: any): any {
      if (!obj || typeof obj !== 'object') return obj;
      // Detect ObjectId by toHexString or _bsontype
      if (typeof obj.toHexString === 'function') return String(obj.toHexString());
      if (obj._bsontype === 'ObjectID' && obj.toString) return String(obj.toString());
      if (Array.isArray(obj)) return obj.map(stringifyObjectIds);
      const out: any = {};
      for (const k of Object.keys(obj)) {
        out[k] = stringifyObjectIds(obj[k]);
      }
      return out;
      


    }

    normalized = stringifyObjectIds(normalized);
    logger.info(`[Tools] Executed tool: ${toolName}`);
    return normalized;
    */

  return server;
}

/**
 * Set up process signal handlers
 * @param transportProvider Transport provider
 */
function setupProcessHandlers(transportProvider: TransportProvider): void {
  // Handle SIGINT signal (Ctrl+C)
  process.on("SIGINT", async () => {
    logger.info("[Server] Received SIGINT signal, gracefully shutting down...");
    await transportProvider.close();
    await closeDatabase();
    process.exit(0);
  });

  // Handle SIGTERM signal
  process.on("SIGTERM", async () => {
    logger.info(
      "[Server] Received SIGTERM signal, gracefully shutting down..."
    );
    await transportProvider.close();
    await closeDatabase();
    process.exit(0);
  });

  // Handle uncaught exceptions
  process.on("uncaughtException", async (error) => {
    logger.error(`[Server] Uncaught exception: ${error.message}`);
    if (error.stack) {
      logger.error(error.stack);
    }
    await transportProvider.close();
    await closeDatabase();
    process.exit(1);
  });
}

/**
 * Start MCP server using the specified transport provider
 * @param transportProvider Transport provider
 */
export async function startServer(
  transportProvider: TransportProvider
): Promise<void> {
  try {
    const server = createServer();
    logger.info("[Server] Starting MCP server...");

    // Connect to transport
    await transportProvider.connect(server);

    logger.info("[Server] MCP server started");

    // Set up process termination handlers
    setupProcessHandlers(transportProvider);
  } catch (error: any) {
    logger.error(`[Server] Failed to start MCP server: ${error.message}`);
    throw error;
  }
}