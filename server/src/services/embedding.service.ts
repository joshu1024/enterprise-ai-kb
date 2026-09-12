import { CohereClient } from "cohere-ai";

const cohere = new CohereClient({ token: process.env.COHERE_API_KEY as string });

const parseEmbedding = (raw: any): number[] => {
  // Already an array of numbers
  if (Array.isArray(raw) && typeof raw[0] === "number") {
    return raw;
  }

  // Single string — split it
  if (typeof raw === "string") {
    return raw.split(",").map(Number);
  }

  // Array with one string element
  if (Array.isArray(raw) && typeof raw[0] === "string" && raw.length === 1) {
    return raw[0].split(",").map(Number);
  }

  // Array of strings
  if (Array.isArray(raw) && typeof raw[0] === "string") {
    return raw.map(Number);
  }

  return Array.from(raw).map((v) => Number(v));
};

export const generateEmbedding = async (text: string): Promise<number[]> => {
  const response = await cohere.embed({
    texts: [text.trim().toLowerCase()],
    model: "embed-english-v3.0",
    inputType: "search_document",
  });

  const raw = (response.embeddings as any)[0];
  const embedding = parseEmbedding(raw);

  console.log("Embedding length:", embedding.length);
  console.log("First value type:", typeof embedding[0]);
  console.log("First value:", embedding[0]);

  return embedding;
};

export const generateQueryEmbedding = async (text: string): Promise<number[]> => {
  const response = await cohere.embed({
    texts: [text.trim().toLowerCase()],
    model: "embed-english-v3.0",
    inputType: "search_query",
  });

  const raw = (response.embeddings as any)[0];
  const embedding = parseEmbedding(raw);

  console.log("Query embedding length:", embedding.length);
  console.log("Query first value type:", typeof embedding[0]);
  console.log("Query first value:", embedding[0]);

  return embedding;
};