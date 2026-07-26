import "dotenv/config";

export const config = {
  port: Number(process.env.PORT) || 8000,
  qdrant: {
    url: process.env.QDRANT_URL || "http://127.0.0.1:6333",
    collection: process.env.QDRANT_COLLECTION || "workspace-docs",
  },
  openai: {
    apiKey: process.env.OPENAI_API_KEY,
    embeddingModel: process.env.EMBEDDING_MODEL || "text-embedding-3-small",
  },
  gemini: {
    apiKey: process.env.GEMINI_API_KEY,
  },
  transcriptApi: {
    apiKey: process.env.TRANSCRIPT_API_KEY,
  },
  cohere: {
    apiKey: process.env.COHERE_API_KEY,
  },
  chunking: {
    chunkSize: Number(process.env.CHUNK_SIZE) || 600,
    chunkOverlap: Number(process.env.CHUNK_OVERLAP) || 150,
  },
  cohere: {
    apiKey: process.env.COHERE_API_KEY
  }
};