import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { semanticSearch, hybridSearch } from "@/lib/semantic-search";

export async function GET(req: Request) {
  const { userId: clerkId } = await auth();
  if (!clerkId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const query = searchParams.get("q");
  const channelId = searchParams.get("channelId") || undefined;
  const limit = parseInt(searchParams.get("limit") || "10");
  const mode = searchParams.get("mode") || "hybrid"; // "semantic" | "hybrid"

  if (!query) {
    return NextResponse.json({ error: "Query parameter 'q' is required" }, { status: 400 });
  }

  try {
    const results = mode === "hybrid"
      ? await hybridSearch(query, channelId, limit)
      : await semanticSearch({ query, channelId, limit });

    return NextResponse.json({ results, query, mode });
  } catch (error: any) {
    console.error("Search failed:", error);
    return NextResponse.json({ error: "Search failed" }, { status: 500 });
  }
}
