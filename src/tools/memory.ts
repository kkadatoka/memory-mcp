import {
  connect,
  saveMemories,
  addMemories,
  getAllMemories,
  clearAllMemories,
  closeDatabase,
  archiveContext,
  retrieveContext,
  scoreRelevance,
  createSummary,
  getConversationSummaries,
  searchContextByTags,
} from "../db/db.js";
import { Memory, ContextItem } from "../db/types.js";
import { ObjectId } from "mongodb";
import { isDebugMode } from "../config/args.js";
import { z } from "zod";
import { logger } from "../utils/logger.js";


// Implement memory management tools here
export async function saveMemoriesTool( args: any ) {

    if (isDebugMode()) {
        logger.debug(`[Memory] saveMemoriesTool called with args: ${args}`);
    }
    if (!args) {
        logger.error(`[Memory] No arguments provided to saveMemoriesTool`);
        return {
            content: [
                { 
                    type: "text", 
                    text: "No arguments provided. memories and llm are required.",
                },
            ],
        };
    }
    const { memories, llm, userId } = args;
    if (!Array.isArray(memories) || typeof llm !== 'string') {
        logger.error(`[Memory] Invalid arguments for saveMemoriesTool: ${args}`);
        return {
            content: [
                { 
                    type: "text", 
                    text: "Invalid arguments: 'memories' must be an array and 'llm' must be a string.",
                },
            ],
        };
    }
    await clearAllMemories();
    await saveMemories(memories, llm, userId);
    logger.info(`[Memory] Saved ${memories.length} memories to database.\nLLM: ${llm}\nUserID: ${userId}\nTimestamp: ${new Date().toISOString()}`);
    return {
        content: [
            { 
                type: "text", 
                text: `Saved ${memories.length} memories to database.\nLLM: ${llm}\nUserID: ${userId}\nTimestamp: ${new Date().toISOString()}`,
            },
        ],
    };
}

export async function addMemoriesTool( args: any ) {
    if ( isDebugMode() ) {
        logger.debug(`[Memory] addMemoriesTool called with args:${args}`);
    }
    if (!args) {
        logger.error("[Memory] No arguments provided to addMemoriesTool");
        return {
            content: [
                { 
                    type: "text", 
                    text: "No arguments provided. 'memories' and 'llm' are required.",
                },
            ],
        };
    }
    const { memories, llm, userId } = args;
    if ( memories.length === 0 || typeof llm !== 'string') {
        logger.error(`[Memory] Invalid arguments for addMemoriesTool: ${args}`);
        return {
            content: [
                { 
                    type: "text", 
                    text: "Invalid arguments: 'memories' must be an array and 'llm' must be a string."
                },
            ],
        };
    }
    await addMemories(memories, llm, userId);
    logger.info("[Memory] Added memories");
    return {
        content: [{ type: "text", text: "Memories added successfully." }],
    };
}

export async function getAllMemoriesTool( args: any ) {

    if ( isDebugMode() ) {
        logger.debug(`[Memory] getAllMemoriesTool called with args: ${args}`);
    }
    const memories = await getAllMemories();
    if ( memories.length === 0 ) {
        logger.warn(`[Memory] getAllMemoriesTool did not return an array: ${memories}`);
        return {
            content: [
                { 
                    type: "text", 
                    text: "No memories found in database.",
                },
            ],
        }
    }
    logger.info(`[Memory] Retrieved all memories: ${memories.length} items`);
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
}

export async function clearAllMemoriesTool( args: any ) {
    if ( isDebugMode() ) {
        logger.debug(`[Memory] clearAllMemoriesTool called with args: ${args}`);
    }
    const deletedCount = await clearAllMemories();
    logger.info(`[Memory] Cleared ${deletedCount} memory entries from database.`);
    return {
        content: [
            {
                type: "text",
                text: `Successfully cleared ${deletedCount} memory entries from database.`,
            },
        ],
    }; 
}

export async function archiveContextTool( args: any ) {
    if ( isDebugMode() ) {
        logger.debug(`[Memory] archiveContextTool called with args: ${args}`);
    }
    if (!args) {
        logger.error("[Memory] No arguments provided to archiveContextTool");
        return {
            content: [
                { 
                    type: "text", 
                    text: "No arguments provided. 'conversationId', 'contextMessages', 'tags' and 'llm' are required.",
                },
            ],
        };
    }
    const { conversationId, contextMessages, tags, llm, userId } = args;
    if (typeof conversationId !== 'string' || !Array.isArray(contextMessages) || typeof llm !== 'string' || !Array.isArray(tags)) {
        logger.error(`[Memory] Invalid arguments for archiveContextTool: ${args}`);
        return {
            content: [
                { 
                    type: "text", 
                    text: "Invalid arguments: 'conversationId' must be a string, 'contextMessages' must be an array, 'tags' must be an array, and 'llm' must be a string.",
                },
            ],
        };
    }
    const archivedCount = await archiveContext(conversationId, contextMessages, tags, llm, userId);
    logger.info(`[Memory] Successfully archived ${archivedCount} context items for conversation ${conversationId}.\nTags: ${tags.join(", ")}\nLLM: ${llm}`);
    return {
        content: [
            {
                type: "text",
                text: `Successfully archived ${archivedCount} context items for conversation ${conversationId}.\nTags: ${tags.join(", ")}\nLLM: ${llm}`,
            },
        ],
    };
}

