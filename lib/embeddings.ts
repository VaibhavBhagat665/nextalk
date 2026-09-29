/**
 * Embedding Service using OpenAI text-embedding-3-small
 * 
 * Generates 1536-dimensional embeddings for semantic search.
 * Supports batch processing and rate limiting.
 */

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const EMBEDDING_MODEL = "text-embedding-3-small";
const EMBEDDING_DIMENSIONS = 1536;
const MAX_BATCH_SIZE = 100;

export interface EmbeddingResult {
  embedding: number[];
  tokens: number;
}

export interface BatchEmbeddingResult {
  embeddings: number[][];
  totalTokens: number;
}

/**
 * Generate embedding for a single text
 */
export async function embedText(text: string): Promise<EmbeddingResult> {
  if (!OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY not configured");
  }

  const cleaned = cleanText(text);
  
  try {
    const response = await fetch("https://api.openai.com/v1/embeddings", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: EMBEDDING_MODEL,
        input: cleaned,
        dimensions: EMBEDDING_DIMENSIONS,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`OpenAI API error: ${response.status} ${error}`);
    }

    const data = await response.json();
    
    return {
      embedding: data.data[0].embedding,
      tokens: data.usage.total_tokens,
    };
  } catch (error: any) {
    console.error("Embedding generation failed:", error.message);
    throw error;
  }
}

/**
 * Generate embeddings for multiple texts in batch
 * Automatically chunks into batches if needed
 */
export async function embedBatch(texts: string[]): Promise<BatchEmbeddingResult> {
  if (!OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY not configured");
  }

  if (texts.length === 0) {
    return { embeddings: [], totalTokens: 0 };
  }

  const cleaned = texts.map(cleanText);
  const embeddings: number[][] = [];
  let totalTokens = 0;

  // Process in chunks
  for (let i = 0; i < cleaned.length; i += MAX_BATCH_SIZE) {
    const chunk = cleaned.slice(i, i + MAX_BATCH_SIZE);
    
    try {
      const response = await fetch("https://api.openai.com/v1/embeddings", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${OPENAI_API_KEY}`,
        },
        body: JSON.stringify({
          model: EMBEDDING_MODEL,
          input: chunk,
          dimensions: EMBEDDING_DIMENSIONS,
        }),
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`OpenAI API error: ${response.status} ${error}`);
      }

      const data = await response.json();
      
      embeddings.push(...data.data.map((d: any) => d.embedding));
      totalTokens += data.usage.total_tokens;
      
      // Rate limiting: small delay between batches
      if (i + MAX_BATCH_SIZE < cleaned.length) {
        await new Promise(resolve => setTimeout(resolve, 200));
      }
    } catch (error: any) {
      console.error(`Batch embedding failed (chunk ${i}-${i + chunk.length}):`, error.message);
      throw error;
    }
  }

  return { embeddings, totalTokens };
}

/**
 * Clean and prepare text for embedding
 */
function cleanText(text: string): string {
  return text
    .trim()
    .replace(/\s+/g, " ") // Normalize whitespace
    .substring(0, 8000);  // Limit length (model has ~8k token limit)
}

/**
 * Calculate cosine similarity between two embeddings
 */
export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) {
    throw new Error("Embeddings must have same dimensions");
  }

  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }

  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

/**
 * Estimate cost for embedding generation
 * text-embedding-3-small: $0.02 per 1M tokens
 */
export function estimateCost(tokenCount: number): number {
  return (tokenCount / 1_000_000) * 0.02;
}

export const EMBEDDING_CONFIG = {
  model: EMBEDDING_MODEL,
  dimensions: EMBEDDING_DIMENSIONS,
  maxBatchSize: MAX_BATCH_SIZE,
};
