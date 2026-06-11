import Groq from "groq-sdk";

let _groq: Groq | null = null;
function getGroq() {
  if (!_groq) {
    _groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
  }
  return _groq;
}

interface ThreadSummary {
  summary: string;
  actionItems: string[];
  keyTopics: string[];
}

export async function summarizeThread(
  messages: {
    username: string;
    content: string;
    createdAt: Date;
    fileUrl?: string | null;
    fileName?: string | null;
    fileType?: string | null;
  }[]
): Promise<ThreadSummary> {
  const formattedMessages = messages
    .map((m) => {
      let line = `[${m.createdAt.toLocaleTimeString()}] ${m.username}: ${m.content || "(no text)"}`;
      if (m.fileUrl) {
        const type = m.fileType || "file";
        const name = m.fileName || "unnamed";
        if (type.startsWith("image/")) {
          line += ` [Attached image: ${name}]`;
        } else if (type === "application/pdf") {
          line += ` [Attached PDF document: ${name}]`;
        } else if (type.includes("word") || type.includes("document")) {
          line += ` [Attached Word document: ${name}]`;
        } else if (type.includes("spreadsheet") || type.includes("excel") || type.includes("xlsx") || type.includes("xls")) {
          line += ` [Attached spreadsheet: ${name}]`;
        } else {
          line += ` [Attached file: ${name} (${type})]`;
        }
      }
      return line;
    })
    .join("\n");

  const completion = await getGroq().chat.completions.create({
    model: "llama-3.1-8b-instant",
    messages: [
      {
        role: "system",
        content: `You are a helpful assistant that summarizes chat conversations. 
Analyze the conversation and provide:
1. A concise summary (2-3 sentences). Even if there is only one message, provide a meaningful summary.
2. Action items mentioned (if any)
3. Key topics discussed
4. If any images, documents, or files were shared, mention them as notable attachments in the summary.

Respond in JSON format:
{
  "summary": "...",
  "actionItems": ["..."],
  "keyTopics": ["..."]
}`,
      },
      {
        role: "user",
        content: `Summarize this chat conversation:\n\n${formattedMessages}`,
      },
    ],
    temperature: 0.3,
    max_tokens: 500,
    response_format: { type: "json_object" },
  });

  const content = completion.choices[0]?.message?.content;
  if (!content) {
    return {
      summary: "Unable to generate summary.",
      actionItems: [],
      keyTopics: [],
    };
  }

  try {
    const parsed = JSON.parse(content);
    return {
      summary: parsed.summary || "No summary available.",
      actionItems: parsed.actionItems || [],
      keyTopics: parsed.keyTopics || [],
    };
  } catch {
    return {
      summary: content,
      actionItems: [],
      keyTopics: [],
    };
  }
}

export async function explainSimply(text: string): Promise<string> {
  const completion = await getGroq().chat.completions.create({
    model: "llama-3.1-8b-instant",
    messages: [
      {
        role: "system",
        content:
          "Explain the following in simple terms, as if explaining to someone new to the topic. Keep it brief (1-2 sentences).",
      },
      {
        role: "user",
        content: text,
      },
    ],
    temperature: 0.5,
    max_tokens: 150,
  });

  return (
    completion.choices[0]?.message?.content || "Unable to generate explanation."
  );
}
