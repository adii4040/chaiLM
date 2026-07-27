import { z } from "zod";

export const AnswerCitationSchema = z.object({
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
});

export const AnswerSegmentSchema = z.object({
  content: z
    .string()
    .describe("The answer text segment without inline brackets."),
  citation: z
    .nullable(AnswerCitationSchema)
    .describe("Citation object identifying the document page or video timestamp used for this segment, or null for general statements."),
});

export const StructuredFinalResponseSchema = z.object({
  summary: z
    .string()
    .describe("A brief 1-2 sentence overall summary answering the user query."),
  segments: z
    .array(AnswerSegmentSchema)
    .describe("An ordered array of answer points, key takeaways, or steps."),
});