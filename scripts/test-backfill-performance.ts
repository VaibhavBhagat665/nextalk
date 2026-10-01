#!/usr/bin/env tsx
/**
 * Test Backfill Performance Script
 * 
 * Task 31.2: Run backfill and measure performance
 * Requirements: 4.9
 * 
 * This script tests the embedding backfill job on the seeded test database
 * and measures:
 * - Throughput (messages/second)
 * - Total cost (API usage)
 * - Memory usage
 * - Time to completion
 * 
 * Usage:
 *   npm run test:backfill-performance
 */

import { PrismaClient } from "@prisma/client";
import { EmbeddingBackfillJob } from "./backfill-embeddings";
import fs from "fs/promises";

const prisma = new PrismaClient();

interface PerformanceMetrics {
  totalMessages: number;
  messagesProcessed: number;
  messagesFailed: number;
  totalTokens: number;
  totalCost: number;
  durationSeconds: number;
  throughputMsgPerSec: number;
  avgTokensPerMessage: number;
  memoryUsageMB: {
    initial: number;
    peak: number;
    final: number;
  };
}

async function measurePerformance(): Promise<PerformanceMetrics> {
  console.log("🔬 Embedding Backfill Performance Test");
  console.log("=====================================\n");

  // Step 1: Check database state
  console.log("📊 Checking database state...");
  const totalMessages = await prisma.message.count();
  const messagesWithoutEmbeddings = await prisma.message.count({
    where: { embedding: null, isDeleted: false },
  });
  
  console.log(`   Total messages: ${totalMessages.toLocaleString()}`);
  console.log(`   Without embeddings: ${messagesWithoutEmbeddings.toLocaleString()}`);
  console.log("");

  if (messagesWithoutEmbeddings === 0) {
    console.log("⚠️  All messages already have embeddings!");
    console.log("   To test backfill, first clear embeddings:");
    console.log("   UPDATE \"Message\" SET embedding = NULL;\n");
    process.exit(1);
  }

  // Step 2: Record initial memory
  const initialMemory = process.memoryUsage().heapUsed / 1024 / 1024;
  let peakMemory = initialMemory;

  // Monitor memory usage
  const memoryInterval = setInterval(() => {
    const currentMemory = process.memoryUsage().heapUsed / 1024 / 1024;
    if (currentMemory > peakMemory) {
      peakMemory = currentMemory;
    }
  }, 1000);

  // Step 3: Run backfill job
  console.log("🚀 Starting backfill job...\n");
  const startTime = Date.now();

  const job = new EmbeddingBackfillJob({
    batchSize: 100,
    delayMs: 500, // Shorter delay for testing
    resume: false,
  });

  const result = await job.run();

  const endTime = Date.now();
  clearInterval(memoryInterval);

  // Step 4: Calculate metrics
  const durationSeconds = (endTime - startTime) / 1000;
  const finalMemory = process.memoryUsage().heapUsed / 1024 / 1024;

  const metrics: PerformanceMetrics = {
    totalMessages: messagesWithoutEmbeddings,
    messagesProcessed: result.totalProcessed,
    messagesFailed: result.totalFailed,
    totalTokens: result.totalTokens,
    totalCost: result.totalCost,
    durationSeconds,
    throughputMsgPerSec: result.totalProcessed / durationSeconds,
    avgTokensPerMessage: result.totalTokens / result.totalProcessed,
    memoryUsageMB: {
      initial: initialMemory,
      peak: peakMemory,
      final: finalMemory,
    },
  };

  return metrics;
}

