/**
 * Measure RAG Performance
 * 
 * Task 32.2: Measure retrieval quality
 * Requirements: 4.10
 * 
 * Calculates Recall@5, MRR (Mean Reciprocal Rank), and query latency
 * for semantic search, keyword search, and hybrid search methods.
 * 
 * Usage: npx tsx scripts/measure-rag-performance.ts
 */

import { PrismaClient } from "@prisma/client";
import * as fs from "fs";
import * as path from "path";
import { semanticSearch, keywordSearch, hybridSearch } from "../lib/semantic-search";
import type { EvaluationQuery } from "./create-rag-evaluation-dataset";

const prisma = new PrismaClient();

/**
 * Performance metrics for a single query
 */
interface QueryMetrics {
  queryId: number;
  query: string;
  method: "semantic" | "keyword" | "hybrid";
  latencyMs: number;
  retrieved: string[];
  relevant: string[];
  recall: number;
  reciprocalRank: number;
  hits: number;
}

/**
 * Aggregated performance metrics
 */
interface AggregatedMetrics {
  method: "semantic" | "keyword" | "hybrid";
  totalQueries: number;
  avgLatencyMs: number;
  p50LatencyMs: number;
  p95LatencyMs: number;
  p99LatencyMs: number;
  recallAt5: number;
  meanReciprocalRank: number;
  queriesWithHits: number;
  hitRate: number;
}

/**
 * Calculate Recall@K
 * 
 * Recall@K = (# of relevant items in top K) / (total # of relevant items)
 */
function calculateRecall(retrieved: string[], relevant: string[], k: number): number {
  const topK = retrieved.slice(0, k);
  const relevantInTopK = topK.filter((id) => relevant.includes(id)).length;
  return relevant.length > 0 ? relevantInTopK / relevant.length : 0;
}

/**
 * Calculate Reciprocal Rank
 * 
 * RR = 1 / (rank of first relevant item)
 * Returns 0 if no relevant items found
 */
function calculateReciprocalRank(retrieved: string[], relevant: string[]): number {
  for (let i = 0; i < retrieved.length; i++) {
    if (relevant.includes(retrieved[i])) {
      return 1 / (i + 1);
    }
  }
  return 0; // No relevant items found
}

/**
 * Load evaluation dataset
 */
function loadEvaluationDataset(): EvaluationQuery[] {
  const datasetPath = path.join(process.cwd(), "benchmarks", "rag-evaluation-dataset.json");

  if (!fs.existsSync(datasetPath)) {
    console.error("❌ Evaluation dataset not found!");
    console.error("   Run: npx tsx scripts/create-rag-evaluation-dataset.ts");
    process.exit(1);
  }

  const data = JSON.parse(fs.readFileSync(datasetPath, "utf-8"));
  console.log(`✅ Loaded ${data.totalQueries} queries from evaluation dataset`);
  console.log(`   Created: ${new Date(data.createdAt).toLocaleString()}\n`);

  return data.queries;
}

/**
 * Measure performance for a single query using semantic search
 */
async function measureSemanticSearch(
  query: EvaluationQuery,
  k: number = 5
): Promise<QueryMetrics> {
  const startTime = Date.now();

  const results = await semanticSearch({
    query: query.query,
    channelId: query.channelId,
    limit: 10, // Retrieve more than k to calculate Recall@10 if needed
    similarityThreshold: 0.7,
  });

  const latencyMs = Date.now() - startTime;

  const retrievedIds = results.map((r) => r.id);
  const recall = calculateRecall(retrievedIds, query.relevantMessageIds, k);
  const reciprocalRank = calculateReciprocalRank(retrievedIds, query.relevantMessageIds);
  const hits = results.filter((r) => query.relevantMessageIds.includes(r.id)).length;

  return {
    queryId: query.id,
    query: query.query,
    method: "semantic",
    latencyMs,
    retrieved: retrievedIds,
    relevant: query.relevantMessageIds,
    recall,
    reciprocalRank,
    hits,
  };
}

/**
 * Measure performance for a single query using keyword search
 */
async function measureKeywordSearch(
  query: EvaluationQuery,
  k: number = 5
): Promise<QueryMetrics> {
  const startTime = Date.now();

  const results = await keywordSearch(query.query, query.channelId, 10);

  const latencyMs = Date.now() - startTime;

  const retrievedIds = results.map((r) => r.id);
  const recall = calculateRecall(retrievedIds, query.relevantMessageIds, k);
  const reciprocalRank = calculateReciprocalRank(retrievedIds, query.relevantMessageIds);
  const hits = results.filter((r) => query.relevantMessageIds.includes(r.id)).length;

  return {
    queryId: query.id,
    query: query.query,
    method: "keyword",
    latencyMs,
    retrieved: retrievedIds,
    relevant: query.relevantMessageIds,
    recall,
    reciprocalRank,
    hits,
  };
}

