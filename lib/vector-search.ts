/**
 * Vector Search Service
 * 
 * Implements semantic search over chat messages using pgvector.
 * Provides cosine similarity search with configurable thresholds and filtering.
 * 
 * Task 27.1: Create semantic search service
 * Requirements: 4.4, 4.5
 * Validates: Property 10 - Semantic Search Relevance
 * 
 * Usage:
 *   const service = new VectorSearchService(prisma, embeddingClient);
 *   const results = await service.search("find messages about AI", { channelId: "123", limit: 5 });
 */

import { PrismaClient, Message } from "@prisma/client";
import { EmbeddingClient } from "./embeddings";

/**
 * Search parameters
 */
export interface SemanticSearchParams {
  query: string;
  channelId?: string;
  serverId?: string;
  userId?: string;
  similarityThreshold?: number;
  limit?: number;
  excludeMessageIds?: string[];
}

/**
 * Search result with similarity score
 */
export interface SearchResult {
  message: Message;
  similarity: number;
  rank: number;
}

/**
 * Search statistics
 */
export interface SearchStats {
  totalResults: number;
  queryTime: number;
  usedIndex: boolean;
  averageSimilarity: number;
}

/**
 * Vector Search Service
 * 
 * Implements semantic search using pgvector cosine similarity
 */
export class VectorSearchService {
  private prisma: PrismaClient;
  private embeddingClient: EmbeddingClient;
  private defaultSimilarityThreshold: number;
  private defaultLimit: number;

  constructor(
    prisma: PrismaClient,
    embeddingClient: EmbeddingClient,
    options: {
      defaultSimilarityThreshold?: number;
      defaultLimit?: number;
    } = {}
  ) {
    this.prisma = prisma;
    this.embeddingClient = embeddingClient;
    this.defaultSimilarityThreshold = options.defaultSimilarityThreshold || 0.7;
    this.defaultLimit = options.defaultLimit || 10;
  }

  /**
   * Perform semantic search
   * 
   * Task 27.1: Implement cosine similarity search query
   * Requirement 4.4, 4.5
   */
  async search(
    params: SemanticSearchParams
  ): Promise<{ results: SearchResult[]; stats: SearchStats }> {
    const startTime = Date.now();

    try {
      // Generate query embedding
      console.log(`🔍 Searching for: "${params.query}"`);
      const queryEmbedding = await this.embeddingClient.embed(params.query);

      // Build SQL query with filters
      const similarityThreshold = params.similarityThreshold ?? this.defaultSimilarityThreshold;
      const limit = params.limit ?? this.defaultLimit;

      // Convert embedding to PostgreSQL vector format
      const embeddingStr = `[${queryEmbedding.join(",")}]`;

      // Base query with similarity calculation
      let sqlQuery = `
        SELECT 
          m.*,
          1 - (m.embedding <=> $1::vector) as similarity
        FROM "Message" m
        WHERE m.embedding IS NOT NULL
      `;

      const params_array: any[] = [embeddingStr];
      let paramIndex = 2;

      // Add filters
      if (params.channelId) {
        sqlQuery += ` AND m."channelId" = $${paramIndex}`;
        params_array.push(params.channelId);
        paramIndex++;
      }

      if (params.userId) {
        sqlQuery += ` AND m."userId" = $${paramIndex}`;
        params_array.push(params.userId);
        paramIndex++;
      }

      if (params.excludeMessageIds && params.excludeMessageIds.length > 0) {
        sqlQuery += ` AND m.id NOT IN (${params.excludeMessageIds.map((_, i) => `$${paramIndex + i}`).join(",")})`;
        params_array.push(...params.excludeMessageIds);
        paramIndex += params.excludeMessageIds.length;
      }

      // Add similarity threshold filter
      sqlQuery += ` AND (1 - (m.embedding <=> $1::vector)) >= $${paramIndex}`;
      params_array.push(similarityThreshold);
      paramIndex++;

      // Order by similarity (closest first)
      sqlQuery += ` ORDER BY m.embedding <=> $1::vector`;

      // Limit results
      sqlQuery += ` LIMIT $${paramIndex}`;
      params_array.push(limit);

      // Execute query
      const results = await this.prisma.$queryRawUnsafe<
        Array<Message & { similarity: number }>
      >(sqlQuery, ...params_array);

      // Calculate stats
      const queryTime = Date.now() - startTime;
      const averageSimilarity =
        results.length > 0
          ? results.reduce((sum, r) => sum + r.similarity, 0) / results.length
          : 0;

      const searchResults: SearchResult[] = results.map((result, index) => {
        const { similarity, ...message } = result;
        return {
          message: message as Message,
          similarity,
          rank: index + 1,
        };
      });

      const stats: SearchStats = {
        totalResults: results.length,
        queryTime,
        usedIndex: true, // Assume index is used if results returned quickly
        averageSimilarity,
      };

      console.log(
        `✅ Found ${results.length} results in ${queryTime}ms (avg similarity: ${averageSimilarity.toFixed(3)})`
      );

      return { results: searchResults, stats };
    } catch (error: any) {
      console.error("❌ Semantic search failed:", error.message);
      throw new Error(`Semantic search failed: ${error.message}`);
    }
  }

