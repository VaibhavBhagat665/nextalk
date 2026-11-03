import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { summarizeThread } from "@/lib/ai";
import { z } from "zod";

// Vercel function timeout (extend for Pro plan)
export const maxDuration = 30;

// Request validation schema
const requestSchema = z.object({
  channelId: z.string().min(1, "channelId is required"),
  forceRefresh: z.boolean().optional(),
  since: z.string().datetime().optional(),
});

// Error codes for client handling
enum AIErrorCode {
  UNAUTHORIZED = "UNAUTHORIZED",
  USER_NOT_FOUND = "USER_NOT_FOUND",
  INVALID_REQUEST = "INVALID_REQUEST",
  NOT_MEMBER = "NOT_MEMBER",
  AI_NOT_CONFIGURED = "AI_NOT_CONFIGURED",
  GROQ_RATE_LIMIT = "GROQ_RATE_LIMIT",
  GROQ_ERROR = "GROQ_ERROR",
  TIMEOUT = "TIMEOUT",
  UNKNOWN_ERROR = "UNKNOWN_ERROR",
}

interface ErrorResponse {
  ok: false;
  error: {
    code: AIErrorCode;
    message: string;
    retryable: boolean;
  };
}

interface SuccessResponse {
  ok: true;
  summary: string;
  actionItems: string[];
  keyTopics: string[];
  cached: boolean;
  summarizedAt: string;
  messageCount?: number;
}

