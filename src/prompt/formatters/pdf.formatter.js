/**
 * Formats a PDF chunk object into an LLM prompt context block
 * @param {Object} doc - Document item containing pageContent, title, pageNumber, etc.
 * @param {number} index - 0-indexed position in the document list
 * @returns {string} Formatted context block string
 */
export function formatPdfDocument(doc, index = 0) {
  const title = doc.title || "PDF Document";
  const pageNum = doc.pageNumber || doc.metadata?.loc?.pageNumber || doc.startSeconds || 1;
  const sourceUrl = doc.sourceUrl || doc.source || "Unknown Source";
  const content = doc.pageContent || doc.content || "";

  return `==============================
Document ${index + 1}
Type: PDF
Title: ${title} (${sourceUrl})
Page Number: ${pageNum}

Content:
${content}
==============================`;
}
