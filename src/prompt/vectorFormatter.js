function formatSecondsToTimestamp(totalSeconds = 0) {
  const hrs = Math.floor(totalSeconds / 3600);
  const mins = Math.floor((totalSeconds % 3600) / 60);
  const secs = Math.floor(totalSeconds % 60);

  const hh = String(hrs).padStart(2, "0");
  const mm = String(mins).padStart(2, "0");
  const ss = String(secs).padStart(2, "0");

  return `${hh}:${mm}:${ss}`;
}

/**
 * Formats vector store document objects (PDF, YouTube, Website) into LLM-readable prompt context blocks.
 */
export function format(docs) {
  const documents = Array.isArray(docs) ? docs : [docs];
  if (documents.length === 0) return "";

  return documents
    .map((doc, index) => {
      const type = (doc.sourceType || "document").toUpperCase();
      const title = doc.title || "Untitled Document";
      const sourceUrl = doc.sourceUrl || doc.source || "Unknown Source";

      if (type === "YOUTUBE") {
        const channelName = doc.channelName || doc.author || "Unknown Channel";
        const startSecs = doc.startSeconds || 0;
        const formattedTimestamp = formatSecondsToTimestamp(startSecs);

        return `==============================
Document ${index + 1}
Type: YOUTUBE
Channel/Creator: ${channelName}
Title: ${title} (${sourceUrl})
Timestamp: [${formattedTimestamp}] (Start Seconds: ${startSecs}s)

Content:
${doc.pageContent}
==============================`;
      }

      if (type === "PDF") {
        const pageNum = doc.pageNumber || doc.startSeconds || doc.metadata?.loc?.pageNumber || 1;
        return `==============================
Document ${index + 1}
Type: PDF
Title: ${title} (${sourceUrl})
Page Number: ${pageNum}

Content:
${doc.pageContent}
==============================`;
      }

      // Default for WEBSITE or other general sources
      return `==============================
Document ${index + 1}
Type: ${type}
Title: ${title}
Source URL: ${sourceUrl}

Content:
${doc.pageContent}
==============================`;
    })
    .join("\n\n");
}