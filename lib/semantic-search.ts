/**
 * Semantic Search Service using pgvector
 * 
 * Performs cosine similarity search over message embeddings
 * to find semantically similar messages.
 */

import { PrismaClient } from "@prisma/client";
import { embedText } from "./embeddings";

const prisma = new PrismaClient();

export interface SemanticSearchParams {
  query: string;
  channelId?: string;
  limit?: number;
  similarityThreshold?: number;
  userId?: string;
}

export interface SearchResult {
  id: string;
  content: string;
  similarity: number;
  channelId: string;
  userId: string;
  createdAt: Date;
  user: {
    id: string;
    username: string;
    imageUrl: string | null;
  };
}

/**
 * Perform semantic search using pgvector cosine similarity
 */
export async function semanticSearch(
  params: SemanticSearchParams
): Promise<SearchResult[]> {
  const {
    query,
    channelId,
    limit = 10,
    similarityThreshold = 0.7,
    userId,
  } = params;

  try {
    // Generate embedding for the query
    const { embedding: queryEmbedding } = await embedText(query);

    // Build WHERE clause
    const channelFilter = channelId ? `AND m."channelId" = '${channelId}'` : "";
    const userFilter = userId ? `AND m."userId" = '${userId}'` : "";

    // Perform vector similarity search
    // Using cosine distance operator: <=> 
    const results = await prisma.$queryRawUnsafe<SearchResult[]>(`
      SELECT 
        m.id,
        m.content,
        m."channelId",
        m."userId",
        m."createdAt",
        1 - (m.embedding <=> $1::vector) as similarity,
        json_build_object(
          'id', u.id,
          'username', u.username,
          'imageUrl', u."imageUrl"
        ) as user
      FROM "Message" m
      JOIN "User" u ON m."userId" = u.id
      WHERE m.embedding IS NOT NULL
        AND m."isDeleted" = false
        ${channelFilter}
        ${userFilter}
        AND 1 - (m.embedding <=> $1::vector) >= ${similarityThreshold}
      ORDER BY m.embedding <=> $1::vector
      LIMIT ${limit}
    `, queryEmbedding);

    console.log(`🔍 Semantic search: "${query}" returned ${results.length} results`);

    return results;
  } catch (error: any) {
    console.error("Semantic search failed:", error.message);
    throw error;
  }
}

/**
 * Find similar messages to a given message
 * Useful for "find related" or "see similar" features
 */
export async function findSimilarMessages(
  messageId: string,
  limit: number = 5
): Promise<SearchResult[]> {
  try {
    const message = await prisma.message.findUnique({
      where: { id: messageId },
      select: { embedding: true, channelId: true },
    });

    if (!message || !message.embedding) {
      return [];
    }

    const results = await prisma.$queryRawUnsafe<SearchResult[]>(`
      SELECT 
        m.id,
        m.content,
        m."channelId",
        m."userId",
        m."createdAt",
        1 - (m.embedding <=> $1::vector) as similarity,
        json_build_object(
          'id', u.id,
          'username', u.username,
          'imageUrl', u."imageUrl"
        ) as user
      FROM "Message" m
      JOIN "User" u ON m."userId" = u.id
      WHERE m.embedding IS NOT NULL
        AND m."isDeleted" = false
        AND m.id != ${messageId}
        AND m."channelId" = ${message.channelId}
      ORDER BY m.embedding <=> $1::vector
      LIMIT ${limit}
    `, message.embedding);

    return results;
  } catch (error: any) {
    console.error("Find similar messages failed:", error.message);
    throw error;
  }
}

/**
 * Retrieve context for RAG (Retrieval Augmented Generation)
 * Fetches top-k relevant messages for AI Co-Pilot
 */
export async function retrieveContext(
  query: string,
  channelId: string,
  topK: number = 5
): Promise<string> {
  try {
    const results = await semanticSearch({
      query,
      channelId,
      limit: topK,
      similarityThreshold: 0.6, // Lower threshold for context retrieval
    });

    if (results.length === 0) {
      return "No relevant context found.";
    }

    // Format as context string
    const context = results
      .map((result, idx) => 
        `[${idx + 1}] ${result.user.username} (${formatDate(result.createdAt)}): ${result.content}`
      )
      .join("\n\n");

    return context;
  } catch (error: any) {
    console.error("Context retrieval failed:", error.message);
    return "Error retrieving context.";
  }
}

/**
 * Format date for context display
 */
function formatDate(date: Date): string {
  const now = new Date();
  const diff = now.getTime() - new Date(date).getTime();
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));

  if (days === 0) return "today";
  if (days === 1) return "yesterday";
  if (days < 7) return `${days} days ago`;
  
  return new Date(date).toLocaleDateString();
}

/**
 * Keyword search using PostgreSQL full-text search
 * Complements semantic search for hybrid retrieval
 */
export async function keywordSearch(
  query: string,
  channelId?: string,
  limit: number = 10
): Promise<SearchResult[]> {
  try {
    const channelFilter = channelId ? `AND m."channelId" = '${channelId}'` : "";

    const results = await prisma.$queryRawUnsafe<SearchResult[]>(`
      SELECT 
        m.id,
        m.content,
        m."channelId",
        m."userId",
        m."createdAt",
        ts_rank(to_tsvector('english', m.content), plainto_tsquery('english', $1)) as similarity,
        json_build_object(
          'id', u.id,
          'username', u.username,
          'imageUrl', u."imageUrl"
        ) as user
      FROM "Message" m
      JOIN "User" u ON m."userId" = u.id
      WHERE m."isDeleted" = false
        AND to_tsvector('english', m.content) @@ plainto_tsquery('english', $1)
        ${channelFilter}
      ORDER BY similarity DESC
      LIMIT ${limit}
    `, query);

    console.log(`🔍 Keyword search: "${query}" returned ${results.length} results`);

    return results;
  } catch (error: any) {
    console.error("Keyword search failed:", error.message);
    throw error;
  }
}

/**
 * Hybrid search: Combines semantic and keyword search using RRF
 * (Reciprocal Rank Fusion)
 */
export async function hybridSearch(
  query: string,
  channelId?: string,
  limit: number = 10
): Promise<SearchResult[]> {
  try {
    // Run both searches in parallel
    const [semanticResults, keywordResults] = await Promise.all([
      semanticSearch({ query, channelId, limit: limit * 2 }),
      keywordSearch(query, channelId, limit * 2),
    ]);

    // Reciprocal Rank Fusion scoring
    const k = 60; // RRF constant
    const scores = new Map<string, number>();
    const resultMap = new Map<string, SearchResult>();

    // Add semantic results with RRF scoring
    semanticResults.forEach((result, idx) => {
      const score = 1 / (k + idx + 1);
      scores.set(result.id, (scores.get(result.id) || 0) + score);
      resultMap.set(result.id, result);
    });

    // Add keyword results with RRF scoring
    keywordResults.forEach((result, idx) => {
      const score = 1 / (k + idx + 1);
      scores.set(result.id, (scores.get(result.id) || 0) + score);
      if (!resultMap.has(result.id)) {
        resultMap.set(result.id, result);
      }
    });

    // Sort by combined score
    const rankedResults = Array.from(scores.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, limit)
      .map(([id]) => resultMap.get(id)!)
      .filter(Boolean);

    console.log(`🔍 Hybrid search: "${query}" returned ${rankedResults.length} results`);

    return rankedResults;
  } catch (error: any) {
    console.error("Hybrid search failed:", error.message);
    throw error;
  }
}
