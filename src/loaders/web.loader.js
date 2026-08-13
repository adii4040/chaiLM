import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters";
import { firecrawlApp } from "../lib/index.js";
import { config } from "../config/env.js";


export async function scrapWebsite(url) {
  try {
    const scrapeResult = await firecrawlApp.scrape(url, { formats: ['markdown'] });
    console.log("Scraped content successfully", scrapeResult);
    const markdown = scrapeResult.markdown || scrapeResult.data?.markdown || "";
    console.log("[Web Processor] Scraped markdown content logged successfully.");

    const title = scrapeResult.metadata?.title || scrapeResult.data?.metadata?.title || url;
    return { markdown, title };
  } catch (error) {
    console.error("[Web Processor] Firecrawl Scraping Error:", error);
    throw new Error(`Failed to scrape website content: ${error.message || error}`);
  }
}

/**
 * Loads a web page URL using Firecrawl, chunks the markdown text, and returns chunks & metadata
 * @param {string} url - Target website URL
 * @returns {Promise<Object>} Object containing chunks, title, sourceUrl, cloudinaryUrl
 */
export async function processWeb(url) {
  try {
    const targetUrl = url || 'https://www.amazon.com';
    const {markdown, title} = await scrapWebsite(targetUrl)

    console.log("[Web Processor] Splitting scraped markdown into text chunks...");
    const splitter = new RecursiveCharacterTextSplitter({
      chunkSize: config.chunking?.chunkSize || 600,
      chunkOverlap: config.chunking?.chunkOverlap || 150,
    });

    const chunks = await splitter.createDocuments(
      [markdown],
      [{ source: targetUrl, sourceType: "website", title }]
    );

    return {
      chunks,
      title,
      sourceUrl: targetUrl,
      cloudinaryUrl: null,
    };
  } catch (error) {
    console.error("Web Processor Error:", error);
    throw new Error(`Failed to process website content: ${error.message}`);
  }
}
