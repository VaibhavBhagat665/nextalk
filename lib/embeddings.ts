/**
 * Embedding API Client
 * 
 * Provides a unified interface for generating text embeddings using various providers.
 * Supports OpenAI text-embedding-3-small with batch processing, retry logic, and rate limiting.
 * 
 * Task 26.1: Create embedding API client
 * Requirements: 4.3
 * 
 * Usage:
 *   const client = new OpenAIEmbeddingClient(apiKey);
 *   const embedding = await client.embed("Hello world");
 *   const embeddings = await client.embedBatch(["text1", "text2"]);
 */

/**
 * Base interface for embedding providers
 */
export interface EmbeddingClient {
  /**
   * Generate embedding for a single text
   */
  embed(text: string): Promise<number[]>;

  /**
   * Generate embeddings for multiple texts in a single batch
   */
  embedBatch(texts: string[]): Promise<number[][]>;

  /**
   * Get the embedding dimension
   */
  getDimension(): number;

  /**
   * Get the model name
   */
  getModel(): string;
}

/**
 * OpenAI Embedding Client
 * 
 * Uses text-embedding-3-small model:
 * - Dimension: 1536
 * - Cost: $0.02 per 1M tokens
 * - Context: 8,191 tokens
 * - Performance: Fast and cost-effective
 */
export class OpenAIEmbeddingClient implements EmbeddingClient {
  private apiKey: string;
  private model: string;
  private dimension: number;
  private baseUrl: string;
  private maxRetries: number;
  private retryDelay: number;

  constructor(
    apiKey: string,
    options: {
      model?: string;
      dimension?: number;
      baseUrl?: string;
      maxRetries?: number;
      retryDelay?: number;
    } = {}
  ) {
    this.apiKey = apiKey;
    this.model = options.model || "text-embedding-3-small";
    this.dimension = options.dimension || 1536;
    this.baseUrl = options.baseUrl || "https://api.openai.com/v1";
    this.maxRetries = options.maxRetries || 3;
    this.retryDelay = options.retryDelay || 1000;
  }

  /**
   * Generate embedding for a single text
   */
  async embed(text: string): Promise<number[]> {
    const embeddings = await this.embedBatch([text]);
    return embeddings[0];
  }

