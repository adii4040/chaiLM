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
      summary: z.string().describe("Comprehensive paragraph summary of this section's discussion with strict factual grounding and entity attribution"),
      keyEntities: z.array(
        z.object({
          entity: z.string().describe("Exact name of the person, character, dragon, model, tool, or institution explicitly mentioned"),
          roleOrAction: z.string().describe("Their exact action, allegiance, ownership, or status explicitly stated in this slice"),
        })
      ).describe("All distinct actors, figures, or entities active in this slice with their exact actions/roles"),
      takeaways: z.array(z.string()).describe("Granular takeaways with explicit subject attribution (e.g. 'Entity/Subject: Exact action, insight, or finding')"),
      terms: z.array(
        z.object({
          term: z.string().describe("Key terminology, lore entity, or technical concept"),
          definition: z.string().describe("Clear, concise definition as used strictly in source context"),
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
      summary: z.string().describe("Synthesized chapter summary with strict factual grounding and correct entity attribution"),
      takeaways: z.array(z.string()).describe("Deduplicated comprehensive list of key takeaways with explicit subject attribution"),
      terms: z.array(
        z.object({
          term: z.string(),
          definition: z.string(),
        })
      ),
    })
  ),
});


//Artificates schema

export const StudyGuideSchema = z.object({
  title: z.string().describe("Title of the study guide"),
  executiveSummary: z.string().describe("High-level executive overview synthesizing the entire source or workspace"),
  keyThemes: z.array(
    z.object({
      themeTitle: z.string().describe("Name of the core theme or domain topic"),
      overview: z.string().describe("Detailed narrative explanation of this theme"),
      keyPoints: z.array(z.string()).describe("Core takeaways, methodologies, or architectural guidelines"),
    })
  ).describe("Structured thematic modules covering the material"),
  glossary: z.array(
    z.object({
      term: z.string().describe("Specialized terminology or acronym"),
      definition: z.string().describe("Precise, context-aware definition"),
    })
  ).describe("Comprehensive glossary of domain terms"),
  keyTakeaways: z.array(z.string()).describe("Essential high-level summary points"),
  reviewChecklist: z.array(z.string()).describe("Actionable review items or self-assessment questions to test comprehension"),
});

export const FlashcardDeckSchema = z.object({
  deckTitle: z.string().describe("Title of the flashcard deck"),
  cards: z.array(
    z.object({
      id: z.number().describe("Sequential card index (1, 2, 3...)"),
      front: z.string().describe("Question, concept name, or prompt on the front of the card"),
      back: z.string().describe("Clear, concise, and accurate answer or explanation on the back"),
      hint: z.string().describe("Subtle memory cue or clue to assist recall"),
      sourceReference: z.string().describe("Chapter, page range, or timestamp reference (e.g. 'Pages 4-6' or '17:53')"),
      difficulty: z.enum(["easy", "medium", "hard"]).describe("Assessed difficulty of the concept"),
    })
  ).describe("Array of flashcards"),
});

export const QuizSchema = z.object({
  quizTitle: z.string().describe("Title of the quiz"),
  questions: z.array(
    z.object({
      id: z.number().describe("Sequential question index (1, 2, 3...)"),
      question: z.string().describe("Clear, unambiguous question text"),
      options: z.array(z.string()).min(2).max(4).describe("Array of 2 to 4 distinct answer choices"),
      correctAnswerIndex: z.number().describe("0-based index pointing to the correct option in the options array"),
      explanation: z.string().describe("Detailed reasoning explaining why the correct answer is right and others are wrong"),
      sourceReference: z.string().describe("Chapter, page range, or timestamp reference (e.g. 'Pages 43-54')"),
    })
  ).describe("Array of quiz questions"),
});

export const MindMapSchema = z.object({
  mapTitle: z.string().describe("Title of the mind map"),
  rootNode: z.object({
    label: z.string().describe("Central root concept or document title"),
    branches: z.array(
      z.object({
        label: z.string().describe("Primary topic branch (e.g. Chapter / Core Theme)"),
        subBranches: z.array(
          z.object({
            label: z.string().describe("Subtopic or technical subcategory"),
            keyDetails: z.array(z.string()).describe("Key bullet points, components, or examples"),
          })
        ),
      })
    ),
  }),
});

export const AudioOverviewSchema = z.object({
  episodeTitle: z.string().describe("Engaging title for the podcast episode"),
  summary: z.string().describe("Short synopsis of the episode"),
  durationMinutesEstimate: z.number().describe("Estimated spoken duration in minutes"),
  dialogue: z.array(
    z.object({
      speaker: z.enum(["Host 1", "Host 2"]).describe("Speaker identifier"),
      text: z.string().describe("Spoken dialogue utterance"),
      tone: z.string().describe("Vocal direction or tone, e.g. 'enthusiastic', 'inquisitive', 'analytical'"),
      ai_instruction: z.string().describe(
        "Natural-language delivery instruction for a TTS voice model — pacing, emphasis, emotional coloring, pauses. E.g. 'Speak with rising excitement, slight emphasis on the word seismic, quick pace.'"
      ),
    })
  ).describe("Turn-by-turn conversational podcast transcript"),
});