/**
 * Measure performance for a single query using hybrid search
 */
async function measureHybridSearch(
  query: EvaluationQuery,
  k: number = 5
): Promise<QueryMetrics> {
  const startTime = Date.now();

  const results = await hybridSearch(query.query, query.channelId, 10);

  const latencyMs = Date.now() - startTime;

  const retrievedIds = results.map((r) => r.id);
  const recall = calculateRecall(retrievedIds, query.relevantMessageIds, k);
  const reciprocalRank = calculateReciprocalRank(retrievedIds, query.relevantMessageIds);
  const hits = results.filter((r) => query.relevantMessageIds.includes(r.id)).length;

  return {
    queryId: query.id,
    query: query.query,
    method: "hybrid",
    latencyMs,
    retrieved: retrievedIds,
    relevant: query.relevantMessageIds,
    recall,
    reciprocalRank,
    hits,
  };
}

/**
 * Calculate percentile from sorted array
 */
function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  const index = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[Math.max(0, index)];
}

/**
 * Aggregate metrics across all queries
 */
function aggregateMetrics(queryMetrics: QueryMetrics[]): AggregatedMetrics {
  const method = queryMetrics[0]?.method || "unknown";
  const totalQueries = queryMetrics.length;

  // Latency metrics
  const latencies = queryMetrics.map((m) => m.latencyMs).sort((a, b) => a - b);
  const avgLatencyMs = latencies.reduce((sum, l) => sum + l, 0) / totalQueries;
  const p50LatencyMs = percentile(latencies, 50);
  const p95LatencyMs = percentile(latencies, 95);
  const p99LatencyMs = percentile(latencies, 99);

  // Quality metrics
  const recalls = queryMetrics.map((m) => m.recall);
  const reciprocalRanks = queryMetrics.map((m) => m.reciprocalRank);

  const recallAt5 = recalls.reduce((sum, r) => sum + r, 0) / totalQueries;
  const meanReciprocalRank = reciprocalRanks.reduce((sum, rr) => sum + rr, 0) / totalQueries;

  const queriesWithHits = queryMetrics.filter((m) => m.hits > 0).length;
  const hitRate = queriesWithHits / totalQueries;

  return {
    method: method as any,
    totalQueries,
    avgLatencyMs: Math.round(avgLatencyMs * 100) / 100,
    p50LatencyMs: Math.round(p50LatencyMs),
    p95LatencyMs: Math.round(p95LatencyMs),
    p99LatencyMs: Math.round(p99LatencyMs),
    recallAt5: Math.round(recallAt5 * 1000) / 10, // Convert to percentage with 1 decimal
    meanReciprocalRank: Math.round(meanReciprocalRank * 1000) / 1000, // 3 decimal places
    queriesWithHits,
    hitRate: Math.round(hitRate * 1000) / 10, // Convert to percentage with 1 decimal
  };
}

/**
 * Display results in table format
 */
function displayResults(allMetrics: AggregatedMetrics[]): void {
  console.log("\n📊 RAG PERFORMANCE RESULTS\n");
  console.log("=" .repeat(90));
  console.log();

  // Recall@5 and MRR table
  console.log("Quality Metrics:");
  console.log("-".repeat(90));
  console.log(
    "Method".padEnd(15) +
      "Recall@5".padEnd(15) +
      "MRR".padEnd(15) +
      "Hit Rate".padEnd(15) +
      "Queries w/ Hits"
  );
  console.log("-".repeat(90));

  for (const metrics of allMetrics) {
    console.log(
      metrics.method.padEnd(15) +
        `${metrics.recallAt5}%`.padEnd(15) +
        metrics.meanReciprocalRank.toFixed(3).padEnd(15) +
        `${metrics.hitRate}%`.padEnd(15) +
        `${metrics.queriesWithHits}/${metrics.totalQueries}`
    );
  }
  console.log("=".repeat(90));
  console.log();

  // Latency table
  console.log("Latency Metrics (milliseconds):");
  console.log("-".repeat(90));
  console.log(
    "Method".padEnd(15) +
      "Avg".padEnd(15) +
      "p50".padEnd(15) +
      "p95".padEnd(15) +
      "p99"
  );
  console.log("-".repeat(90));

  for (const metrics of allMetrics) {
    console.log(
      metrics.method.padEnd(15) +
        `${metrics.avgLatencyMs}ms`.padEnd(15) +
        `${metrics.p50LatencyMs}ms`.padEnd(15) +
        `${metrics.p95LatencyMs}ms`.padEnd(15) +
        `${metrics.p99LatencyMs}ms`
    );
  }
  console.log("=".repeat(90));
  console.log();

  // Interpretation
  console.log("📝 Key Metrics Explained:");
  console.log();
  console.log("   Recall@5: Percentage of relevant messages found in top 5 results");
  console.log("   MRR: Mean Reciprocal Rank - average 1/rank of first relevant result");
  console.log("   Hit Rate: Percentage of queries that found at least 1 relevant message");
  console.log();
}

