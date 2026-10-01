/**
 * AI Query API with RAG Context Retrieval
 * 
 * Task 29.1: Implement context retrieval for AI
 * Task 30.2: Implement AI response cache
 * Requirements: 4.6, 4.8
 * Validates: Property 11 - RAG Context Retrieval
 * Validates: Property 12 - AI Response Caching
 * 
 * This endpoint answers user questions about chat history using
 * Retrieval Augmented Generation (RAG) with semantic search.
 * 
 * Responses are cached for 24 hours to reduce API costs.
 */

import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { retrieveContext } from "@/lib/semantic-search";
import { getCachedAIResponse, cacheAIResponse } from "@/lib/ai-cache";
import Groq from "groq-sdk";

let _groq: Groq | null = null;
function getGroq() {
  if (!_groq) {
    _groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
  }
  return _groq;
}

/**
 * POST /api/ai/query
 * 
 * Answer questions about chat history using RAG
 * 
 * Request body:
 * - query: string (required) - The question to answer
 * - channelId: string (required) - The channel to search in
 * - topK: number (optional) - Number of relevant messages to retrieve (default: 5)
 * 
 * Response:
 * - answer: string - The AI-generated answer
 * - context: string - The retrieved context used
 * - sources: number - Number of relevant messages found
 */
export async function POST(req: Request) {
  const { userId: clerkId } = await auth();
  if (!clerkId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = await prisma.user.findUnique({ where: { clerkId } });
  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const { query, channelId, topK = 5 } = await req.json();
  
  if (!query) {
    return NextResponse.json({ error: "query is required" }, { status: 400 });
  }
  
  if (!channelId) {
    return NextResponse.json({ error: "channelId is required" }, { status: 400 });
  }

  // Verify membership
  const membership = await prisma.membership.findUnique({
    where: { userId_channelId: { userId: user.id, channelId } },
  });
  
  if (!membership) {
    return NextResponse.json({ 
      error: "Not a member of this channel" 
    }, { status: 403 });
  }

  try {
    console.log(`🤖 RAG Query: "${query}" in channel ${channelId}`);
    
    // Step 0: Check cache first
    const cachedResponse = await getCachedAIResponse(query, channelId, topK);
    
    if (cachedResponse) {
      console.log(`📦 Returning cached AI response from ${cachedResponse.cachedAt}`);
      return NextResponse.json({
        ...cachedResponse,
        cached: true,
      });
    }
    
    // Step 1: Retrieve relevant context using semantic search
    const context = await retrieveContext(query, channelId, topK);
    
    // Check if any relevant context was found
    if (context === "No relevant context found." || context === "Error retrieving context.") {
      const response = {
        answer: "I couldn't find any relevant messages in this channel to answer your question. Try asking about something that has been discussed here.",
        context: "",
        sources: 0,
        timestamp: new Date().toISOString(),
      };
      
      // Cache the "no results" response as well to avoid repeated processing
      await cacheAIResponse(query, channelId, response, topK);
      
      return NextResponse.json({
        ...response,
        cached: false,
      });
    }

    // Count number of source messages
    const sourceCount = context.split('\n\n').length;
    
    console.log(`📚 Retrieved ${sourceCount} relevant messages`);

    // Step 2: Generate answer using LLM with retrieved context
    const completion = await getGroq().chat.completions.create({
      model: "llama-3.1-8b-instant",
      messages: [
        {
          role: "system",
          content: `You are a helpful AI assistant that answers questions about chat conversations.
You will be provided with relevant messages from the chat history as context.
Use this context to answer the user's question accurately and concisely.

Rules:
- Only use information from the provided context
- If the context doesn't contain enough information to answer, say so
- Keep your answer concise but complete (2-4 sentences)
- Reference specific users or details from the context when relevant
- If multiple viewpoints exist in the context, acknowledge them`,
        },
        {
          role: "user",
          content: `Context (relevant messages):\n\n${context}\n\nQuestion: ${query}`,
        },
      ],
      temperature: 0.3,
      max_tokens: 300,
    });

    const answer = completion.choices[0]?.message?.content || "Unable to generate answer.";
    
    console.log(`✅ Generated answer: ${answer.substring(0, 100)}...`);

    const response = {
      answer,
      context,
      sources: sourceCount,
      timestamp: new Date().toISOString(),
    };
    
    // Step 3: Cache the response for future identical queries
    await cacheAIResponse(query, channelId, response, topK);

    return NextResponse.json({
      ...response,
      cached: false,
    });

  } catch (error: any) {
    console.error("❌ RAG query failed:", error.message);
    
    return NextResponse.json({
      error: "Failed to process query",
      details: error.message,
    }, { status: 500 });
  }
}
