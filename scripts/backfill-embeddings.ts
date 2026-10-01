#!/usr/bin/env tsx
/**
 * Embedding Backfill Job
 * 
 * Task 31.1: Create embedding backfill job
 * Requirements: 4.9
 * 
 * Features:
 * - Process all existing messages in batches
 * - Progress tracking with resume capability
 * - Persistent state to resume after interruptions
 * - Cost estimation and reporting
 * - Rate limiting to avoid API throttling
 * 
 * Usage:
 *   npm run backfill:embeddings
 *   npm run backfill:embeddings -- --batch-size 50 --delay 2000
 *   npm run backfill:embeddings -- --resume
 */

import { PrismaClient } from "@prisma/client";
import fs from "fs/promises";
import path from "path";
import { embedBatch, estimateCost } from "../lib/embeddings";

const prisma = new PrismaClient();

interface BackfillState {
  lastProcessedId: string | null;
  totalProcessed: number;
  totalFailed: number;
  totalTokens: number;
  totalCost: number;
  startedAt: string;
  lastUpdated: string;
  completed: boolean;
}

interface BackfillOptions {
  batchSize: number;
  delayMs: number;
  stateFile: string;
  resume: boolean;
  maxBatches?: number;
}

const DEFAULT_STATE_FILE = ".backfill-state.json";

class EmbeddingBackfillJob {
  private options: BackfillOptions;
  private state: BackfillState;
  private startTime: number;

  constructor(options: Partial<BackfillOptions> = {}) {
    this.options = {
      batchSize: options.batchSize || 100,
      delayMs: options.delayMs || 1000,
      stateFile: options.stateFile || DEFAULT_STATE_FILE,
      resume: options.resume || false,
      maxBatches: options.maxBatches,
    };

    this.state = {
      lastProcessedId: null,
      totalProcessed: 0,
      totalFailed: 0,
      totalTokens: 0,
      totalCost: 0,
      startedAt: new Date().toISOString(),
      lastUpdated: new Date().toISOString(),
      completed: false,
    };

    this.startTime = Date.now();
  }

  /**
   * Load state from file to resume interrupted backfill
   */
  async loadState(): Promise<boolean> {
    try {
      const data = await fs.readFile(this.options.stateFile, "utf-8");
      this.state = JSON.parse(data);
      console.log("📂 Loaded previous state:");
      console.log(`   Last processed ID: ${this.state.lastProcessedId}`);
      console.log(`   Total processed: ${this.state.totalProcessed}`);
      console.log(`   Total tokens: ${this.state.totalTokens}`);
      console.log(`   Total cost: $${this.state.totalCost.toFixed(4)}`);
      return true;
    } catch (error) {
      // State file doesn't exist, starting fresh
      return false;
    }
  }

  /**
   * Save state to file for resume capability
   */
  async saveState(): Promise<void> {
    this.state.lastUpdated = new Date().toISOString();
    await fs.writeFile(
      this.options.stateFile,
      JSON.stringify(this.state, null, 2),
      "utf-8"
    );
  }

  /**
   * Clear state file after successful completion
   */
  async clearState(): Promise<void> {
    try {
      await fs.unlink(this.options.stateFile);
    } catch (error) {
      // File doesn't exist, ignore
    }
  }

  /**
   * Get count of messages that need embeddings
   */
  async getTotalMessagesCount(): Promise<number> {
    return await prisma.message.count({
      where: {
        embedding: null,
        isDeleted: false,
        content: { not: "" },
      },
    });
  }

  /**
   * Fetch a batch of messages to process
   */
  async fetchBatch(cursor: string | null): Promise<any[]> {
    const where = {
      embedding: null,
      isDeleted: false,
      content: { not: "" },
      ...(cursor && {
        id: { gt: cursor },
      }),
    };

    return await prisma.message.findMany({
      where,
      take: this.options.batchSize,
      orderBy: { id: "asc" },
      select: {
        id: true,
        content: true,
      },
    });
  }

  /**
   * Process a single batch of messages
   */
  async processBatch(messages: any[]): Promise<{
    processed: number;
    failed: number;
    tokens: number;
  }> {
    if (messages.length === 0) {
      return { processed: 0, failed: 0, tokens: 0 };
    }

    const texts = messages.map((m) => m.content);

    try {
      const { embeddings, totalTokens } = await embedBatch(texts);

      // Update database with embeddings
      const updates = messages.map((msg, idx) =>
        prisma.$executeRaw`
          UPDATE "Message" 
          SET embedding = ${embeddings[idx]}::vector
          WHERE id = ${msg.id}
        `
      );

      await Promise.all(updates);

      return {
        processed: messages.length,
        failed: 0,
        tokens: totalTokens,
      };
    } catch (error: any) {
      console.error(`❌ Batch processing failed:`, error.message);
      return {
        processed: 0,
        failed: messages.length,
        tokens: 0,
      };
    }
  }

  /**
   * Display progress bar
   */
  displayProgress(current: number, total: number): void {
    const percent = total > 0 ? ((current / total) * 100).toFixed(1) : "0.0";
    const barLength = 40;
    const filled = Math.floor((current / total) * barLength);
    const bar = "█".repeat(filled) + "░".repeat(barLength - filled);
    
    const elapsed = (Date.now() - this.startTime) / 1000;
    const rate = current / elapsed;
    const remaining = total > current ? (total - current) / rate : 0;
    
    const etaStr = remaining > 0 ? this.formatTime(remaining) : "N/A";
    const rateStr = rate.toFixed(1);

    process.stdout.write(
      `\r📊 Progress: [${bar}] ${percent}% (${current}/${total}) | ` +
      `Rate: ${rateStr} msg/s | ETA: ${etaStr} | ` +
      `Cost: $${this.state.totalCost.toFixed(4)}`
    );
  }

