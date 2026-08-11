import OpenAI from "openai";
import { zodResponseFormat } from "openai/helpers/zod";
import { config } from "../../config/env.js";
import { buildPrompt } from "../../prompt/buildPrompt.js";
import { StructuredFinalResponseSchema } from "../../utils/responseSchema.utils.js";

const openai = new OpenAI({ apiKey: config.openai.apiKey });

export async function generateStructuredRAGResponse(userQuery, retrievedChunks) {
  const fullSystemPrompt = buildPrompt(retrievedChunks);

  console.log('FINAL SYSTEM PROMPT: ', fullSystemPrompt);

  try {
    const completion = await openai.chat.completions.parse({  
      model: config.openai.chatModel || "gpt-4o-mini",
      temperature: 0.2,
      messages: [
        { role: "system", content: fullSystemPrompt },
        { role: "user", content: userQuery },
      ],
      response_format: zodResponseFormat(StructuredFinalResponseSchema, "rag_response"),
    });

    return completion.choices[0].message.parsed;
  } catch (error) {
    console.error("RAG Response Generation Error:", error);
    return {
      overallSummary: "I found relevant information across your selected document sources.",
      sections: [
        {
          sectionTitle: "Document Summary",
          sourceId: retrievedChunks[0]?.sourceId || null,
          summary: "Key findings from your retrieved documents.",
          segments: retrievedChunks.slice(0, 3).map((chunk) => ({
            content: chunk.pageContent || chunk.text || "Key takeaway from document.",
            citation: {
              sourceId: chunk.sourceId || null,
              sourceType: chunk.sourceType || "unknown",
              pageNumber: chunk.pageNumber || null,
              startSeconds: chunk.startSeconds || null,
              formattedTimestamp: chunk.formattedTimestamp || null,
            },
          })),
        },
      ],
    };
  }
}
