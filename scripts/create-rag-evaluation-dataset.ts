/**
 * Create RAG Evaluation Dataset
 * 
 * Task 32.1: Create evaluation dataset
 * Requirements: 4.10
 * 
 * Generates 20-30 labeled queries with ground truth relevant messages
 * for measuring Recall@5 and MRR of semantic search.
 * 
 * Usage: npx tsx scripts/create-rag-evaluation-dataset.ts
 */

import { PrismaClient } from "@prisma/client";
import * as fs from "fs";
import * as path from "path";

const prisma = new PrismaClient();

/**
 * Evaluation Query with human-labeled relevant messages
 */
export interface EvaluationQuery {
  id: number;
  query: string;
  description: string;
  channelId?: string;
  relevantMessageIds: string[];
  category: "exact-match" | "semantic" | "technical" | "conversational" | "temporal";
}

/**
 * Generate evaluation dataset based on actual messages in database
 */
async function generateEvaluationDataset(): Promise<EvaluationQuery[]> {
  console.log("📊 Generating RAG Evaluation Dataset...\n");

  // Sample messages from database to create realistic queries
  const sampleMessages = await prisma.message.findMany({
    where: {
      embedding: { not: null },
      isDeleted: false,
    },
    take: 200,
    include: {
      user: true,
    },
    orderBy: {
      createdAt: "desc",
    },
  });

  if (sampleMessages.length === 0) {
    console.error("❌ No embedded messages found. Run embedding backfill first.");
    console.error("   npx tsx scripts/backfill-embeddings.ts");
    process.exit(1);
  }

  console.log(`✅ Found ${sampleMessages.length} embedded messages to sample from`);

  // Group messages by channel
  const messagesByChannel = new Map<string, typeof sampleMessages>();
  for (const msg of sampleMessages) {
    if (!messagesByChannel.has(msg.channelId)) {
      messagesByChannel.set(msg.channelId, []);
    }
    messagesByChannel.get(msg.channelId)!.push(msg);
  }

  const channels = Array.from(messagesByChannel.keys());
  console.log(`✅ Messages span ${channels.length} channels`);
  console.log();

  const queries: EvaluationQuery[] = [];
  let queryId = 1;

  // Category 1: Exact Match Queries (keyword-based)
  console.log("Generating Category 1: Exact Match Queries...");
  const exactMatchKeywords = [
    "hello",
    "project",
    "meeting",
    "help",
    "thanks",
    "question",
  ];

  for (const keyword of exactMatchKeywords.slice(0, 5)) {
    const relevantMessages = sampleMessages.filter((msg) =>
      msg.content.toLowerCase().includes(keyword.toLowerCase())
    );

    if (relevantMessages.length > 0) {
      queries.push({
        id: queryId++,
        query: keyword,
        description: `Exact keyword match for "${keyword}"`,
        channelId: relevantMessages[0].channelId,
        relevantMessageIds: relevantMessages.slice(0, 10).map((m) => m.id),
        category: "exact-match",
      });
    }
  }

  // Category 2: Semantic Queries (concepts, not exact words)
  console.log("Generating Category 2: Semantic Queries...");
  const semanticQueries = [
    {
      query: "How do I get started?",
      keywords: ["start", "begin", "new", "first", "init"],
    },
    {
      query: "What are the next steps?",
      keywords: ["next", "step", "after", "then", "follow"],
    },
    {
      query: "Can someone assist me?",
      keywords: ["help", "assist", "support", "question"],
    },
    {
      query: "When is the deadline?",
      keywords: ["deadline", "due", "when", "date", "time"],
    },
    {
      query: "Who is responsible for this?",
      keywords: ["who", "responsible", "owner", "assign"],
    },
  ];

  for (const { query, keywords } of semanticQueries) {
    const relevantMessages = sampleMessages.filter((msg) =>
      keywords.some((kw) => msg.content.toLowerCase().includes(kw.toLowerCase()))
    );

    if (relevantMessages.length > 0) {
      queries.push({
        id: queryId++,
        query,
        description: `Semantic query testing concept understanding`,
        channelId: relevantMessages[0].channelId,
        relevantMessageIds: relevantMessages.slice(0, 10).map((m) => m.id),
        category: "semantic",
      });
    }
  }

  // Category 3: Technical Queries
  console.log("Generating Category 3: Technical Queries...");
  const technicalQueries = [
    {
      query: "database error issues",
      keywords: ["database", "db", "error", "fail", "issue"],
    },
    {
      query: "API endpoint configuration",
      keywords: ["api", "endpoint", "config", "route", "server"],
    },
    {
      query: "authentication setup",
      keywords: ["auth", "login", "user", "password", "token"],
    },
    {
      query: "testing and deployment",
      keywords: ["test", "deploy", "build", "ci", "prod"],
    },
  ];

  for (const { query, keywords } of technicalQueries) {
    const relevantMessages = sampleMessages.filter((msg) =>
      keywords.some((kw) => msg.content.toLowerCase().includes(kw.toLowerCase()))
    );

    if (relevantMessages.length > 0) {
      queries.push({
        id: queryId++,
        query,
        description: `Technical domain query`,
        channelId: relevantMessages[0].channelId,
        relevantMessageIds: relevantMessages.slice(0, 10).map((m) => m.id),
        category: "technical",
      });
    }
  }

  // Category 4: Conversational Queries
  console.log("Generating Category 4: Conversational Queries...");
  const conversationalQueries = [
    {
      query: "What did we discuss yesterday?",
      keywords: ["discuss", "talk", "said", "mention"],
    },
    {
      query: "What was the decision?",
      keywords: ["decision", "decide", "agree", "conclusion"],
    },
    {
      query: "Can you explain that again?",
      keywords: ["explain", "clarify", "what", "how", "why"],
    },
  ];

  for (const { query, keywords } of conversationalQueries) {
    const relevantMessages = sampleMessages.filter((msg) =>
      keywords.some((kw) => msg.content.toLowerCase().includes(kw.toLowerCase()))
    );

    if (relevantMessages.length > 0) {
      queries.push({
        id: queryId++,
        query,
        description: `Conversational natural language query`,
        channelId: relevantMessages[0].channelId,
        relevantMessageIds: relevantMessages.slice(0, 10).map((m) => m.id),
        category: "conversational",
      });
    }
  }

  // Category 5: Temporal Queries
  console.log("Generating Category 5: Temporal Queries...");
  
  // Get messages from last 24 hours
  const recent = sampleMessages.filter(
    (msg) => Date.now() - msg.createdAt.getTime() < 24 * 3600000
  );
  if (recent.length > 0) {
    queries.push({
      id: queryId++,
      query: "recent updates",
      description: "Find recent messages from last 24 hours",
      channelId: recent[0].channelId,
      relevantMessageIds: recent.slice(0, 10).map((m) => m.id),
      category: "temporal",
    });
  }

  // Get messages from specific users (if available)
  const userMessages = new Map<string, typeof sampleMessages>();
  for (const msg of sampleMessages) {
    if (!userMessages.has(msg.userId)) {
      userMessages.set(msg.userId, []);
    }
    userMessages.get(msg.userId)!.push(msg);
  }

  // Find a user with several messages
  for (const [userId, messages] of userMessages.entries()) {
    if (messages.length >= 5) {
      const user = messages[0].user;
      queries.push({
        id: queryId++,
        query: `messages from ${user.username}`,
        description: `Find messages from specific user`,
        channelId: messages[0].channelId,
        relevantMessageIds: messages.slice(0, 10).map((m) => m.id),
        category: "temporal",
      });
      break;
    }
  }

  console.log();
  console.log(`✅ Generated ${queries.length} evaluation queries`);
  console.log();

  // Print summary by category
  const categoryCounts = queries.reduce((acc, q) => {
    acc[q.category] = (acc[q.category] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  console.log("📊 Queries by Category:");
  for (const [category, count] of Object.entries(categoryCounts)) {
    console.log(`   - ${category}: ${count} queries`);
  }
  console.log();

  return queries;
}

/**
 * Save evaluation dataset to JSON file
 */
async function saveDataset(queries: EvaluationQuery[]): Promise<void> {
  const outputDir = path.join(process.cwd(), "benchmarks");
  const outputFile = path.join(outputDir, "rag-evaluation-dataset.json");

  // Ensure benchmarks directory exists
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  // Save dataset
  fs.writeFileSync(
    outputFile,
    JSON.stringify(
      {
        version: "1.0.0",
        createdAt: new Date().toISOString(),
        totalQueries: queries.length,
        queries: queries,
      },
      null,
      2
    )
  );

  console.log(`✅ Saved evaluation dataset to: ${outputFile}`);
  console.log();
}

/**
 * Display sample queries for review
 */
function displaySamples(queries: EvaluationQuery[]): void {
  console.log("📝 Sample Queries:\n");

  // Show 3 samples from each category
  const categorySamples = new Map<string, EvaluationQuery[]>();
  for (const query of queries) {
    if (!categorySamples.has(query.category)) {
      categorySamples.set(query.category, []);
    }
    const samples = categorySamples.get(query.category)!;
    if (samples.length < 3) {
      samples.push(query);
    }
  }

  for (const [category, samples] of categorySamples.entries()) {
    console.log(`${category}:`.toUpperCase());
    for (const query of samples) {
      console.log(`   ${query.id}. "${query.query}"`);
      console.log(`      Relevant messages: ${query.relevantMessageIds.length}`);
      console.log(`      Description: ${query.description}`);
      console.log();
    }
  }
}

async function main() {
  try {
    // Generate evaluation dataset
    const queries = await generateEvaluationDataset();

    // Ensure we have at least 20 queries
    if (queries.length < 20) {
      console.warn(`⚠️  Only generated ${queries.length} queries (target: 20-30)`);
      console.warn("   This may be due to limited messages in the database.");
      console.warn("   Run seed-messages script to add more test data.");
    }

    // Save dataset
    await saveDataset(queries);

    // Display samples
    displaySamples(queries);

    console.log("✅ Evaluation dataset creation complete!");
    console.log();
    console.log("Next steps:");
    console.log("   1. Review benchmarks/rag-evaluation-dataset.json");
    console.log("   2. Manually verify relevant message labels");
    console.log("   3. Run: npx tsx scripts/measure-rag-performance.ts");

  } catch (error: any) {
    console.error("❌ Failed to create evaluation dataset:", error.message);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

main();
