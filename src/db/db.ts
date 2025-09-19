import { MongoClient, ObjectId, Db, Collection } from "mongodb";
import { Memory, ContextType } from "./types.js";
import { logger } from "../utils/logger.js";

// MongoDB connection details

const MONGODB_URI = process.env.MONGODB_URI || "mongodb://localhost:27017";
const DATABASE_NAME = "memory_mcp";
const COLLECTION_NAME = "memories";

let client: MongoClient;
let db: Db;
let collection: Collection<Memory>;

export async function connect() {
    if (client && db && collection) {
        logger.debug("[Database] Already connected to MongoDB");
        return;
    }
    client = new MongoClient(MONGODB_URI);
    await client.connect();
    db = client.db(DATABASE_NAME);
    collection = db.collection(COLLECTION_NAME);
    logger.info("[Database] Connected to MongoDB");
    return collection;
}

export async function saveMemories(
  memories: string[],
  llm: string,
  userId?: string,
): Promise<void> {
    await connect();
    const memoryDoc: Memory = {
        memories,
        timestamp: new Date(),
        llm,
        userId,
    };
    await collection.insertOne(memoryDoc);
    logger.info("[Database] Saved memories");
}

export async function getAllMemories(): Promise<Memory[]> {
    await connect();
    const memories = await collection.find({}).sort({ timestamp: -1 }).toArray();
    logger.info(`[Database] Retrieved ${memories.length} memories`);
    return memories;
}

export async function clearAllMemories(): Promise<number> {
    await connect();
    const result = await collection.deleteMany({});
    logger.info(`[Database] Cleared ${result.deletedCount} memories`);
    return result.deletedCount || 0;
}

export async function closeDatabase() {
    if (client) await client.close();
    logger.info("[Database] MongoDB connection closed");
}

export async function archiveContext(
  conversationId: string,
  contextMessages: string[],
  tags: string[],
  llm: string,
  userId?: string,
): Promise<number> {
    await connect();

    const archivedItems: Memory[] = contextMessages.map((message, index) => ({
        memories: [message],
        timestamp: new Date(),
        llm,
        userId,
        conversationId,
        contextType: "archived",
        tags,
        messageIndex: index,
        wordCount: message.split(/\s+/).length,
    }));

    const result = await collection.insertMany(archivedItems);
    logger.info(`[Database] Archived ${result.insertedCount} context messages for conversation ${conversationId}`);
    return result.insertedCount || 0;
}

export async function retrieveContext(
  conversationId: string,
  tags?: string[],
  minRelevanceScore: number = 0.1,
  limit: number = 10,
): Promise<Memory[]> {
    await connect();

    const filter: any = {
        conversationId,
        contextType: "archived",
        relevanceScore: { $gte: minRelevanceScore },
        };

    if (tags && tags.length > 0) {
        filter.tags = { $in: tags };
        }

    const contextItems = await collection
        .find(filter)
        .sort({ relevanceScore: -1, timestamp: -1 })
        .limit(limit)
        .toArray();

    logger.info(`[Database] Retrieved ${limit} context items for conversation ${conversationId}`);
    return contextItems;
}

export async function scoreRelevance(
  conversationId: string,
  currentContext: string,
  llm: string,
): Promise<number> {
    await connect();

    // Get all archived items for this conversation
    const archivedItems = await collection
        .find({ conversationId, contextType: "archived" })
        .toArray();

    if (archivedItems.length === 0) return 0;

    // Simple keyword overlap scoring
    const currentWords = new Set(currentContext.toLowerCase().split(/\s+/));
    let scoredCount = 0;

    for (const item of archivedItems) {
        const itemText = item.memories.join(" ");
        const itemWords = new Set(itemText.toLowerCase().split(/\s+/));

        // Calculate overlap
        const intersection = new Set(
        [...currentWords].filter((x) => itemWords.has(x)),
        );
        const union = new Set([...currentWords, ...itemWords]);

        const relevanceScore = intersection.size / union.size;

        // Update the item with new relevance score
        await collection.updateOne({ _id: item._id }, { $set: { relevanceScore } });

        scoredCount++;
    }
    logger.info(`[Database] Scored relevance for ${scoredCount} items in conversation ${conversationId}`);
    return scoredCount;
}

export async function createSummary(
  conversationId: string,
  contextItems: Memory[],
  summaryText: string,
  llm: string,
  userId?: string,
): Promise<ObjectId> {
    await connect();

    // Create summary entry
    const summaryDoc: Memory = {
        memories: [summaryText],
        timestamp: new Date(),
        llm,
        userId,
        conversationId,
        contextType: "summary",
        summaryText,
        wordCount: summaryText.split(/\s+/).length,
    };

    const result = await collection.insertOne(summaryDoc);
    const summaryId = result.insertedId;

    // Mark original items as archived and link to summary
    const itemIds = contextItems
        .map((item) => item._id)
        .filter((id): id is ObjectId => id !== undefined);

    if (itemIds.length > 0) {
        await collection.updateMany(
        { _id: { $in: itemIds } },
        {
            $set: {
            contextType: "archived",
            parentContextId: summaryId,
            },
        },
        );
    }
    logger.info(`[Database] Created summary ${summaryId} for conversation ${conversationId}`);
    return summaryId;
}

export async function getConversationSummaries(
  conversationId: string,
): Promise<Memory[]> {
    await connect();

    const summaries = await collection
        .find({ conversationId, contextType: "summary" })
        .sort({ timestamp: -1 })
        .toArray();

    logger.info(`[Database] Retrieved ${summaries.length} summaries for conversation ${conversationId}`);
    return summaries;
}

export async function searchContextByTags(tags: string[]): Promise<Memory[]> {
    await connect();


    const contextItems = await collection
        .find({
        tags: { $in: tags },
        contextType: { $in: ["archived", "summary"] },
        })
        .sort({ relevanceScore: -1, timestamp: -1 })
        .toArray();
    
    logger.info(`[Database] Found ${contextItems.length} context items matching tags`);
    return contextItems;
}

// Re-export types for convenience
export { Memory, ContextType } from "./types.js";