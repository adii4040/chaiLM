import { z } from "zod";

export const AnswerCitationSchema = z.object({
  sourceId: z
    .nullable(z.string())
    .describe("The unique sourceId of the document or video being cited, or null if unknown."),
  sourceUrl: z
    .nullable(z.string())
    .describe("The specific URL associated with the cited segment. Extract this from markdown links in content if available, otherwise use the general Source URL from metadata."),
  sourceType: z
    .enum(["youtube", "pdf", "website", "unknown"])
    .describe("The type of source being cited: 'youtube', 'pdf', or 'website'."),
  pageNumber: z
    .nullable(z.number())
    .describe("Page number for PDF citations. MUST BE NULL for youtube or website sources."),
  startSeconds: z
    .nullable(z.number())
    .describe("Start time in seconds for YouTube video citations. MUST BE NULL for PDFs or websites."),
  formattedTimestamp: z
    .nullable(z.string())
    .describe("Timestamp in [HH:MM:SS] format for YouTube video citations. MUST BE NULL for PDFs or websites."),
  timeUrl: z
    .nullable(z.string())
    .describe("Direct YouTube URL with timestamp parameter (e.g. 'https://youtu.be/wxK6FndO0sg?t=877s'). MUST BE NULL for PDFs or websites."),
});

export const AnswerSegmentSchema = z.object({
  content: z
    .string()
    .describe("The takeaway point or analytical statement without inline bracket citations."),
  citation: z
    .nullable(AnswerCitationSchema)
    .describe("Citation object identifying the document page or video timestamp used for this segment, or null for general statements."),
});

export const AnswerSectionSchema = z.object({
  sectionTitle: z
    .string()
    .describe("Clear, concise title header for this source/topic section (e.g., 'SuperSuper\'s View on Ormund Hightower' or 'Evaluation of Krishn Modh\'s Resume')."),
  sourceId: z
    .nullable(z.string())
    .describe("The sourceId associated with this section, or null for general topics."),
  summary: z
    .string()
    .describe("A 1-2 sentence overview summary for this specific section."),
  segments: z
    .array(AnswerSegmentSchema)
    .describe("Ordered list of key takeaway points and citations for this section."),
});

export const StructuredFinalResponseSchema = z.object({
  overallSummary: z
    .string()
    .describe("A brief executive summary answering the user query across all requested sources."),
  sections: z
    .array(AnswerSectionSchema)
    .describe("NotebookLM-style source-by-source or topic-by-topic response breakdowns."),
});

// Studio Master Outline Extraction Schemas

export const SegmentBatchSchema = z.object({
  segments: z.array(
    z.object({
      rangeLabel: z.string().describe("Human readable location, e.g. 'Page 3' or '04:00-06:00'"),
      rangeStart: z.number().describe("Starting range numerical coordinate"),
      rangeEnd: z.number().describe("Ending range numerical coordinate"),
      topicHint: z.string().describe("Short 2-4 word theme or topic of this segment"),
      summary: z.string().describe("Comprehensive paragraph summary of this section's discussion"),
      takeaways: z.array(z.string()).describe("Key granular takeaways, insights, or arguments"),
      terms: z.array(
        z.object({
          term: z.string().describe("Key terminology or technical concept"),
          definition: z.string().describe("Clear, concise definition as used in source"),
        })
      ),
    })
  ),
});

export const OutlineSchema = z.object({
  chapters: z.array(
    z.object({
      chapterIndex: z.number().describe("Sequential 1-based index (1, 2, 3...)"),
      chapterTitle: z.string().describe("Descriptive title for this chapter"),
      includedSegmentIds: z.array(z.number()).describe("Array of sequential input segment IDs assigned to this chapter"),
      rangeLabel: z.string().describe("Human-readable covered range, e.g. 'Pages 1-5' or '00:00-12:00'"),
      rangeStart: z.number().describe("Starting numerical coordinate of this chapter (e.g., timestamp in seconds or page number)"),
      rangeEnd: z.number().describe("Ending numerical coordinate of this chapter (e.g., timestamp in seconds or page number)"),
      summary: z.string().describe("Synthesized chapter summary"),
      takeaways: z.array(z.string()).describe("Deduplicated comprehensive list of key takeaways"),
      terms: z.array(
        z.object({
          term: z.string(),
          definition: z.string(),
        })
      ),
    })
  ),
});