/**
 * Formats a Web page chunk object into an LLM prompt context block
 * @param {Object} doc - Document item containing pageContent, title, sourceUrl, etc.
 * @param {number} index - 0-indexed position in the document list
 * @returns {string} Formatted context block string
 */
export function formatWebDocument(doc, index = 0) {
  const title = doc.title || "Web Page";
  const sourceUrl = doc.sourceUrl || doc.source || "Unknown Source";
  const content = doc.pageContent || doc.content || "";
  const sourceId = doc.sourceId || doc.document?.metadata?.sourceId || "";

  return `==============================
Document ${index + 1}
Source ID: ${sourceId}
Type: WEBSITE
Title: ${title}
Source URL: ${sourceUrl}

Content:
${content}
==============================`;
}
