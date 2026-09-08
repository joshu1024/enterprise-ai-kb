import { Response } from "express";
import prisma from "../config/prisma.js";
import { generateQueryEmbedding } from "./embedding.service.js";
import Grok from "groq-sdk"
const grok = new Grok({apiKey:process.env.GROQ_API_KEY as string})
interface RetrievedChunk{
    id:string,
    text:string,
    chunkIndex:number,
    documentId:string,
    documentTitle:string,
    similarity:number
}
interface Citation {
  index: number;
  documentId: string;
  documentTitle: string;
  excerpt: string;
  similarity: number;
}
export const similaritySearch = async (
  queryEmbedding: number[],
  organizationId: string,
  limit: number = 5,
  threshold: number = 0.1
): Promise<RetrievedChunk[]> => {
  const vectorString = `[${queryEmbedding.join(",")}]`;

  const results = await prisma.$queryRaw<RetrievedChunk[]>`
    SELECT
      dc.id,
      dc.text,
      dc."chunkIndex",
      dc."documentId",
      d.title AS "documentTitle",
      1 - (dc.embedding <=> ${vectorString}::vector) AS similarity
    FROM "DocumentChunk" dc
    JOIN "Document" d ON d.id = dc."documentId"
    WHERE
      d."organizationId" = ${organizationId}
      AND d.status = 'ready'
      AND 1 - (dc.embedding <=> ${vectorString}::vector) > ${threshold}
    ORDER BY dc.embedding <=> ${vectorString}::vector
    LIMIT ${limit}
  `;

  return results;
};
export const getCachedAnswer = async (
  query: string,
  organizationId: string,
  threshold: number = 0.92
): Promise<{ answer: string; citations: Citation[] } | null> => {
  const queryEmbedding = await generateQueryEmbedding(query);
  const vectorString = `[${queryEmbedding.join(",")}]`;

 const cached = await prisma.$queryRaw<{ answer: string; citations: string; similarity: number }[]
>`
  SELECT
    answer::text,
    citations::text,
    1 - (embedding <=> ${vectorString}::vector) AS similarity
  FROM "SemanticCache"
  WHERE
    "organizationId" = ${organizationId}
    AND 1 - (embedding <=> ${vectorString}::vector) > ${threshold}
  ORDER BY embedding <=> ${vectorString}::vector
  LIMIT 1
`;

if (cached.length > 0) {
 
  return {
    answer: cached[0].answer,
    citations: JSON.parse(cached[0].citations) as Citation[],
  };
}

  return null;
};
export const setCachedAnswer = async (
  query: string,
  answer: string,
  citations: Citation[],
  organizationId: string
): Promise<void> => {
  const embedding = await generateQueryEmbedding(query);
  const vectorString = `[${embedding.join(",")}]`;

  await prisma.$executeRaw`
    INSERT INTO "SemanticCache"
      ("id", "organizationId", "query", "answer", "citations", "embedding", "createdAt")
    VALUES (
      gen_random_uuid(),
      ${organizationId},
      ${query},
      ${answer},
      ${JSON.stringify(citations)}::jsonb,
      ${vectorString}::vector,
      NOW()
    )
  `;
};
const buildContext = (chunks: RetrievedChunk[]): string =>
  chunks
    .map(
      (c, i) =>
        `[Source ${i + 1}: ${c.documentTitle}, chunk ${c.chunkIndex}]\n${c.text}`
    )
    .join("\n\n---\n\n");
  
const buildCitations = (chunks: RetrievedChunk[]): Citation[] =>
  chunks.map((c, i) => ({
    index: i + 1,
    documentId: c.documentId,
    documentTitle: c.documentTitle,
    excerpt: c.text.slice(0, 150) + "...",
    similarity: Math.round(c.similarity * 100) / 100,
  }));
export const streamRagResponse = async ({
  query,
  organizationId,
  res,
  conversationHistory = [],
}: {
  query: string;
  organizationId: string;
  res: Response;
  conversationHistory: { role: string; content: string }[];
}): Promise<void> => {
  const cached = await getCachedAnswer(query, organizationId);

  if (cached !== null && cached !== undefined) {
    const cachedAnswer = cached.answer as string;
    const cachedCitations = cached.citations;

    res.write(
      `data:${JSON.stringify({ citations: cachedCitations, fromCache: true })}\n\n`
    );

    const words = cachedAnswer.split(" ");
    for (const word of words) {
      res.write(`data:${JSON.stringify({ token: word + " " })}\n\n`);
      await new Promise((r) => setTimeout(r, 10));
    }

    res.write("data:[DONE]\n\n");
    res.end();
    return;
  }

  const queryEmbedding = await generateQueryEmbedding(query);

  const chunks = await similaritySearch(queryEmbedding, organizationId, 5, 0.1);

  const context = buildContext(chunks);
  const citations = buildCitations(chunks);

  
  res.write(`data:${JSON.stringify({ citations })}\n\n`);

  const systemPrompt =
    chunks.length > 0
      ? `You are a helpful AI assistant for an enterprise knowledge base.
Answer the user's question using ONLY the context provided below.
Always cite sources inline using [Source N] notation.
If the answer is not in the context, say clearly: "I don't have that information in the uploaded documents."
Be concise and specific.

CONTEXT:
        ${context}`
        : `You are a helpful AI assistant for an enterprise knowledge base.
        No relevant documents were found for this query.
        Tell the user no relevant documents were found and suggest they upload relevant documents first.`;

  const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${process.env.GROQ_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: process.env.GROQ_MODEL || "groq/compound-mini",
      temperature: 0.2,
      max_tokens: 1024,
      stream: true,
      messages: [
        { role: "system", content: systemPrompt },
        ...conversationHistory.map((m) => ({
          role: m.role as "user" | "assistant",
          content: m.content,
        })),
        { role: "user", content: query },
      ],
    }),
  });

  const reader = response.body!.getReader();
  const decoder = new TextDecoder();

  let fullAnswer = "";
  let tokenCount = 0;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    const chunk = decoder.decode(value, { stream: true });
    const lines = chunk.split("\n");

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed === "data: [DONE]") continue;
      if (!trimmed.startsWith("data: ")) continue;

      try {
        const parsed = JSON.parse(trimmed.slice(6));
        const token = parsed.choices?.[0]?.delta?.content || "";
        if (token) {
          fullAnswer += token;
          tokenCount++;
          res.write(`data:${JSON.stringify({ token })}\n\n`);
        }
      } catch {
        // skip malformed lines
      }
    }
  }

  console.log("Stream finished — tokens:", tokenCount, "answer length:", fullAnswer.length);

  res.write("data:[DONE]\n\n");
  res.end();

  // Step 8 — cache answer in background
  if (chunks.length > 0 && fullAnswer) {
    setCachedAnswer(query, fullAnswer, citations, organizationId).catch((err) =>
      console.error("Cache write failed:", err)
    );
  }
};
export const recordTokenUsage = async (
  userId: string,
  tokensUsed: number
): Promise<void> => {
  if (!userId || !tokensUsed) return;
  await prisma.user.update({
    where: { id: userId },
    data: { aiTokensUsed: { increment: tokensUsed } },
  });
};