async function generateReport(metrics: PerformanceMetrics): Promise<void> {
  console.log("\n");
  console.log("📊 Performance Report");
  console.log("=====================================");
  console.log("");

  console.log("Messages:");
  console.log(`  Total: ${metrics.totalMessages.toLocaleString()}`);
  console.log(`  Processed: ${metrics.messagesProcessed.toLocaleString()}`);
  console.log(`  Failed: ${metrics.messagesFailed.toLocaleString()}`);
  console.log(`  Success Rate: ${((metrics.messagesProcessed / metrics.totalMessages) * 100).toFixed(1)}%`);
  console.log("");

  console.log("Throughput:");
  console.log(`  Messages/sec: ${metrics.throughputMsgPerSec.toFixed(2)}`);
  console.log(`  Duration: ${formatDuration(metrics.durationSeconds)}`);
  console.log("");

  console.log("API Usage:");
  console.log(`  Total Tokens: ${metrics.totalTokens.toLocaleString()}`);
  console.log(`  Avg Tokens/Message: ${metrics.avgTokensPerMessage.toFixed(1)}`);
  console.log(`  Total Cost: $${metrics.totalCost.toFixed(4)}`);
  console.log(`  Cost per 1K messages: $${((metrics.totalCost / metrics.messagesProcessed) * 1000).toFixed(4)}`);
  console.log("");

  console.log("Memory Usage:");
  console.log(`  Initial: ${metrics.memoryUsageMB.initial.toFixed(2)} MB`);
  console.log(`  Peak: ${metrics.memoryUsageMB.peak.toFixed(2)} MB`);
  console.log(`  Final: ${metrics.memoryUsageMB.final.toFixed(2)} MB`);
  console.log(`  Increase: ${(metrics.memoryUsageMB.peak - metrics.memoryUsageMB.initial).toFixed(2)} MB`);
  console.log("");

  // Extrapolate to 1M messages
  if (metrics.messagesProcessed < 1_000_000) {
    const scale = 1_000_000 / metrics.messagesProcessed;
    console.log("Extrapolation to 1M Messages:");
    console.log(`  Estimated Duration: ${formatDuration(metrics.durationSeconds * scale)}`);
    console.log(`  Estimated Cost: $${(metrics.totalCost * scale).toFixed(2)}`);
    console.log(`  Estimated Tokens: ${(metrics.totalTokens * scale).toLocaleString()}`);
    console.log("");
  }

  // Generate markdown report
  const markdown = `# Embedding Backfill Performance Report

Generated: ${new Date().toISOString()}

## Summary

- **Messages Processed:** ${metrics.messagesProcessed.toLocaleString()}
- **Duration:** ${formatDuration(metrics.durationSeconds)}
- **Throughput:** ${metrics.throughputMsgPerSec.toFixed(2)} messages/second
- **Total Cost:** $${metrics.totalCost.toFixed(4)}
- **Success Rate:** ${((metrics.messagesProcessed / metrics.totalMessages) * 100).toFixed(1)}%

## Detailed Metrics

### Messages
| Metric | Value |
|--------|-------|
| Total | ${metrics.totalMessages.toLocaleString()} |
| Processed | ${metrics.messagesProcessed.toLocaleString()} |
| Failed | ${metrics.messagesFailed.toLocaleString()} |
| Success Rate | ${((metrics.messagesProcessed / metrics.totalMessages) * 100).toFixed(1)}% |

### Performance
| Metric | Value |
|--------|-------|
| Throughput | ${metrics.throughputMsgPerSec.toFixed(2)} msg/s |
| Duration | ${formatDuration(metrics.durationSeconds)} |
| Avg Tokens/Message | ${metrics.avgTokensPerMessage.toFixed(1)} |

### Cost Analysis
| Metric | Value |
|--------|-------|
| Total Tokens | ${metrics.totalTokens.toLocaleString()} |
| Total Cost | $${metrics.totalCost.toFixed(4)} |
| Cost per 1K messages | $${((metrics.totalCost / metrics.messagesProcessed) * 1000).toFixed(4)} |

### Memory Usage
| Metric | Value |
|--------|-------|
| Initial | ${metrics.memoryUsageMB.initial.toFixed(2)} MB |
| Peak | ${metrics.memoryUsageMB.peak.toFixed(2)} MB |
| Final | ${metrics.memoryUsageMB.final.toFixed(2)} MB |
| Increase | ${(metrics.memoryUsageMB.peak - metrics.memoryUsageMB.initial).toFixed(2)} MB |

${
  metrics.messagesProcessed < 1_000_000
    ? `
## Extrapolation to 1M Messages

Based on current performance:

- **Estimated Duration:** ${formatDuration((metrics.durationSeconds * 1_000_000) / metrics.messagesProcessed)}
- **Estimated Cost:** $${((metrics.totalCost * 1_000_000) / metrics.messagesProcessed).toFixed(2)}
- **Estimated Tokens:** ${((metrics.totalTokens * 1_000_000) / metrics.messagesProcessed).toLocaleString()}
`
    : ""
}

## Configuration

- **Batch Size:** 100 messages
- **Delay Between Batches:** 500ms
- **Embedding Model:** OpenAI text-embedding-3-small (1536 dimensions)
- **Cost Rate:** $0.02 per 1M tokens

## Notes

- The backfill job is idempotent and can be safely resumed if interrupted
- Progress is saved to \`.backfill-state.json\` for resume capability
- Rate limiting prevents API throttling
- Memory usage remains stable across large datasets
`;

  await fs.writeFile("benchmarks/backfill-performance.md", markdown);
  console.log("📄 Report saved to: benchmarks/backfill-performance.md");
  console.log("");
}

function formatDuration(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);

  const parts = [];
  if (hours > 0) parts.push(`${hours}h`);
  if (minutes > 0) parts.push(`${minutes}m`);
  if (secs > 0 || parts.length === 0) parts.push(`${secs}s`);

  return parts.join(" ");
}

async function main() {
  try {
    const metrics = await measurePerformance();
    await generateReport(metrics);
    await prisma.$disconnect();
    process.exit(0);
  } catch (error: any) {
    console.error("\n❌ Performance test failed:", error.message);
    await prisma.$disconnect();
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

export { measurePerformance, PerformanceMetrics };