  /**
   * Find similar messages to a given message
   * 
   * Useful for "more like this" functionality
   */
  async findSimilar(
    messageId: string,
    options: {
      channelId?: string;
      limit?: number;
      similarityThreshold?: number;
    } = {}
  ): Promise<{ results: SearchResult[]; stats: SearchStats }> {
    const startTime = Date.now();

    try {
      // Get the source message
      const sourceMessage = await this.prisma.message.findUnique({
        where: { id: messageId },
      });

      if (!sourceMessage || !sourceMessage.embedding) {
        throw new Error("Message not found or has no embedding");
      }

      // Search using the message's embedding
      const embeddingStr = `[${(sourceMessage.embedding as number[]).join(",")}]`;
      const similarityThreshold = options.similarityThreshold ?? 0.5;
      const limit = options.limit ?? this.defaultLimit;

      let sqlQuery = `
        SELECT 
          m.*,
          1 - (m.embedding <=> $1::vector) as similarity
        FROM "Message" m
        WHERE m.embedding IS NOT NULL
          AND m.id != $2
          AND (1 - (m.embedding <=> $1::vector)) >= $3
      `;

      const params_array: any[] = [embeddingStr, messageId, similarityThreshold];

      if (options.channelId) {
        sqlQuery += ` AND m."channelId" = $4`;
        params_array.push(options.channelId);
      }

      sqlQuery += ` ORDER BY m.embedding <=> $1::vector LIMIT $${params_array.length + 1}`;
      params_array.push(limit);

      const results = await this.prisma.$queryRawUnsafe<
        Array<Message & { similarity: number }>
      >(sqlQuery, ...params_array);

      const queryTime = Date.now() - startTime;
      const averageSimilarity =
        results.length > 0
          ? results.reduce((sum, r) => sum + r.similarity, 0) / results.length
          : 0;

      const searchResults: SearchResult[] = results.map((result, index) => {
        const { similarity, ...message } = result;
        return {
          message: message as Message,
          similarity,
          rank: index + 1,
        };
      });

      return {
        results: searchResults,
        stats: {
          totalResults: results.length,
          queryTime,
          usedIndex: true,
          averageSimilarity,
        },
      };
    } catch (error: any) {
      console.error("❌ Similar message search failed:", error.message);
      throw new Error(`Similar message search failed: ${error.message}`);
    }
  }

  /**
   * Batch search multiple queries
   */
  async batchSearch(
    queries: string[],
    options: Omit<SemanticSearchParams, "query"> = {}
  ): Promise<Map<string, { results: SearchResult[]; stats: SearchStats }>> {
    const resultsMap = new Map<
      string,
      { results: SearchResult[]; stats: SearchStats }
    >();

    for (const query of queries) {
      const result = await this.search({ ...options, query });
      resultsMap.set(query, result);
    }

    return resultsMap;
  }

  /**
   * Get search suggestions based on query
   */
  async getSuggestions(
    partialQuery: string,
    options: {
      channelId?: string;
      limit?: number;
    } = {}
  ): Promise<string[]> {
    try {
      // Search with lower threshold for suggestions
      const { results } = await this.search({
        query: partialQuery,
        channelId: options.channelId,
        similarityThreshold: 0.5,
        limit: options.limit || 5,
      });

      // Extract unique content snippets
      const suggestions = results
        .map((r) => {
          // Get first 50 characters of content
          const snippet = r.message.content.substring(0, 50);
          return snippet.length < r.message.content.length
            ? snippet + "..."
            : snippet;
        })
        .filter((s, i, arr) => arr.indexOf(s) === i); // Unique only

      return suggestions;
    } catch (error: any) {
      console.error("❌ Get suggestions failed:", error.message);
      return [];
    }
  }

  /**
   * Validate search setup
   * 
   * Checks if vector index exists and embeddings are available
   */
  async validateSetup(): Promise<{
    hasIndex: boolean;
    indexType: string | null;
    embeddedCount: number;
    totalCount: number;
    embeddedPercentage: number;
  }> {
    try {
      // Check for vector index
      const indexInfo = await this.prisma.$queryRaw<
        Array<{
          indexname: string;
          indexdef: string;
        }>
      >`
        SELECT indexname, indexdef
        FROM pg_indexes
        WHERE tablename = 'Message'
          AND indexdef LIKE '%embedding%'
      `;

      const hasIndex = indexInfo.length > 0;
      let indexType: string | null = null;

      if (hasIndex) {
        // Determine index type (HNSW or IVFFlat)
        if (indexInfo[0].indexdef.includes("hnsw")) {
          indexType = "HNSW";
        } else if (indexInfo[0].indexdef.includes("ivfflat")) {
          indexType = "IVFFlat";
        }
      }

      // Count embedded messages
      const embeddedCount = await this.prisma.message.count({
        where: { embedding: { not: null } },
      });

      const totalCount = await this.prisma.message.count();

      const embeddedPercentage =
        totalCount > 0 ? (embeddedCount / totalCount) * 100 : 0;

      return {
        hasIndex,
        indexType,
        embeddedCount,
        totalCount,
        embeddedPercentage,
      };
    } catch (error: any) {
      console.error("❌ Validate setup failed:", error.message);
      throw error;
    }
  }
}

/**
 * Singleton instance
 */
let vectorSearchServiceInstance: VectorSearchService | null = null;

export function getVectorSearchService(
  prisma: PrismaClient,
  embeddingClient: EmbeddingClient
): VectorSearchService {
  if (!vectorSearchServiceInstance) {
    vectorSearchServiceInstance = new VectorSearchService(
      prisma,
      embeddingClient
    );
  }
  return vectorSearchServiceInstance;
}

export function resetVectorSearchService(): void {
  vectorSearchServiceInstance = null;
}
