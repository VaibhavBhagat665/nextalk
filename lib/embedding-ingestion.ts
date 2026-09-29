/**
 * Embedding Ingestion Worker
 * 
 * Async background job that processes messages and generates embeddings.
 * Processes in batches of 100 to optimize API calls and costs.
 */

import { PrismaClient } from "@prisma/client";
import { embedBatch, estimateCost } from "./embeddings";

const prisma = new PrismaClient();

interface IngestionStats {
  processed: number;
  skipped: number;
  failed: number;
  totalTokens: number;
  estimatedCost: number;
  duration: number;
}

/**
 * Process messages that don't have embeddings yet
 * Idempotent - skips messages that already have embeddings
 */
export async function ingestMessageEmbeddings(
  options: {
    batchSize?: number;
    maxMessages?: number;
    channelId?: string;
  } = {}
): Promise<IngestionStats> {
  const { batchSize = 100, maxMessages = 1000, channelId } = options;
  
  const startTime = Date.now();
  const stats: IngestionStats = {
    processed: 0,
    skipped: 0,
    failed: 0,
    totalTokens: 0,
    estimatedCost: 0,
    duration: 0,
  };

  try {
    // Find messages without embeddings
    const messages = await prisma.message.findMany({
      where: {
        embedding: null,
        isDeleted: false,
        content: { not: "" },
        ...(channelId && { channelId }),
      },
      take: maxMessages,
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        content: true,
      },
    });

    console.log(`📊 Found ${messages.length} messages to process`);

    if (messages.length === 0) {
      stats.duration = Date.now() - startTime;
      return stats;
    }

    // Process in batches
    for (let i = 0; i < messages.length; i += batchSize) {
      const batch = messages.slice(i, i + batchSize);
      const texts = batch.map(m => m.content);
      
      try {
        console.log(`🔄 Processing batch ${i + 1}-${i + batch.length}/${messages.length}...`);
        
        const { embeddings, totalTokens } = await embedBatch(texts);
        stats.totalTokens += totalTokens;

        // Update database with embeddings
        const updates = batch.map((msg, idx) => 
          prisma.$executeRaw`
            UPDATE "Message" 
            SET embedding = ${embeddings[idx]}::vector
            WHERE id = ${msg.id}
          `
        );

        await Promise.all(updates);
        
        stats.processed += batch.length;
        console.log(`✅ Processed ${batch.length} messages (${totalTokens} tokens)`);
        
      } catch (error: any) {
        console.error(`❌ Batch processing failed:`, error.message);
        stats.failed += batch.length;
      }
    }

    stats.estimatedCost = estimateCost(stats.totalTokens);
    stats.duration = Date.now() - startTime;

    console.log(`\n📈 Ingestion Summary:`);
    console.log(`   Processed: ${stats.processed}`);
    console.log(`   Failed: ${stats.failed}`);
    console.log(`   Tokens: ${stats.totalTokens}`);
    console.log(`   Cost: $${stats.estimatedCost.toFixed(4)}`);
    console.log(`   Duration: ${(stats.duration / 1000).toFixed(2)}s`);

    return stats;
  } catch (error: any) {
    console.error("❌ Ingestion worker failed:", error.message);
    stats.duration = Date.now() - startTime;
    throw error;
  }
}

/**
 * Process a single new message immediately
 * Called when a message is created via API
 */
export async function ingestSingleMessage(messageId: string): Promise<void> {
  try {
    const message = await prisma.message.findUnique({
      where: { id: messageId },
      select: { id: true, content: true, embedding: true },
    });

    if (!message || message.embedding) {
      return; // Already has embedding or doesn't exist
    }

    if (!message.content || message.content.trim().length === 0) {
      return; // Skip empty messages
    }

    const { embedText } = await import("./embeddings");
    const { embedding } = await embedText(message.content);

    await prisma.$executeRaw`
      UPDATE "Message" 
      SET embedding = ${embedding}::vector
      WHERE id = ${messageId}
    `;

    console.log(`✅ Embedded message ${messageId}`);
  } catch (error: any) {
    console.error(`Failed to embed message ${messageId}:`, error.message);
  }
}

/**
 * Backfill embeddings for all existing messages
 * Should be run once after enabling pgvector
 */
export async function backfillAllEmbeddings(
  options: { batchSize?: number; delayMs?: number } = {}
): Promise<IngestionStats> {
  const { batchSize = 100, delayMs = 1000 } = options;
  
  console.log("🚀 Starting full backfill...");
  
  const totalStats: IngestionStats = {
    processed: 0,
    skipped: 0,
    failed: 0,
    totalTokens: 0,
    estimatedCost: 0,
    duration: 0,
  };

  const startTime = Date.now();
  let hasMore = true;

  while (hasMore) {
    const stats = await ingestMessageEmbeddings({
      batchSize,
      maxMessages: 1000,
    });

    totalStats.processed += stats.processed;
    totalStats.failed += stats.failed;
    totalStats.totalTokens += stats.totalTokens;

    hasMore = stats.processed > 0;

    if (hasMore) {
      console.log(`⏳ Waiting ${delayMs}ms before next batch...`);
      await new Promise(resolve => setTimeout(resolve, delayMs));
    }
  }

  totalStats.duration = Date.now() - startTime;
  totalStats.estimatedCost = estimateCost(totalStats.totalTokens);

  console.log(`\n🎉 Backfill Complete!`);
  console.log(`   Total Processed: ${totalStats.processed}`);
  console.log(`   Total Failed: ${totalStats.failed}`);
  console.log(`   Total Tokens: ${totalStats.totalTokens}`);
  console.log(`   Total Cost: $${totalStats.estimatedCost.toFixed(4)}`);
  console.log(`   Total Duration: ${(totalStats.duration / 1000 / 60).toFixed(2)} minutes`);

  return totalStats;
}
