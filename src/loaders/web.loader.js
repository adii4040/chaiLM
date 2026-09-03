import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters";
import { firecrawlApp } from "../lib/index.js";
import { config } from "../config/env.js";
import { SourceCache } from "../models/SourceCache.model.js";

export async function scrapWebsite(url) {
  const normalizedUrl = (url || "").trim();
  if (!normalizedUrl) {
    throw new Error("Missing website URL to scrape");
  }

  // 1. Check SourceCache in MongoDB
  try {
    const cached = await SourceCache.findOne({ key: normalizedUrl, type: "website" });
    if (cached?.data?.markdown) {
      console.log(`[SourceCache] HIT for website: ${normalizedUrl} ("${cached.title}")`);
      return {
        markdown: cached.data.markdown,
        title: cached.data.title || cached.title || normalizedUrl,
      };
    }
  } catch (cacheErr) {
    console.warn(`[SourceCache] Read error for website ${normalizedUrl}:`, cacheErr.message);
  }

  // 2. Scrape via Firecrawl
  try {
    console.log(`[Web Processor] Cache MISS. Scraping website via Firecrawl: ${normalizedUrl}...`);
    const scrapeResult = await firecrawlApp.scrape(normalizedUrl, { formats: ['markdown'] });
    const markdown = scrapeResult.markdown || scrapeResult.data?.markdown || "";
    const title = scrapeResult.metadata?.title || scrapeResult.data?.metadata?.title || normalizedUrl;

    console.log(`[Web Processor] Scraped markdown content successfully for: ${title}`);

    // 3. Save to SourceCache asynchronously
    try {
      await SourceCache.findOneAndUpdate(
        { key: normalizedUrl, type: "website" },
        {
          key: normalizedUrl,
          type: "website",
          url: normalizedUrl,
          title,
          data: { markdown, title },
        },
        { upsert: true, new: true, setDefaultsOnInsert: true }
      );
      console.log(`[SourceCache] STORED scrape result for website: ${normalizedUrl}`);
    } catch (saveErr) {
      console.warn(`[SourceCache] Write error for website ${normalizedUrl}:`, saveErr.message);
    }

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
    const { markdown, title } = await scrapWebsite(targetUrl);

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

/**
 * Normalizes scraped markdown into structural Units based on markdown headings (# or ##).
 * Falls back to word-window chunks if no headings are present.
 *
 * @param {string} markdown - Scraped markdown string
 * @param {string} [pageTitle] - Optional page title
 * @param {number} [fallbackWords=500] - Word count fallback window
 * @returns {{ units: Array, title: string }}
 */
export function getWebUnits(markdown, pageTitle = "Web Page", fallbackWords = 500) {
  const cleanMd = (markdown || "").trim();
  if (!cleanMd) {
    return { units: [], title: pageTitle };
  }

  // Split on headings # or ## at start of line
  const sections = cleanMd.split(/(?=(?:^|\n)#{1,2}\s)/).filter((s) => s.trim().length > 0);

  if (sections.length > 1) {
    const units = sections.map((sec, i) => {
      const headingMatch = sec.match(/^#{1,2}\s+(.+)/m);
      const rangeLabel = headingMatch ? headingMatch[1].trim() : `Section ${i + 1}`;
      const text = sec.trim();
      return {
        text,
        tokens: Math.ceil(text.length / 4),
        rangeLabel,
        rangeStart: i + 1,
        rangeEnd: i + 1,
      };
    });
    return { units, title: pageTitle };
  }

  // Fallback if no markdown headings are found
  const words = cleanMd.split(/\s+/);
  const units = [];
  for (let i = 0; i < words.length; i += fallbackWords) {
    const text = words.slice(i, i + fallbackWords).join(" ");
    units.push({
      text,
      tokens: Math.ceil(text.length / 4),
      rangeLabel: `Section ${units.length + 1}`,
      rangeStart: units.length + 1,
      rangeEnd: units.length + 1,
    });
  }

  return { units, title: pageTitle };
}
