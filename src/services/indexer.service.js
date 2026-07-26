import { PDFLoader } from "@langchain/community/document_loaders/fs/pdf";
import { CheerioWebBaseLoader } from "@langchain/community/document_loaders/web/cheerio";
import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters";
import { OpenAIEmbeddings } from "@langchain/openai";
import { QdrantVectorStore } from "@langchain/qdrant";
import { config } from "../config/env.js";
import { loadYoutubeTranscript } from "../loaders/youtube.loader.js";

const embeddings = new OpenAIEmbeddings({
  model: config.openai.embeddingModel,
  apiKey: config.openai.apiKey,
});

async function loadDocuments(source) {
  if (source.type === "pdf") {
    const loader = new PDFLoader(source.filePath);
    return await loader.load();
  }

  if (source.type === "youtube") {
    return await loadYoutubeTranscript(source.url);
  }

  if (source.type === "website") {
    const loader = new CheerioWebBaseLoader(source.url);
    return await loader.load();
  }

  throw new Error(`Unsupported source type: ${source.type}`);
}

export async function processAndIndexDocument(sourcePayload) {
  console.log('LOAD DOCUMENTS...');
  const rawDocs = await loadDocuments(sourcePayload);

  console.log('RAW DOCS: ', rawDocs);

  let chunks;

  if (sourcePayload.type === "youtube") {
    // Already correctly chunked with accurate per-chunk timestamps —
    // running RecursiveCharacterTextSplitter again would re-split chunks
    // and silently duplicate the parent's stale startSeconds onto sub-chunks.
    console.log('SKIPPING SECOND SPLIT — YOUTUBE ALREADY CHUNKED WITH TIMESTAMPS');
    chunks = rawDocs;
  } else {
    console.log('SPLITTING...');
    const splitter = new RecursiveCharacterTextSplitter({
      chunkSize: config.chunking.chunkSize,
      chunkOverlap: config.chunking.chunkOverlap,
    });

    console.log('CREATING CHUNKS...');
    chunks = await splitter.splitDocuments(rawDocs);
  }

  console.log('ENRICHING METADATA...');
  console.log('sessionid: ', sourcePayload.sessionId);

  const enrichedChunks = chunks.map((chunk) => ({
    ...chunk,
    metadata: {
      ...chunk.metadata,
      sessionId: sourcePayload.sessionId,
      sourceType: sourcePayload.type,
      sourceUrl: sourcePayload.url || sourcePayload.filePath,
      indexedAt: new Date().toISOString(),
    },
  }));

  console.log('INDEXING INTO QDRANT');
  const vectorStore = await QdrantVectorStore.fromExistingCollection(embeddings, {
    url: config.qdrant.url,
    collectionName: config.qdrant.collection,
  });

  console.log('UPLOADING TO QDRANT...');
  const BATCH_SIZE = 100;
  console.log(`UPLOADING ${enrichedChunks.length} CHUNKS IN BATCHES OF ${BATCH_SIZE}...`);

  for (let i = 0; i < enrichedChunks.length; i += BATCH_SIZE) {
    const batch = enrichedChunks.slice(i, i + BATCH_SIZE);
    await vectorStore.addDocuments(batch);
    console.log(`  → Indexed batch ${Math.floor(i / BATCH_SIZE) + 1} / ${Math.ceil(enrichedChunks.length / BATCH_SIZE)}`);
  }

  return {
    success: true,
    chunksIndexed: enrichedChunks.length,
    sourceType: sourcePayload.type,
  };
}