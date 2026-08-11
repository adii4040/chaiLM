import { QdrantVectorStore } from "@langchain/qdrant";
import { OpenAIEmbeddings } from "@langchain/openai";
import { config } from "../config/env.js";

const embeddings = new OpenAIEmbeddings({
  model: config.openai.embeddingModel,
  apiKey: config.openai.apiKey,
});

/**
 * Connects to Qdrant Vector Store using standard collection config
 * @returns {Promise<QdrantVectorStore>}
 */
export async function getVectorStore() {
  return await QdrantVectorStore.fromExistingCollection(embeddings, {
    url: config.qdrant.url,
    collectionName: config.qdrant.collection,
  });
}
