import { z } from "zod";

export const AnswerCitationSchema = z.object({
    startSeconds: z
        .number()
        .describe("The exact start time in seconds corresponding to this point in the video, or null if general statement."),
    formattedTimestamp: z
        .string()
        .describe("Timestamp in [HH:MM:SS] format corresponding to startSeconds, e.g. '00:04:39'"),
});

export const AnswerSegmentSchema = z.object({
    content: z
        .string()
        .describe("The answer text segment without inline string brackets like [00:04:39]."),
    citation: z
        .nullable(AnswerCitationSchema)
        .describe("Optional timestamp citation object associated with this statement."),
});

export const StructuredFinalResponseSchema = z.object({
    summary: z
        .string()
        .describe("A brief 1-2 sentence overall summary answering the user query."),
    segments: z
        .array(AnswerSegmentSchema)
        .describe("An ordered array of answer points, key takeaways, or steps."),
});