  /**
   * Generate embeddings for multiple texts in a single batch
   * 
   * OpenAI supports up to 2048 texts per batch, but we limit to 100 for safety
   */
  async embedBatch(texts: string[]): Promise<number[][]> {
    if (texts.length === 0) {
      return [];
    }

    // Validate input
    if (texts.length > 100) {
      throw new Error(
        `Batch size ${texts.length} exceeds maximum of 100. Split into smaller batches.`
      );
    }

    // Filter out empty texts and track indices
    const validTexts: string[] = [];
    const validIndices: number[] = [];
    texts.forEach((text, index) => {
      const cleaned = text.trim();
      if (cleaned.length > 0) {
        validTexts.push(cleaned);
        validIndices.push(index);
      }
    });

    if (validTexts.length === 0) {
      // All texts were empty, return zero vectors
      return texts.map(() => new Array(this.dimension).fill(0));
    }

    // Make API request with retry logic
    let lastError: Error | null = null;

    for (let attempt = 0; attempt < this.maxRetries; attempt++) {
      try {
        const response = await fetch(`${this.baseUrl}/embeddings`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${this.apiKey}`,
          },
          body: JSON.stringify({
            model: this.model,
            input: validTexts,
            encoding_format: "float",
          }),
        });

        if (!response.ok) {
          const error = await response.json().catch(() => ({}));
          throw new Error(
            `OpenAI API error: ${response.status} ${response.statusText} - ${JSON.stringify(error)}`
          );
        }

        const data = await response.json();

        // Extract embeddings in correct order
        const embeddings = data.data.map((item: any) => item.embedding);

        // Map embeddings back to original positions (including empty texts)
        const result: number[][] = [];
        let validIdx = 0;

        for (let i = 0; i < texts.length; i++) {
          if (validIndices[validIdx] === i) {
            result.push(embeddings[validIdx]);
            validIdx++;
          } else {
            // Empty text, return zero vector
            result.push(new Array(this.dimension).fill(0));
          }
        }

        return result;
      } catch (error: any) {
        lastError = error;
        console.error(
          `Embedding attempt ${attempt + 1}/${this.maxRetries} failed:`,
          error.message
        );

        // Check if it's a rate limit error
        if (error.message.includes("rate_limit") || error.message.includes("429")) {
          // Wait longer for rate limit errors
          await this.sleep(this.retryDelay * Math.pow(2, attempt));
        } else if (attempt < this.maxRetries - 1) {
          // Exponential backoff for other errors
          await this.sleep(this.retryDelay * Math.pow(2, attempt));
        }
      }
    }

    throw new Error(
      `Failed to generate embeddings after ${this.maxRetries} attempts: ${lastError?.message}`
    );
  }

  getDimension(): number {
    return this.dimension;
  }

  getModel(): string {
    return this.model;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

/**
 * Mock Embedding Client (for testing)
 * 
 * Generates random embeddings for testing without API calls
 */
export class MockEmbeddingClient implements EmbeddingClient {
  private dimension: number;
  private model: string;

  constructor(dimension: number = 1536) {
    this.dimension = dimension;
    this.model = "mock-embedding-model";
  }

  async embed(text: string): Promise<number[]> {
    return this.generateRandomEmbedding(text);
  }

  async embedBatch(texts: string[]): Promise<number[][]> {
    return texts.map((text) => this.generateRandomEmbedding(text));
  }

  getDimension(): number {
    return this.dimension;
  }

  getModel(): string {
    return this.model;
  }

  private generateRandomEmbedding(text: string): number[] {
    // Generate deterministic random embeddings based on text hash
    const seed = this.hashString(text);
    const rng = this.seededRandom(seed);

    const embedding: number[] = [];
    for (let i = 0; i < this.dimension; i++) {
      embedding.push(rng() * 2 - 1); // Range: -1 to 1
    }

    // Normalize to unit length (for cosine similarity)
    const magnitude = Math.sqrt(
      embedding.reduce((sum, val) => sum + val * val, 0)
    );
    return embedding.map((val) => val / magnitude);
  }

  private hashString(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash);
  }

  private seededRandom(seed: number): () => number {
    let state = seed;
    return () => {
      state = (state * 9301 + 49297) % 233280;
      return state / 233280;
    };
  }
}

/**
 * Rate Limiter for API calls
 * 
 * Implements token bucket algorithm to prevent exceeding API rate limits
 */
export class RateLimiter {
  private tokens: number;
  private maxTokens: number;
  private refillRate: number; // tokens per second
  private lastRefill: number;

  constructor(maxTokens: number, refillRate: number) {
    this.tokens = maxTokens;
    this.maxTokens = maxTokens;
    this.refillRate = refillRate;
    this.lastRefill = Date.now();
  }

  /**
   * Wait until we have enough tokens to proceed
   */
  async waitForToken(count: number = 1): Promise<void> {
    while (true) {
      this.refill();

      if (this.tokens >= count) {
        this.tokens -= count;
        return;
      }

      // Wait until we have enough tokens
      const tokensNeeded = count - this.tokens;
      const waitTime = (tokensNeeded / this.refillRate) * 1000;
      await new Promise((resolve) => setTimeout(resolve, waitTime));
    }
  }

  private refill(): void {
    const now = Date.now();
    const elapsed = (now - this.lastRefill) / 1000;
    const tokensToAdd = elapsed * this.refillRate;

    this.tokens = Math.min(this.maxTokens, this.tokens + tokensToAdd);
    this.lastRefill = now;
  }
}

/**
 * Batched Embedding Client
 * 
 * Wraps an embedding client with automatic batching and rate limiting
 */
export class BatchedEmbeddingClient {
  private client: EmbeddingClient;
  private rateLimiter: RateLimiter | null;
  private batchSize: number;

  constructor(
    client: EmbeddingClient,
    options: {
      batchSize?: number;
      rateLimiter?: RateLimiter;
    } = {}
  ) {
    this.client = client;
    this.batchSize = options.batchSize || 100;
    this.rateLimiter = options.rateLimiter || null;
  }

  /**
   * Embed multiple texts with automatic batching
   */
  async embedAll(texts: string[]): Promise<number[][]> {
    const results: number[][] = [];

    // Split into batches
    for (let i = 0; i < texts.length; i += this.batchSize) {
      const batch = texts.slice(i, i + this.batchSize);

      // Wait for rate limit
      if (this.rateLimiter) {
        await this.rateLimiter.waitForToken(batch.length);
      }

      // Generate embeddings
      const embeddings = await this.client.embedBatch(batch);
      results.push(...embeddings);

      console.log(
        `Embedded batch ${Math.floor(i / this.batchSize) + 1}/${Math.ceil(texts.length / this.batchSize)} (${embeddings.length} texts)`
      );
    }

    return results;
  }
}

/**
 * Factory function to create embedding client
 */
export function createEmbeddingClient(
  provider: "openai" | "mock" = "openai"
): EmbeddingClient {
  if (provider === "mock") {
    return new MockEmbeddingClient();
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY environment variable is required");
  }

  return new OpenAIEmbeddingClient(apiKey, {
    model: "text-embedding-3-small",
    dimension: 1536,
  });
}

/**
 * Singleton instance
 */
let embeddingClientInstance: EmbeddingClient | null = null;

export function getEmbeddingClient(): EmbeddingClient {
  if (!embeddingClientInstance) {
    embeddingClientInstance = createEmbeddingClient();
  }
  return embeddingClientInstance;
}

export function resetEmbeddingClient(): void {
  embeddingClientInstance = null;
}

/**
 * Helper function to embed a single text (convenience wrapper)
 */
export async function embedText(text: string): Promise<{
  embedding: number[];
  tokens: number;
}> {
  const client = getEmbeddingClient();
  const embedding = await client.embed(text);
  
  // Estimate tokens (rough approximation: ~0.75 tokens per character)
  const tokens = Math.ceil(text.length * 0.75);
  
  return { embedding, tokens };
}

/**
 * Helper function to embed multiple texts in batch
 */
export async function embedBatch(texts: string[]): Promise<{
  embeddings: number[][];
  totalTokens: number;
}> {
  const client = getEmbeddingClient();
  const embeddings = await client.embedBatch(texts);
  
  // Estimate total tokens
  const totalTokens = texts.reduce((sum, text) => sum + Math.ceil(text.length * 0.75), 0);
  
  return { embeddings, totalTokens };
}

/**
 * Estimate cost for embedding generation
 * OpenAI text-embedding-3-small: $0.02 per 1M tokens
 */
export function estimateCost(tokens: number): number {
  const COST_PER_MILLION = 0.02;
  return (tokens / 1_000_000) * COST_PER_MILLION;
}
