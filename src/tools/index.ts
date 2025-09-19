// Minimal memory module placeholder
// Exported functions will be implemented during the refactor.
import {
  saveMemoriesTool,
  getAllMemoriesTool,
  clearAllMemoriesTool,
  addMemoriesTool,
  archiveContextTool,
  retrieveContextTool,
  scoreRelevanceTool,
  getConversationSummariesTool,
  searchContextByTagsTool,
  createSummaryTool,
  } from "./defs.js"

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

// export tool definitions for the list-tools
export const tools = [
  saveMemoriesTool,
  getAllMemoriesTool,
  clearAllMemoriesTool,
  addMemoriesTool,
  archiveContextTool,
  retrieveContextTool,
  scoreRelevanceTool,
  getConversationSummariesTool,
  searchContextByTagsTool,
  createSummaryTool,
];

// Export tool implementations
// Adapter helper: convert positional DB functions into unified (args) => Promise<any> handlers
function adapt<T extends (...a: any[]) => any>(fn: T, paramNames: string[]) {
  return async (args?: Record<string, any>) => {
    args = args || {};
    const params = paramNames.map((p) => args[p]);
    return await fn(...params);
  };
}

/*
export const toolHandlers = {
  [saveMemoriesTool.name]: adapt(saveMemories, ["memories", "llm", "userId"]),
  [getAllMemoriesTool.name]: adapt(getAllMemories, []),
  [clearAllMemoriesTool.name]: adapt(clearAllMemories, []),
  [addMemoriesTool.name]: adapt(saveMemories, ["memories", "llm", "userId"]), // Reuse saveMemories for adding
  [archiveContextTool.name]: adapt(archiveContext, ["conversationId", "contextMessages", "tags", "llm", "userId"]),
  [retrieveContextTool.name]: adapt(retrieveContext, ["conversationId", "tags", "minRelevanceScore", "limit"]),
  [scoreRelevanceTool.name]: adapt(scoreRelevance, ["conversationId", "currentContext", "llm"]),
  [getConversationSummariesTool.name]: adapt(getConversationSummaries, ["conversationId"]),
  [searchContextByTagsTool.name]: adapt(searchContextByTags, ["tags"]),
  [createSummaryTool.name]: adapt(createSummary, ["conversationId", "contextItems", "summaryText", "llm", "userId"]),
};
*/

export const toolHandlers = {
  [saveMemoriesTool.name]: saveMemories,
  [getAllMemoriesTool.name]: getAllMemories,
  [clearAllMemoriesTool.name]: clearAllMemories,
  [addMemoriesTool.name]: addMemories,
  [archiveContextTool.name]: archiveContext,
  [retrieveContextTool.name]: retrieveContext,
  [scoreRelevanceTool.name]: scoreRelevance,
  [getConversationSummariesTool.name]: getConversationSummaries,
  [searchContextByTagsTool.name]: searchContextByTags,
  [createSummaryTool.name]: createSummary
};

export { connect, closeDatabase }; // Export connect and closeDatabase for external use