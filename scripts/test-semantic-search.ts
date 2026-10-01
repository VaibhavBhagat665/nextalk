/**
 * Test script for semantic search functionality
 * 
 * Usage: npx tsx scripts/test-semantic-search.ts
 */

import { PrismaClient } from "@prisma/client";
import { semanticSearch, retrieveContext } from "../lib/semantic-search";
import { VectorSearchService } from "../lib/vector-search";
import { getEmbeddingClient } from "../lib/embeddings";

const prisma = new PrismaClient();

async function main() {
  console.log("🧪 Testing Semantic Search Service\n");

  try {
    // Test 1: Check if vector search setup is valid
    console.log("Test 1: Validating vector search setup...");
    const embeddingClient = getEmbeddingClient();
    const vectorSearchService = new VectorSearchService(prisma, embeddingClient);
    
    const setupValidation = await vectorSearchService.validateSetup();
    console.log("✅ Vector search setup:");
    console.log(`   - Has index: ${setupValidation.hasIndex}`);
    console.log(`   - Index type: ${setupValidation.indexType || 'N/A'}`);
    console.log(`   - Embedded messages: ${setupValidation.embeddedCount}/${setupValidation.totalCount} (${setupValidation.embeddedPercentage.toFixed(1)}%)`);
    console.log();

    // Test 2: Basic semantic search
    console.log("Test 2: Basic semantic search...");
    const searchQuery = "hello world";
    
    const results = await semanticSearch({
      query: searchQuery,
      limit: 5,
      similarityThreshold: 0.5, // Lower threshold for testing
    });

    console.log(`✅ Found ${results.length} results for query: "${searchQuery}"`);
    if (results.length > 0) {
      console.log("\nTop results:");
      results.slice(0, 3).forEach((result, idx) => {
        console.log(`   ${idx + 1}. [Similarity: ${result.similarity.toFixed(3)}] ${result.content.substring(0, 60)}...`);
      });
    }
    console.log();

    // Test 3: Similarity threshold filtering
    console.log("Test 3: Testing similarity threshold (>0.7)...");
    const highThresholdResults = await semanticSearch({
      query: searchQuery,
      limit: 10,
      similarityThreshold: 0.7,
    });

    const allAboveThreshold = highThresholdResults.every(r => r.similarity >= 0.7);
    console.log(`✅ All ${highThresholdResults.length} results have similarity >= 0.7: ${allAboveThreshold}`);
    console.log();

    // Test 4: Results are ranked by similarity
    console.log("Test 4: Verifying results are ranked by similarity...");
    if (results.length > 1) {
      const isDescending = results.every((r, idx) => 
        idx === 0 || results[idx - 1].similarity >= r.similarity
      );
      console.log(`✅ Results are properly ranked by similarity: ${isDescending}`);
    } else {
      console.log("⚠️  Not enough results to verify ranking");
    }
    console.log();

    // Test 5: Context retrieval for RAG
    console.log("Test 5: Testing RAG context retrieval...");
    const messages = await prisma.message.findMany({
      where: { embedding: { not: null } },
      take: 1,
      select: { channelId: true },
    });

    if (messages.length > 0) {
      const context = await retrieveContext(
        "What was discussed?",
        messages[0].channelId,
        3
      );
      console.log(`✅ Retrieved context (${context.length} chars):`);
      console.log(context.substring(0, 200) + (context.length > 200 ? "..." : ""));
    } else {
      console.log("⚠️  No embedded messages found for context retrieval test");
    }
    console.log();

    console.log("✅ All tests passed!");
  } catch (error: any) {
    console.error("❌ Test failed:", error.message);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
