import { CheerioWebBaseLoader } from "@langchain/community/document_loaders/web/cheerio";

/**
 * Loads a web page URL and extracts text content using Cheerio
 * @param {string} url - Target website URL
 * @returns {Promise<Array>} Array of LangChain Document objects
 */
export async function loadWeb(url) {
  try {
    const loader = new CheerioWebBaseLoader(url);
    const docs = await loader.load();

    return docs.map((doc) => ({
      ...doc,
      metadata: {
        ...doc.metadata,
        title: doc.metadata?.title || url,
        source: url,
        sourceType: "website",
      },
    }));
  } catch (error) {
    console.error("Web Loader Error:", error);
    throw new Error(`Failed to load website content: ${error.message}`);
  }
}
