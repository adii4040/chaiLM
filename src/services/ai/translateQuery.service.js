// src/services/llm.service.js
import OpenAI from "openai";
import { zodResponseFormat } from "openai/helpers/zod";
import { z } from "zod";
import { config } from "../../config/env.js";

const openai = new OpenAI({ apiKey: config.openai.apiKey });

export const MultiQueryTranslationSchema = z.object({
  rewritten: z
    .string()
    .describe("The original query rewritten to maximize retrieval quality."),
  stepBack: z
    .string()
    .describe("A broader conceptual question."),
  subQueries: z
    .array(z.string())
    .min(3)
    .max(5)
    .describe(
      "3 to 5 independent sub-queries. Match the language style of the original query unless explicit Hinglish/Hindi entities are present."
    ),
});

export async function translateQuery(userQuery) {
  try {
    const completion = await openai.chat.completions.parse({
      model: config.openai.chatModel || "gpt-4o-mini",
      temperature: 0.2,
      messages: [
        {
          role: "system",
          content: `
You are an expert query-understanding engine for an advanced RAG retrieval system.

CRITICAL LANGUAGE ADAPTATION RULES:
1. Detect the primary language and intent of the user's query.
2. IF the user query is strictly in English (e.g., "What is this video about?", "How to build muscle?"):
   - Generate ALL sub-queries, step-back questions, and rewrites strictly in ENGLISH.
   - Do NOT include Devanagari Hindi translations unless the user explicitly asks in Hindi or Hinglish.
3. IF the user query contains Hindi/Hinglish words (e.g., "Piyush ne AI ke baare me kya kaha", "kaise milegi job"):
   - Generate variants in English, Hinglish, and Devanagari script.

Ensure sub-queries break down the question into distinct, non-overlapping search angles.
`,
        },
        { role: "user", content: userQuery },
      ],
      response_format: zodResponseFormat(MultiQueryTranslationSchema, "query_translation"),
    });

    return completion.choices[0].message.parsed;
  } catch (error) {
    console.error("Query translation error:", error);
    return {
      rewritten: userQuery,
      stepBack: userQuery,
      subQueries: [userQuery],
    };
  }
}