/**
 * Display detailed comparison
 */
function displayComparison(allMetrics: AggregatedMetrics[]): void {
  console.log("🔍 Method Comparison:\n");

  const semantic = allMetrics.find((m) => m.method === "semantic");
  const keyword = allMetrics.find((m) => m.method === "keyword");
  const hybrid = allMetrics.find((m) => m.method === "hybrid");

  if (semantic && keyword && hybrid) {
    console.log("Recall@5:");
    console.log(`   Semantic: ${semantic.recallAt5}%`);
    console.log(`   Keyword:  ${keyword.recallAt5}%`);
    console.log(`   Hybrid:   ${hybrid.recallAt5}% ${hybrid.recallAt5 >= Math.max(semantic.recallAt5, keyword.recallAt5) ? "✅ BEST" : ""}`);
    console.log();

    console.log("MRR (higher is better):");
    console.log(`   Semantic: ${semantic.meanReciprocalRank.toFixed(3)}`);
    console.log(`   Keyword:  ${keyword.meanReciprocalRank.toFixed(3)}`);
    console.log(`   Hybrid:   ${hybrid.meanReciprocalRank.toFixed(3)} ${hybrid.meanReciprocalRank >= Math.max(semantic.meanReciprocalRank, keyword.meanReciprocalRank) ? "✅ BEST" : ""}`);
    console.log();

    console.log("Latency (p95):");
    console.log(`   Semantic: ${semantic.p95LatencyMs}ms`);
    console.log(`   Keyword:  ${keyword.p95LatencyMs}ms`);
    console.log(`   Hybrid:   ${hybrid.p95LatencyMs}ms`);
    console.log();
  }
}

/**
 * Save results to JSON file
 */
function saveResults(
  allMetrics: AggregatedMetrics[],
  detailedResults: QueryMetrics[]
): void {
  const outputFile = path.join(process.cwd(), "benchmarks", "rag-performance-results.json");

  const data = {
    timestamp: new Date().toISOString(),
    summary: allMetrics,
    detailed: detailedResults,
  };

  fs.writeFileSync(outputFile, JSON.stringify(data, null, 2));
  console.log(`✅ Saved detailed results to: ${outputFile}\n`);
}

/**
 * Main function
 */
async function main() {
  console.log("🧪 Measuring RAG Performance\n");

  try {
    // Load evaluation dataset
    const queries = loadEvaluationDataset();

    if (queries.length === 0) {
      console.error("❌ No queries in evaluation dataset");
      process.exit(1);
    }

    // Measure each method
    const allMetrics: QueryMetrics[] = [];

    console.log("Measuring semantic search performance...");
    for (const query of queries) {
      const metrics = await measureSemanticSearch(query);
      allMetrics.push(metrics);
      process.stdout.write(".");
    }
    console.log(" ✅");

    console.log("Measuring keyword search performance...");
    for (const query of queries) {
      const metrics = await measureKeywordSearch(query);
      allMetrics.push(metrics);
      process.stdout.write(".");
    }
    console.log(" ✅");

    console.log("Measuring hybrid search performance...");
    for (const query of queries) {
      const metrics = await measureHybridSearch(query);
      allMetrics.push(metrics);
      process.stdout.write(".");
    }
    console.log(" ✅");

    // Aggregate by method
    const semanticMetrics = allMetrics.filter((m) => m.method === "semantic");
    const keywordMetrics = allMetrics.filter((m) => m.method === "keyword");
    const hybridMetrics = allMetrics.filter((m) => m.method === "hybrid");

    const aggregated = [
      aggregateMetrics(semanticMetrics),
      aggregateMetrics(keywordMetrics),
      aggregateMetrics(hybridMetrics),
    ];

    // Display results
    displayResults(aggregated);
    displayComparison(aggregated);

    // Save results
    saveResults(aggregated, allMetrics);

    console.log("✅ Performance measurement complete!");
    console.log();
    console.log("Next steps:");
    console.log("   1. Review benchmarks/rag-performance-results.json");
    console.log("   2. Run: npx tsx scripts/measure-rag-performance.ts (to test caching)");
    console.log("   3. Document results in benchmarks/rag.md");

  } catch (error: any) {
    console.error("❌ Performance measurement failed:", error.message);
    console.error(error.stack);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

main();