// POST /api/ai/summary — generate thread summary (supports incremental via `since`)
export async function POST(req: Request): Promise<NextResponse<SuccessResponse | ErrorResponse>> {
  try {
    // 1. Authentication
    const { userId: clerkId } = await auth();
    if (!clerkId) {
      return NextResponse.json<ErrorResponse>(
        {
          ok: false,
          error: {
            code: AIErrorCode.UNAUTHORIZED,
            message: "You must be signed in to use AI features",
            retryable: false,
          },
        },
        { status: 401 }
      );
    }

    const user = await prisma.user.findUnique({ where: { clerkId } });
    if (!user) {
      return NextResponse.json<ErrorResponse>(
        {
          ok: false,
          error: {
            code: AIErrorCode.USER_NOT_FOUND,
            message: "User account not found",
            retryable: false,
          },
        },
        { status: 404 }
      );
    }

    // 2. Validate request body
    const body = await req.json();
    const validation = requestSchema.safeParse(body);
    
    if (!validation.success) {
      return NextResponse.json<ErrorResponse>(
        {
          ok: false,
          error: {
            code: AIErrorCode.INVALID_REQUEST,
            message: validation.error.issues[0]?.message || "Invalid request",
            retryable: false,
          },
        },
        { status: 400 }
      );
    }

    const { channelId, forceRefresh, since } = validation.data;

    // 3. Check AI configuration
    if (!process.env.GROQ_API_KEY) {
      return NextResponse.json<ErrorResponse>(
        {
          ok: false,
          error: {
            code: AIErrorCode.AI_NOT_CONFIGURED,
            message: "AI features are not configured. Please contact support.",
            retryable: false,
          },
        },
        { status: 503 }
      );
    }

    // 4. Verify membership (check both Membership for DMs and ServerMember for server channels)
    const membership = await prisma.membership.findUnique({
      where: { userId_channelId: { userId: user.id, channelId } },
      include: {
        channel: {
          select: {
            isDM: true,
            encrypted: true,
            serverId: true,
          },
        },
      },
    });

    if (!membership) {
      // If no direct membership, check if user is a server member
      const channel = await prisma.channel.findUnique({
        where: { id: channelId },
        select: { serverId: true },
      });

      if (channel?.serverId) {
        const serverMember = await prisma.serverMember.findUnique({
          where: {
            userId_serverId: {
              userId: user.id,
              serverId: channel.serverId,
            },
          },
        });

        if (!serverMember) {
          return NextResponse.json<ErrorResponse>(
            {
              ok: false,
              error: {
                code: AIErrorCode.NOT_MEMBER,
                message: "You don't have access to this channel",
                retryable: false,
              },
            },
            { status: 403 }
          );
        }
      } else {
        return NextResponse.json<ErrorResponse>(
          {
            ok: false,
            error: {
              code: AIErrorCode.NOT_MEMBER,
              message: "You don't have access to this channel",
              retryable: false,
            },
          },
          { status: 403 }
        );
      }
    }

    // 5. Block AI for encrypted DMs
    if (membership?.channel.encrypted) {
      return NextResponse.json<ErrorResponse>(
        {
          ok: false,
          error: {
            code: AIErrorCode.INVALID_REQUEST,
            message: "AI cannot summarize end-to-end encrypted messages for privacy reasons",
            retryable: false,
          },
        },
        { status: 400 }
      );
    }

    // 6. Try cache if not force-refreshing and no `since` param
    if (!forceRefresh && !since) {
      const cached = await prisma.aISummary.findFirst({
        where: {
          channelId,
          expiresAt: { gt: new Date() },
        },
        orderBy: { createdAt: "desc" },
      });

      if (cached) {
        return NextResponse.json<SuccessResponse>({
          ok: true,
          summary: cached.summary,
          actionItems: cached.actionItems,
          keyTopics: [],
          cached: true,
          summarizedAt: cached.createdAt.toISOString(),
        });
      }
    }

    // 7. Build message query — if `since` is provided, only get messages after that timestamp
    const whereClause: any = { channelId, isDeleted: false, encrypted: false };
    if (since) {
      whereClause.createdAt = { gt: new Date(since) };
    }

    const messages = await prisma.message.findMany({
      where: whereClause,
      take: 100, // Increased from 50 for better context
      orderBy: { createdAt: "desc" },
      include: {
        user: { select: { username: true } },
      },
    });

    // 8. Handle empty message case
    if (messages.length === 0) {
      return NextResponse.json<SuccessResponse>({
        ok: true,
        summary: since
          ? "No new messages since the last summary."
          : "No messages in this channel yet. Start a conversation to generate a summary!",
        actionItems: [],
        keyTopics: [],
        cached: false,
        summarizedAt: new Date().toISOString(),
        messageCount: 0,
      });
    }

    // 9. Call AI with timeout and retry
    const result = await withTimeout(
      async () => {
        try {
          return await summarizeThread(
            messages.reverse().map((m) => ({
              username: m.user.username,
              content: m.content,
              createdAt: m.createdAt,
              fileUrl: m.fileUrl,
              fileName: m.fileName,
              fileType: m.fileType,
            }))
          );
        } catch (err: any) {
          // Map Groq-specific errors
          if (err.status === 429 || err.message?.includes("rate limit")) {
            throw new GroqRateLimitError("Rate limit exceeded. Please try again in a moment.");
          }
          throw err;
        }
      },
      25000 // 25s timeout (leave 5s buffer for response)
    );

    // 10. Cache the summary
    await prisma.aISummary.create({
      data: {
        channelId,
        userId: user.id,
        summary: result.summary,
        actionItems: result.actionItems,
        expiresAt: new Date(Date.now() + 60 * 60 * 1000), // 1 hour
      },
    });

    return NextResponse.json<SuccessResponse>({
      ok: true,
      ...result,
      cached: false,
      summarizedAt: new Date().toISOString(),
      messageCount: messages.length,
    });
  } catch (err: any) {
    console.error("[AI Summary Error]", err);

    // Handle specific error types
    if (err instanceof GroqRateLimitError) {
      return NextResponse.json<ErrorResponse>(
        {
          ok: false,
          error: {
            code: AIErrorCode.GROQ_RATE_LIMIT,
            message: err.message,
            retryable: true,
          },
        },
        { status: 429 }
      );
    }

    if (err instanceof TimeoutError) {
      return NextResponse.json<ErrorResponse>(
        {
          ok: false,
          error: {
            code: AIErrorCode.TIMEOUT,
            message: "AI request took too long. Please try again with fewer messages.",
            retryable: true,
          },
        },
        { status: 504 }
      );
    }

    if (err.status === 401 || err.message?.includes("authentication")) {
      return NextResponse.json<ErrorResponse>(
        {
          ok: false,
          error: {
            code: AIErrorCode.AI_NOT_CONFIGURED,
            message: "AI service authentication failed. Please contact support.",
            retryable: false,
          },
        },
        { status: 503 }
      );
    }

    // Generic error
    return NextResponse.json<ErrorResponse>(
      {
        ok: false,
        error: {
          code: AIErrorCode.UNKNOWN_ERROR,
          message: "An unexpected error occurred. Please try again.",
          retryable: true,
        },
      },
      { status: 500 }
    );
  }
}

// Utility: Timeout wrapper
class TimeoutError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TimeoutError";
  }
}

class GroqRateLimitError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "GroqRateLimitError";
  }
}

async function withTimeout<T>(promise: () => Promise<T>, ms: number): Promise<T> {
  let timeoutHandle: NodeJS.Timeout;
  
  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutHandle = setTimeout(() => {
      reject(new TimeoutError(`Operation timed out after ${ms}ms`));
    }, ms);
  });

  try {
    return await Promise.race([promise(), timeoutPromise]);
  } finally {
    clearTimeout(timeoutHandle!);
  }
}
