import { CheerioWebBaseLoader } from "@langchain/community/document_loaders/web/cheerio";
import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters";
import { config } from "../config/env.js";

/**
 * Loads a web page URL using Cheerio, splits content into text chunks, and returns metadata
 * @param {string} url - Target website URL
 * @returns {Promise<Object>} Object containing chunks, title, sourceUrl, cloudinaryUrl
 */
export async function processWeb(url) {
  try {
    console.log(`[Web Processor] Loading web content for URL: ${url}...`);
    const loader = new CheerioWebBaseLoader(url);
    const rawDocs = await loader.load();

    const title = rawDocs[0]?.metadata?.title || url;

    const formattedDocs = rawDocs.map((doc) => ({
      ...doc,
      metadata: {
        ...doc.metadata,
        title: title,
        source: url,
        sourceType: "website",
      },
    }));

    console.log("[Web Processor] Splitting web document content into text chunks...");
    const splitter = new RecursiveCharacterTextSplitter({
      chunkSize: config.chunking?.chunkSize || 600,
      chunkOverlap: config.chunking?.chunkOverlap || 150,
    });

    const chunks = await splitter.splitDocuments(formattedDocs);

    return {
      chunks,
      title,
      sourceUrl: url,
      cloudinaryUrl: null,
    };
  } catch (error) {
    console.error("Web Processor Error:", error);
    throw new Error(`Failed to process website content: ${error.message}`);
  }
}
