/**
 * Formats seconds into [HH:MM:SS] timestamp string format
 */
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
 * Formats a YouTube transcript chunk object into an LLM prompt context block
 * @param {Object} doc - Document item containing pageContent, title, author, startSeconds, etc.
 * @param {number} index - 0-indexed position in the document list
 * @returns {string} Formatted context block string
 */
export function formatYoutubeDocument(doc, index = 0) {
  const title = doc.title || "YouTube Video";
  const channelName = doc.channelName || doc.author || "Unknown Channel";
  const startSecs = doc.startSeconds || 0;
  const formattedTimestamp = formatSecondsToTimestamp(startSecs);
  const sourceUrl = doc.sourceUrl || doc.source || "Unknown Source";
  const content = doc.pageContent || doc.content || "";

  return `==============================
Document ${index + 1}
Type: YOUTUBE
Channel/Creator: ${channelName}
Title: ${title} (${sourceUrl})
Timestamp: [${formattedTimestamp}] (Start Seconds: ${startSecs}s)

Content:
${content}
==============================`;
}
