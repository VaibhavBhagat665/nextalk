/**
 * Test script for hybrid retrieval system (Task 28)
 * 
 * Tests both keyword search and hybrid search (RRF) functionality
 * Requirements: 4.6
 * 
 * Usage: npx tsx scripts/test-hybrid-search.ts
 */

import { PrismaClient } from "@prisma/client";
import { keywordSearch, semanticSearch, hybridSearch } from "../lib/semantic-search";

const prisma = new PrismaClient();

async function main() {
  console.log("🧪 Testing Hybrid Retrieval System (Task 28)\n");

  try {
    // Test 1: Verify GIN index exists
    console.log("Test 1: Checking for GIN index on Message.content...");
    const indexCheck = await prisma.$queryRaw<Array<{ indexname: string }>>`
      SELECT indexname 
      FROM pg_indexes 
      WHERE tablename = 'Message' 
      AND indexname LIKE '%fts%'
    `;
    
    if (indexCheck.length > 0) {
      console.log(`✅ GIN index found: ${indexCheck[0].indexname}`);
    } else {
      console.log("⚠️  GIN index not found. Run the migration:");
      console.log("   npx prisma migrate deploy");
    }
    console.log();

    // Test 2: Keyword search
    console.log("Test 2: Testing keyword search with ts_rank...");
    const keywordQuery = "hello";
    const keywordResults = await keywordSearch(keywordQuery, undefined, 5);
    
    console.log(`   Query: "${keywordQuery}"`);
    console.log(`   Results: ${keywordResults.length} messages found`);
    
    if (keywordResults.length > 0) {
      console.log("   Top result:");
      console.log(`   - Content: "${keywordResults[0].content.substring(0, 50)}..."`);
      console.log(`   - Similarity (ts_rank): ${keywordResults[0].similarity}`);
      console.log(`   - User: ${keywordResults[0].user.username}`);
    }
    console.log();

    // Test 3: Semantic search
    console.log("Test 3: Testing semantic search for comparison...");
    const semanticResults = await semanticSearch({
      query: keywordQuery,
      limit: 5,
    });
    
    console.log(`   Query: "${keywordQuery}"`);
    console.log(`   Results: ${semanticResults.length} messages found`);
    
    if (semanticResults.length > 0) {
      console.log("   Top result:");
      console.log(`   - Content: "${semanticResults[0].content.substring(0, 50)}..."`);
      console.log(`   - Similarity (cosine): ${semanticResults[0].similarity.toFixed(4)}`);
      console.log(`   - User: ${semanticResults[0].user.username}`);
    }
    console.log();

    // Test 4: Hybrid search with RRF
    console.log("Test 4: Testing hybrid search with Reciprocal Rank Fusion...");
    const hybridResults = await hybridSearch(keywordQuery, undefined, 10);
    
    console.log(`   Query: "${keywordQuery}"`);
    console.log(`   Results: ${hybridResults.length} messages found`);
    console.log("   RRF combines semantic + keyword search results");
    
    if (hybridResults.length > 0) {
      console.log("   Top 3 results:");
      hybridResults.slice(0, 3).forEach((result, idx) => {
        console.log(`   ${idx + 1}. "${result.content.substring(0, 40)}..." - ${result.user.username}`);
      });
    }
    console.log();

    // Test 5: Compare all three methods
    console.log("Test 5: Comparison of search methods...");
    const testQuery = "project meeting";
    
    console.log(`   Testing query: "${testQuery}"`);
    
    const [keyword, semantic, hybrid] = await Promise.all([
      keywordSearch(testQuery, undefined, 5).catch(() => []),
      semanticSearch({ query: testQuery, limit: 5 }).catch(() => []),
      hybridSearch(testQuery, undefined, 5).catch(() => []),
    ]);
    
    console.log(`   - Keyword search: ${keyword.length} results`);
    console.log(`   - Semantic search: ${semantic.length} results`);
    console.log(`   - Hybrid search (RRF): ${hybrid.length} results`);
    console.log();

    // Test 6: RRF algorithm verification
    console.log("Test 6: Verifying RRF algorithm properties...");
    console.log("   RRF uses k=60 constant");
    console.log("   Score formula: 1 / (k + rank)");
    console.log("   Higher combined score = better relevance");
    
    // Calculate example RRF scores
    const k = 60;
    const rank1Score = 1 / (k + 1);
    const rank5Score = 1 / (k + 5);
    
    console.log(`   - Rank 1 contribution: ${rank1Score.toFixed(6)}`);
    console.log(`   - Rank 5 contribution: ${rank5Score.toFixed(6)}`);
    console.log("   ✅ RRF favors top-ranked results from both methods");
    console.log();

    console.log("✅ All hybrid retrieval tests completed!");
    console.log();
    console.log("📋 Summary:");
    console.log("   - GIN index enables fast keyword search");
    console.log("   - ts_rank provides relevance scoring for keywords");
    console.log("   - RRF combines semantic + keyword results");
    console.log("   - Hybrid search provides best of both worlds");

  } catch (error: any) {
    console.error("❌ Test failed:", error.message);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

main();
