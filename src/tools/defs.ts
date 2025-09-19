/**
 * Tool definitions and parameter types for MCP (Memory Control Protocol).
 * These definitions are used to register tools with the MCP server.
 */

export const saveMemoriesTool = {
  name: "save-memories",
  description:
    "Save all memories to the database, overwriting existing ones, optionally identify user by asking name if not provided",
  inputSchema: {
    type: "object",
    properties: {
      memories: { type: "array", items: { type: "string" }, description: "Array of memory strings to save" },
      llm: { type: "string", description: "Identifier of the LLM client that generated the memories, e.g., claude, chatbox, chatgpt" },
      userId: { type: "string", description: "Optional user identifier associated with the memories, could be name of user or just Guest" },
    },
    required: ["memories", "llm"],
  },
};

export const getAllMemoriesTool = { name: "get-all-memories", description: "Retrieve all stored memories from the database" };

export const clearAllMemoriesTool = { name: "clear-all-memories", description: "Clear all stored memories from the database" };

export const addMemoriesTool = {
  name: "add-memories",
  description: "Add new memories to the database without overwriting existing ones",
  inputSchema: {
    type: "object",
    properties: {
      memories: { type: "array", items: { type: "string" }, description: "Array of memory strings to add" },
      llm: { type: "string", description: "Identifier of the LLM client that generated the memories, e.g., claude, chatbox, chatgpt" },
      userId: { type: "string", description: "Optional user identifier associated with the memories, could be name of user or just Guest" },
    },
    required: ["memories", "llm"],
  },
};

export const archiveContextTool = {
  name: "archive-context",
  description: "Archive less relevant context messages from a conversation to manage memory limits",
  inputSchema: {
    type: "object",
    properties: {
      conversationId: { type: "string", description: "Unique Identifier of the conversation" },
      contextMessages: { type: "array", items: { type: "string" }, description: "Array of context messages to consider for archiving" },
      tags: { type: "array", items: { type: "string" }, description: "Optional tags to associate with archived context" },
      llm: { type: "string", description: "Identifier of the LLM client that generated the context, e.g., claude, chatbox, chatgpt" },
      userId: { type: "string", description: "Optional user identifier associated with the conversation, could be name of user or just Guest" },
    },
    required: ["conversationId", "contextMessages", "llm"],
  },
};

export const retrieveContextTool = {
  name: "retrieve-context",
  description: "Retrieve relevant archived context messages for a conversation based on tags and relevance score",
  inputSchema: {
    type: "object",
    properties: {
      conversationId: { type: "string", description: "Unique Identifier of the conversation" },
      tags: { type: "array", items: { type: "string" }, description: "Optional tags to filter archived messages" },
      minRelevanceScore: { type: "number", description: "Minimum relevance score (0 to 1)", default: 0.1 },
      limit: { type: "number", description: "Maximum number of archived messages to retrieve", default: 10 },
    },
    required: ["conversationId"],
  },
};

export const scoreRelevanceTool = {
  name: "score-relevance",
  description: "Score relevance of archived context messages for a conversation based on current context",
  inputSchema: {
    type: "object",
    properties: {
      conversationId: { type: "string", description: "Unique Identifier of the conversation" },
      currentContext: { type: "string", description: "Current context string of the conversation" },
      llm: { type: "string", description: "Identifier of the LLM that generated the context, e.g., claude, chatbox, chatgpt" },
    },
    required: ["conversationId", "currentContext", "llm"],
  },
};

export const getConversationSummariesTool = {
  name: "get-conversation-summaries",
  description: "Retrieve all summary context items for a given conversation",
  inputSchema: { type: "object", properties: { conversationId: { type: "string", description: "Unique Identifier of the conversation" } }, required: ["conversationId"] },
};

export const searchContextByTagsTool = {
  name: "search-context-by-tags",
  description: "Search archived context messages by tags",
  inputSchema: { type: "object", properties: { tags: { type: "array", items: { type: "string" }, description: "Array of tags to search for" } }, required: ["tags"] },
};

export const createSummaryTool = {
  name: "create-summary",
  description: "Create a concise summary of given memories to aid in context management",
  inputSchema: {
    type: "object",
    properties: {
      conversationId: { type: "string", description: "Unique Identifier of the conversation" },
      contextItems: {
        type: "array",
        items: {
          type: "object",
          properties: {
            _id: { type: "string", description: "Identifier of the context item" },
            memories: { type: "array", items: { type: "string" }, description: "Text array content of the context item" },
            timestamp: { type: "string", description: "Timestamp when the context item was created" },
            llm: { type: "string", description: "LLM client that generated the context item, e.g., claude, chatbox, chatgpt" },
            userId: { type: "string", description: "Optional identifier of the user who created the context item, could be name of user or just Guest" },
            conversationId: { type: "string", description: "Unique Identifier of the conversation this context item belongs to" },
            contextType: { type: "string", enum: ["active", "archived", "summary"], description: "Type of context item" },
            relevanceScore: { type: "number", description: "Relevance score of the context item" },
            tags: { type: "array", items: { type: "string" }, description: "Optional tags associated with the context item" },
            parentContextId: { type: "string", description: "Identifier of the parent context item if this is a summary" },
            messageIndex: { type: "number", description: "Order index of the context item within the conversation" },
            wordCount: { type: "number", description: "Word count of the context item" },
            summaryText: { type: "string", description: "Summary text if this context item is a summary" },
          },
          required: ["memories", "timestamp", "llm"],
        },
        description: "Array of context items (memories) to be summarized",
      },
      summaryText: { type: "string", description: "Human-provided summary text to use as the basis for creating the summary" },
      llm: { type: "string", description: "Identifier of the LLM that will generate the summary, e.g., claude, chatbox, chatgpt" },
      userId: { type: "string", description: "Optional user identifier associated with the conversation, could be name of user or just Guest" },
    },
    required: ["conversationId", "contextItems", "summaryText", "llm"],
  },
};