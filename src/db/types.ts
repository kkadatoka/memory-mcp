import { ObjectId } from "mongodb";

// Basic memory types
export type ContextType = "active" | "archived" | "summary";

export interface Memory {
  _id?: ObjectId;
  memories: string[];
  timestamp: Date;
  llm: string;
  userId?: string;
  // Context window caching fields
  conversationId?: string;
  contextType?: ContextType;
  relevanceScore?: number; // 0-1
  tags?: string[];
  parentContextId?: ObjectId; // Reference to original content for summaries
  messageIndex?: number; // Order within conversation
  wordCount?: number;
  summaryText?: string;
}

// Orchestration types
export interface ConversationState {
  conversationId: string;
  currentContext: string[];
  archivedContext: Memory[];
  summaries: Memory[];
  totalWordCount: number;
  maxWordCount: number;
  llm: string;
  userId?: string;
}

export interface ArchiveDecision {
  shouldArchive: boolean;
  messagesToArchive: string[];
  tags: string[];
  reason: string;
}

export interface RetrievalDecision {
  shouldRetrieve: boolean;
  contextToRetrieve: Memory[];
  reason: string;
}

// MCP Tool parameter types
export interface SaveMemoriesParams {
  memories: string[];
  llm: string;
  userId?: string;
}

export interface AddMemoriesParams {
  memories: string[];
  llm: string;
  userId?: string;
}

export interface ArchiveContextParams {
  conversationId: string;
  contextMessages: string[];
  tags: string[];
  llm: string;
  userId?: string;
}

export interface RetrieveContextParams {
  conversationId: string;
  tags?: string[];
  minRelevanceScore?: number;
  limit?: number;
}

export interface ScoreRelevanceParams {
  conversationId: string;
  currentContext: string;
  llm: string;
}

export interface CreateSummaryParams {
  conversationId: string;
  contextItems: ContextItem[];
  summaryText: string;
  llm: string;
  userId?: string;
}

export interface GetConversationSummariesParams {
  conversationId: string;
}

export interface SearchContextByTagsParams {
  tags: string[];
}

// Helper types for MCP tool parameters
export interface ContextItem {
  _id?: string;
  memories: string[];
  timestamp: string;
  llm: string;
  userId?: string;
  conversationId?: string;
  contextType?: string;
  relevanceScore?: number;
  tags?: string[];
  parentContextId?: string;
  messageIndex?: number;
  wordCount?: number;
  summaryText?: string;
}

// Database configuration types
export interface DatabaseConfig {
  uri: string;
  databaseName: string;
  collectionName: string;
}

// Orchestrator configuration types
export interface OrchestratorConfig {
  maxWordCount: number;
  archiveThreshold: number;
  retrieveThreshold: number;
  defaultMinRelevanceScore: number;
  defaultRetrieveLimit: number;
}

// Response types
export interface MCPResponse {
  content: Array<{
    type: "text";
    text: string;
  }>;
}

export interface ConversationStatus {
  state: ConversationState;
  recommendations: string[];
}

// Error types
export interface MCPError {
  message: string;
  code?: string;
  details?: any;
} 