  /**
   * Format seconds into human-readable time
   */
  formatTime(seconds: number): string {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);

    if (hrs > 0) {
      return `${hrs}h ${mins}m`;
    } else if (mins > 0) {
      return `${mins}m ${secs}s`;
    } else {
      return `${secs}s`;
    }
  }

  /**
   * Run the backfill job
   */
  async run(): Promise<BackfillState> {
    console.log("🚀 Starting Embedding Backfill Job");
    console.log("=====================================");
    console.log(`Batch Size: ${this.options.batchSize}`);
    console.log(`Delay: ${this.options.delayMs}ms`);
    console.log(`State File: ${this.options.stateFile}`);
    console.log("");

    // Load state if resuming
    if (this.options.resume) {
      const loaded = await this.loadState();
      if (loaded) {
        console.log("🔄 Resuming from previous state\n");
      } else {
        console.log("⚠️  No previous state found, starting fresh\n");
      }
    }

    // Get total count
    const totalCount = await this.getTotalMessagesCount();
    console.log(`📝 Found ${totalCount} messages without embeddings\n`);

    if (totalCount === 0) {
      console.log("✅ All messages already have embeddings!");
      await this.clearState();
      return this.state;
    }

    // Process batches
    let batchNumber = 0;
    let hasMore = true;

    while (hasMore) {
      // Check max batches limit
      if (this.options.maxBatches && batchNumber >= this.options.maxBatches) {
        console.log(`\n⏸️  Reached max batches limit (${this.options.maxBatches})`);
        break;
      }

      // Fetch batch
      const messages = await this.fetchBatch(this.state.lastProcessedId);

      if (messages.length === 0) {
        hasMore = false;
        break;
      }

      // Process batch
      const result = await this.processBatch(messages);

      // Update state
      this.state.lastProcessedId = messages[messages.length - 1].id;
      this.state.totalProcessed += result.processed;
      this.state.totalFailed += result.failed;
      this.state.totalTokens += result.tokens;
      this.state.totalCost = estimateCost(this.state.totalTokens);

      // Save state
      await this.saveState();

      // Display progress
      this.displayProgress(this.state.totalProcessed, totalCount);

      batchNumber++;

      // Delay before next batch
      if (hasMore && this.options.delayMs > 0) {
        await new Promise((resolve) => setTimeout(resolve, this.options.delayMs));
      }
    }

    console.log("\n");
    console.log("=====================================");
    console.log("🎉 Backfill Complete!");
    console.log("=====================================");
    console.log(`Total Processed: ${this.state.totalProcessed}`);
    console.log(`Total Failed: ${this.state.totalFailed}`);
    console.log(`Total Tokens: ${this.state.totalTokens.toLocaleString()}`);
    console.log(`Total Cost: $${this.state.totalCost.toFixed(4)}`);
    console.log(`Duration: ${this.formatTime((Date.now() - this.startTime) / 1000)}`);
    console.log("");

    // Mark as completed
    this.state.completed = true;
    await this.saveState();

    return this.state;
  }
}

/**
 * CLI Entry Point
 */
async function main() {
  const args = process.argv.slice(2);
  
  const options: Partial<BackfillOptions> = {
    batchSize: 100,
    delayMs: 1000,
    resume: false,
  };

  // Parse CLI arguments
  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case "--batch-size":
        options.batchSize = parseInt(args[++i], 10);
        break;
      case "--delay":
        options.delayMs = parseInt(args[++i], 10);
        break;
      case "--resume":
        options.resume = true;
        break;
      case "--max-batches":
        options.maxBatches = parseInt(args[++i], 10);
        break;
      case "--help":
        console.log(`
Embedding Backfill Job

Usage:
  npm run backfill:embeddings [options]

Options:
  --batch-size <n>    Number of messages per batch (default: 100)
  --delay <ms>        Delay between batches in milliseconds (default: 1000)
  --resume            Resume from previous state
  --max-batches <n>   Maximum number of batches to process (for testing)
  --help              Show this help message

Examples:
  npm run backfill:embeddings
  npm run backfill:embeddings -- --batch-size 50 --delay 2000
  npm run backfill:embeddings -- --resume
  npm run backfill:embeddings -- --max-batches 10
        `);
        process.exit(0);
    }
  }

  const job = new EmbeddingBackfillJob(options);

  try {
    await job.run();
    await prisma.$disconnect();
    process.exit(0);
  } catch (error: any) {
    console.error("\n❌ Backfill job failed:", error.message);
    await prisma.$disconnect();
    process.exit(1);
  }
}

// Handle graceful shutdown
process.on("SIGINT", async () => {
  console.log("\n⏸️  Interrupted! State has been saved. Run with --resume to continue.");
  await prisma.$disconnect();
  process.exit(0);
});

process.on("SIGTERM", async () => {
  console.log("\n⏸️  Terminated! State has been saved. Run with --resume to continue.");
  await prisma.$disconnect();
  process.exit(0);
});

// Run if executed directly
if (require.main === module) {
  main();
}

export { EmbeddingBackfillJob, BackfillState, BackfillOptions };