export async function retrieveContextTool( args: any ) {
    if ( isDebugMode() ) {
        logger.debug(`[Memory] retrieveContextTool called with args: ${args}`);
    }
    if (!args) {
        logger.error("[Memory] No arguments provided to retrieveContextTool");
        return {
            content: [
                { 
                    type: "text", 
                    text: "No arguments provided. 'conversationId' is required.",
                },
            ],
        };
    }
    const { conversationId, tags, minRelevanceScore, limit } = args;
    if (typeof conversationId !== 'string') {
        logger.error(`[Memory] Invalid arguments for retrieveContextTool: ${args}`);
        return {
            content: [
                { 
                    type: "text", 
                    text: "Invalid arguments: 'conversationId' must be a string.",
                },
            ],
        };
    }
    const contextItems = await retrieveContext(conversationId, tags, minRelevanceScore, limit);
    if (contextItems.length === 0) {
        logger.warn(`[Memory] No relevant archived context found for conversation ${conversationId}.`);
        return {
            content: [
                { 
                    type: "text", 
                    text: `No relevant context items found for conversation ${conversationId}.`,
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

    logger.info(`[Memory] Retrieved ${contextItems.length} context items for conversation ${conversationId}`);
    return {
        content: [
            {
                type: "text",
                text: result,
            },
        ],
    };
}

export async function scoreRelevanceTool( args: any ) {
    if ( isDebugMode() ) {
        logger.debug(`[Memory] scoreRelevanceTool called with args: ${args}`);
    }
    if (!args) {
        logger.error("[Memory] No arguments provided to scoreRelevanceTool");
        return {
            content: [
                { 
                    type: "text", 
                    text: "No arguments provided. 'conversationId', 'currentContext' and 'llm' are required.",
                },
            ],
        };
    }
    const { conversationId, currentContext, llm } = args;
    if (typeof conversationId !== 'string' || typeof currentContext !== 'string' || typeof llm !== 'string') {
        logger.error(`[Memory] Invalid arguments for scoreRelevanceTool: ${args}`);
        return {
            content: [
                { 
                    type: "text",
                    text: "Invalid arguments: 'conversationId', 'currentContext' and 'llm' must be strings.",
                },
            ],
        };
    }
    const scoredCount = await scoreRelevance(conversationId, currentContext, llm);
    logger.info(`[Memory] Successfully scored relevance for ${scoredCount} archived items in conversation ${conversationId}.\nCurrent context length: ${currentContext.split(/\s+/).length} words`);
    return {
        content: [
            {
                type: "text",
                text: `Successfully scored relevance for ${scoredCount} archived items in conversation ${conversationId}.\nCurrent context length: ${currentContext.split(/\s+/).length} words`,
            },
        ],
    };
}

export async function createSummaryTool( args: any ) {
    if ( isDebugMode() ) {
        logger.debug(`[Memory] createSummaryTool called with args: ${args}`);
    }
    if (!args) {
        logger.error("[Memory] No arguments provided to createSummaryTool");
        return {
            content: [
                { 
                    type: "text", 
                    text: "No arguments provided. 'conversationId', 'contextItems', 'summaryText', and 'llm' are required.",
                },
            ],
        };
    }
    const { conversationId, contextItems, summaryText, llm, userId } = args;
    if (typeof conversationId !== 'string' || !Array.isArray(contextItems) || typeof summaryText !== 'string' || typeof llm !== 'string') {
        logger.error(`[Memory] Invalid arguments for createSummaryTool: ${args}`);
        return {
            content: [
                { 
                    type: "text", 
                    text: "Invalid arguments: 'conversationId', 'summaryText', and 'llm' must be strings, and 'contextItems' must be an array.",
                },
            ],
        };
    }
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
      logger.info(`[Memory] Successfully created summary for conversation ${conversationId}.\nSummary ID: ${summaryId}\nItems summarized: ${contextItems.length}\nSummary length: ${summaryText.split(/\s+/).length} words`);
      return {
        content: [
            {
                type: "text",
                text: `Successfully created summary for conversation ${conversationId}.\nSummary ID: ${summaryId}\nItems summarized: ${contextItems.length}\nSummary length: ${summaryText.split(/\s+/).length} words`,
            },
        ],
      };
}

export async function getConversationSummariesTool( args: any ) {
    if ( isDebugMode() ) {
        logger.debug(`[Memory] getConversationSummariesTool called with args: ${args}`);
    }
    if (!args || typeof args.conversationId !== 'string') {
        logger.error("[Memory] Invalid arguments provided to getConversationSummariesTool");
        return {
            content: [
                {
                    type: "text",
                    text: "Invalid arguments: 'conversationId' must be a string.",
                },
            ],
        };
    }
    const { conversationId } = args;
    const summaries = await getConversationSummaries(conversationId);
    if (summaries.length === 0) {
        logger.warn(`[Memory] No summaries found for conversation ${conversationId}`);
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
    logger.info(`[Memory] Retrieved conversation summaries of ${result.length} length`);

    return {
        content: [
          {
            type: "text",
            text: result,
          },
        ],
    };
}

export async function searchContextByTagsTool( args: any ) {
    if ( isDebugMode() ) {
        logger.debug(`[Memory] searchContextByTagsTool called with args: ${args}`);
    }
    if (!args || !Array.isArray(args.tags)) {
        logger.error("[Memory] Invalid arguments provided to searchContextByTagsTool");
        return {
            content: [
                {
                    type: "text",
                    text: "Invalid arguments: 'tags' must be an array of strings.",
                },
            ],
        };
    }
    const { tags } = args;
    if (tags.length === 0) {
        logger.error("[Memory] No tags provided to searchContextByTagsTool");
        return {
            content: [
                {
                    type: "text",
                    text: "No tags provided. Please provide at least one tag to search.",
                },
            ],
        };
    }
    const results = await searchContextByTags(tags);

    if (results.length === 0) {
        logger.warn(`[Memory] No context found with tags: ${tags.join(", ")}`);
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
    logger.info(`[Memory] Searched context by tags with results of length: ${result.length}`);
    return {
        content: [
          {
            type: "text",
            text: result,
          },
        ],
    };
}