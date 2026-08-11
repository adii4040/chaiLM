import "dotenv/config";

export const config = {
  port: Number(process.env.PORT) || 8000,
  jwt: {
    accessTokenSecret: process.env.ACCESS_TOKEN_SECRET_KEY || "chailm_access_secret_key_default_2026",
    refreshTokenSecret: process.env.REFRESH_TOKEN_SECRET_KEY || "chailm_refresh_secret_key_default_2026",
  },
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
  chunking: {
    chunkSize: Number(process.env.CHUNK_SIZE) || 600,
    chunkOverlap: Number(process.env.CHUNK_OVERLAP) || 150,
  },
  BATCH_SIZE: 100,
  retrieval: {
    vectorTopK: Number(process.env.VECTOR_TOP_K) || 10,
    finalTopK: Number(process.env.FINAL_TOP_K) || 5,
    rrfK: Number(process.env.RRF_K) || 60
  },
  cohere: {
    apiKey: process.env.COHERE_API_KEY
  },
  cloudinary: {
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
  }
};