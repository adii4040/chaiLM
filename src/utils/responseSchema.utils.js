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