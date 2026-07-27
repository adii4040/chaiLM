import {
  formatYoutubeDocument,
  formatPdfDocument,
  formatWebDocument,
} from "./formatters/index.js";

/**
 * Main vector store documents formatter.
 * Routes each retrieved document item to its specific formatter (YouTube, PDF, Website).
 * @param {Array<Object>|Object} docs - Retreived document or array of documents
 * @returns {string} Formatted context blocks concatenated as a single string for LLM system prompt
 */
export function format(docs) {
  const documents = Array.isArray(docs) ? docs : [docs];
  if (documents.length === 0) return "";

  return documents
    .map((doc, index) => {
      const type = (doc.sourceType || "document").toLowerCase();

      if (type === "youtube") {
        return formatYoutubeDocument(doc, index);
      }

      if (type === "pdf") {
        return formatPdfDocument(doc, index);
      }

      // Default for website or generic web sources
      return formatWebDocument(doc, index);
    })
    .join("\n\n");
}