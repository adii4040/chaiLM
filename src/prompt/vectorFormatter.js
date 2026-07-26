


function formatSecondsToTimestamp(totalSeconds) {
    const hrs = Math.floor(totalSeconds / 3600);
    const mins = Math.floor((totalSeconds % 3600) / 60);
    const secs = totalSeconds % 60;

    const hh = String(hrs).padStart(2, "0");
    const mm = String(mins).padStart(2, "0");
    const ss = String(secs).padStart(2, "0");

    return `${hh}:${mm}:${ss}`;
}

export function format(docs) {
    const documents = Array.isArray(docs) ? docs : [docs];
    if (documents.length === 0) return "";

    return documents
        .map((doc, index) => {
            const title = doc.title || "Unknown Title";
            const channelName = doc.channelName || doc.author || "Author";
            const startSecs = doc.startSeconds || 0;
            const formattedTimestamp = formatSecondsToTimestamp(startSecs);

            return `
==============================
Document ${index + 1}
Type: YOUTUBE
Channel/Creator: ${channelName}
Title: ${title} (${doc.sourceUrl})
Timestamp: [${formattedTimestamp}] (Start Seconds: ${startSecs}s)

Content:
${doc.pageContent}
==============================`;
        })
        .join("\n\n");
}