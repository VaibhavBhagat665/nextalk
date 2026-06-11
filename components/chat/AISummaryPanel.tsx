"use client";
import { useState, useEffect, useRef } from "react";
import {
  Sparkles,
  RefreshCw,
  CheckSquare,
  Square,
  Loader2,
  X,
  Clock,
  MessageSquareText,
  TrendingUp,
  Brain,
} from "lucide-react";

interface SummaryEntry {
  summary: string;
  actionItems: string[];
  keyTopics: string[];
  timestamp: string;
  messageCount: number;
}

export default function AISummaryPanel({
  channelId,
  messageCount,
  embedded = false,
}: {
  channelId: string;
  messageCount: number;
  embedded?: boolean;
}) {
  const [open, setOpen] = useState(embedded);
  const [loading, setLoading] = useState(false);
  const [entries, setEntries] = useState<SummaryEntry[]>([]);
  const [lastSummarizedAt, setLastSummarizedAt] = useState<string | null>(null);
  const [lastMessageCount, setLastMessageCount] = useState(0);
  const prevChannelRef = useRef(channelId);
  const [checkedItems, setCheckedItems] = useState<Set<string>>(new Set());

  const toggleChecked = (key: string) => {
    setCheckedItems(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  useEffect(() => {
    if (prevChannelRef.current !== channelId) {
      setEntries([]);
      setLastSummarizedAt(null);
      setLastMessageCount(0);
      prevChannelRef.current = channelId;
    }
  }, [channelId]);

  const newMessagesSinceLastSummary = messageCount - lastMessageCount;

  const fetchSummary = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/ai/summary", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          channelId,
          forceRefresh: true,
          since: lastSummarizedAt,
        }),
      });
      const data = await res.json();
      const now = new Date().toISOString();

      const newEntry: SummaryEntry = {
        summary: data.summary,
        actionItems: data.actionItems || [],
        keyTopics: data.keyTopics || [],
        timestamp: now,
        messageCount: newMessagesSinceLastSummary > 0 ? newMessagesSinceLastSummary : messageCount,
      };

      setEntries((prev) => [newEntry, ...prev]);
      setLastSummarizedAt(now);
      setLastMessageCount(messageCount);
    } catch {
      const errorEntry: SummaryEntry = {
        summary: "Failed to generate summary. Please try again.",
        actionItems: [],
        keyTopics: [],
        timestamp: new Date().toISOString(),
        messageCount: 0,
      };
      setEntries((prev) => [errorEntry, ...prev]);
    } finally {
      setLoading(false);
    }
  };

  if (!embedded && !open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="absolute top-3.5 right-3.5 bg-[#1f1a10] border border-[#d4a23c]/20 text-[#d4a23c] p-2.5 rounded-xl cursor-pointer flex items-center gap-1.5 transition-all duration-300 hover:scale-110 hover:shadow-[0_0_15px_rgba(212,162,60,0.3)] hover:bg-[#d4a23c]/20 z-10"
      >
        <Sparkles size={18} />
        {newMessagesSinceLastSummary > 0 && entries.length > 0 && (
          <span className="bg-gradient-to-r from-[#d4a23c] to-[#fceb9e] text-[#1a1400] text-[11px] font-black min-w-[20px] h-[20px] rounded-full flex items-center justify-center px-1 leading-none">
            {newMessagesSinceLastSummary}
          </span>
        )}
      </button>
    );
  }

  const panelContent = (
    <>
      {!embedded && (
        <div className="flex items-center justify-between p-4 bg-black/40 backdrop-blur-md border-b border-white/5">
          <div className="flex items-center gap-2 font-bold text-amber-500">
            <Sparkles size={16} />
            <span className="tracking-wide">AI Co-Pilot</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={fetchSummary}
              disabled={loading}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-500/10 border border-amber-500/20 rounded-lg text-amber-500 text-xs font-semibold transition-all hover:bg-amber-500/20 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (
                <Loader2 size={14} className="animate-spin" />
              ) : (
                <RefreshCw size={14} />
              )}
              <span>
                {entries.length === 0
                  ? "Generate"
                  : newMessagesSinceLastSummary > 0
                    ? `Update (${newMessagesSinceLastSummary} new)`
                    : "Refresh"}
              </span>
            </button>
            <button onClick={() => setOpen(false)} className="p-1.5 text-zinc-400 hover:text-white transition-colors rounded-md hover:bg-white/10">
              <X size={16} />
            </button>
          </div>
        </div>
      )}

      {embedded && (
        <div className="flex flex-col gap-3 mb-4">
          <div className="flex items-center gap-2 font-bold text-amber-500">
            <Sparkles size={16} />
            <span className="tracking-wide text-sm">AI Co-Pilot</span>
          </div>
          <button
            onClick={fetchSummary}
            disabled={loading}
            className="flex items-center justify-center gap-1.5 w-full px-4 py-2 bg-amber-500/10 border border-amber-500/20 rounded-xl text-amber-500 text-xs font-semibold transition-all hover:bg-amber-500/20 hover:shadow-[0_0_12px_rgba(212,162,60,0.1)] disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? (
              <Loader2 size={14} className="animate-spin" />
            ) : (
              <RefreshCw size={14} />
            )}
            <span>
              {entries.length === 0
                ? "Generate Summary"
                : newMessagesSinceLastSummary > 0
                  ? `Update (${newMessagesSinceLastSummary} new)`
                  : "Refresh"}
            </span>
          </button>
        </div>
      )}

      <div className="h-[1px] w-full bg-gradient-to-r from-transparent via-amber-500/30 to-transparent flex-shrink-0" />

      <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-4">
        {loading && entries.length === 0 && (
          <div className="flex flex-col items-center justify-center gap-4 py-12 text-amber-500/70">
            <Loader2 size={28} className="animate-spin" />
            <p className="text-zinc-400 text-sm font-medium">Analyzing conversation...</p>
          </div>
        )}

        {!loading && entries.length === 0 && (
          <div className="flex flex-col items-center text-center gap-4 py-10 px-4 text-zinc-400">
            <div className="text-amber-500/40 p-4 bg-amber-500/5 rounded-full">
              <Brain size={40} />
            </div>
            <h4 className="text-white text-base font-bold">AI Co-Pilot Ready</h4>
            <p className="text-sm leading-relaxed">
              Click <strong className="text-white">Generate Summary</strong> to analyze this conversation. AI will extract key topics, action items, and provide a concise summary.
            </p>
            <p className="text-xs text-zinc-500 mt-2">Understands text, context, and more.</p>
          </div>
        )}

        {loading && entries.length > 0 && (
          <div className="flex items-center gap-2.5 p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl text-xs font-medium text-amber-500 animate-pulse">
            <Loader2 size={14} className="animate-spin" />
            <span>Analyzing new messages...</span>
          </div>
        )}

        {entries.map((entry, i) => (
          <div key={i} className={`p-4 rounded-2xl border transition-colors ${i === 0 ? 'bg-amber-500/5 border-amber-500/20' : 'bg-white/[0.02] border-white/5'}`}>
            <div className="flex items-center gap-2 mb-4">
              <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${i === 0 ? 'bg-amber-500/20 text-amber-500' : 'bg-white/10 text-zinc-300'}`}>
                {i === 0 ? (
                  <><TrendingUp size={12} /> Latest</>
                ) : (
                  <><Clock size={12} /> Previous</>
                )}
              </div>
              <span className="text-xs text-zinc-500 font-medium">
                {new Date(entry.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
              </span>
              {entry.messageCount > 0 && (
                <span className="flex items-center gap-1 text-[10px] text-zinc-500 ml-auto font-medium">
                  <MessageSquareText size={12} /> {entry.messageCount} msgs
                </span>
              )}
            </div>

            <div className="mb-5">
              <p className="text-sm leading-relaxed text-zinc-300">{entry.summary}</p>
            </div>

            {entry.actionItems.length > 0 && (
              <div className="mb-5">
                <h4 className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-zinc-500 mb-3">
                  <CheckSquare size={14} /> Action Items
                </h4>
                <ul className="flex flex-col gap-2">
                  {entry.actionItems.map((item, j) => {
                    const key = `${i}-${j}`;
                    const checked = checkedItems.has(key);
                    return (
                      <li 
                        key={j} 
                        onClick={() => toggleChecked(key)}
                        className={`flex items-start gap-3 p-2.5 rounded-xl cursor-pointer transition-all border ${checked ? 'bg-emerald-500/5 border-emerald-500/20' : 'bg-black/20 border-white/5 hover:border-white/10 hover:bg-white/5'}`}
                      >
                        <div className="mt-0.5 flex-shrink-0 transition-colors">
                          {checked ? (
                            <CheckSquare size={16} className="text-emerald-500" />
                          ) : (
                            <Square size={16} className="text-zinc-500" />
                          )}
                        </div>
                        <span className={`text-sm leading-snug transition-all ${checked ? 'line-through text-zinc-500' : 'text-zinc-300'}`}>
                          {item}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}

            {entry.keyTopics.length > 0 && (
              <div>
                <h4 className="text-[11px] font-bold uppercase tracking-wider text-zinc-500 mb-3">
                  Key Topics
                </h4>
                <div className="flex flex-wrap gap-2">
                  {entry.keyTopics.map((t, j) => {
                    // Cyclic colors for topics
                    const colors = [
                      "bg-amber-500/10 border-amber-500/20 text-amber-500",
                      "bg-cyan-500/10 border-cyan-500/20 text-cyan-400",
                      "bg-emerald-500/10 border-emerald-500/20 text-emerald-400",
                      "bg-purple-500/10 border-purple-500/20 text-purple-400",
                      "bg-rose-500/10 border-rose-500/20 text-rose-400",
                    ];
                    const colorClass = colors[j % colors.length];
                    return (
                      <span key={j} className={`px-3 py-1.5 rounded-full border text-xs font-semibold transition-transform hover:scale-105 cursor-default ${colorClass}`}>
                        {t}
                      </span>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </>
  );

  if (embedded) {
    return (
      <div className="flex flex-col h-full bg-transparent">
        {panelContent}
      </div>
    );
  }

  return (
    <div className="absolute top-0 right-0 bottom-0 w-full md:w-[380px] flex flex-col bg-[#111111]/95 backdrop-blur-xl border-l border-white/10 shadow-2xl z-50 animate-in slide-in-from-right">
      {panelContent}
    </div>
  );
}
