import { z } from "zod";

export const outlineLessonSchema = z.object({
  stableId: z
    .string()
    .describe("URL-safe slug unique within the path, e.g. 'variables-and-types'"),
  title: z.string(),
  summary: z.string(),
  objectives: z.array(z.string()).min(1).max(5),
});

export const outlineSchema = z.object({
  summary: z.string(),
  modules: z
    .array(
      z.object({
        stableId: z
          .string()
          .describe("URL-safe slug unique within the path, e.g. 'core-fundamentals'"),
        title: z.string(),
        description: z.string(),
        lessons: z.array(outlineLessonSchema).min(1).max(10),
      })
    )
    .min(2)
    .max(12),
});

export type Outline = z.infer<typeof outlineSchema>;

export const lessonContentSchema = z.object({
  content: z.string().describe("Full lesson body in GitHub-flavored markdown"),
  quiz: z.object({
    title: z.string(),
    questions: z
      .array(
        z.object({
          question: z.string(),
          options: z.array(z.string()).length(4),
          correctIndex: z.number().int().min(0).max(3),
          explanation: z.string(),
        })
      )
      .min(3)
      .max(8),
  }),
  challenges: z
    .array(
      z.object({
        type: z.enum(["code", "output_prediction", "freeform"]),
        title: z.string(),
        instructions: z.string(),
        language: z.string(),
        starterCode: z.string(),
        testCases: z.array(
          z.object({
            name: z.string(),
            expression: z
              .string()
              .describe(
                "JavaScript expression evaluated against the learner's code; must return truthy to pass, e.g. 'add(2, 3) === 5'"
              ),
          })
        ),
        expectedOutput: z
          .string()
          .describe("For output_prediction: the exact expected output"),
      })
    )
    .min(1)
    .max(4),
  flashcards: z
    .array(z.object({ front: z.string(), back: z.string() }))
    .min(2)
    .max(8),
});

export type LessonContent = z.infer<typeof lessonContentSchema>;

export const regenLessonSchema = outlineLessonSchema.extend({
  changed: z
    .boolean()
    .describe(
      "true if this lesson's content materially changed and should be regenerated; false to keep existing content"
    ),
});

export const regenSchema = z.object({
  changeNotes: z
    .string()
    .describe("Markdown summary of what was added, removed, or updated"),
  summary: z.string(),
  modules: z
    .array(
      z.object({
        stableId: z
          .string()
          .describe("Reuse the existing module slug if it covers the same topic; new slug only for genuinely new modules"),
        title: z.string(),
        description: z.string(),
        lessons: z.array(regenLessonSchema).min(1).max(10),
      })
    )
    .min(1)
    .max(12),
});

export type Regen = z.infer<typeof regenSchema>;

// Pre-generation interview: gauges the learner so the outline can be tailored
// and missing prerequisites can spawn their own paths.
export const interviewSchema = z.object({
  skillQuestion: z
    .string()
    .describe("Question asking the learner's current experience with the topic"),
  skillOptions: z
    .array(z.string())
    .min(3)
    .max(5)
    .describe("Ordered least→most experienced, e.g. ['Never used it', 'Beginner', 'Intermediate', 'Advanced']"),
  prerequisites: z
    .array(
      z.object({
        topic: z
          .string()
          .describe("A prerequisite topic name, e.g. 'TypeScript' — must be learnable as its own path"),
        description: z
          .string()
          .describe("One line on why it's needed for this topic"),
      })
    )
    .min(0)
    .max(6),
  questions: z
    .array(
      z.object({
        question: z.string(),
        options: z.array(z.string()).min(2).max(5),
      })
    )
    .min(1)
    .max(4)
    .describe("Short multiple-choice questions about goals/context that help tailor the plan"),
});

export type Interview = z.infer<typeof interviewSchema>;

// Answers collected from the interview form
export interface InterviewAnswers {
  skillLevel?: string;
  prerequisites?: { topic: string; known: boolean }[];
  answers?: { question: string; answer: string }[];
}

// Shapes stored in Challenge.payload (JSON column)
export interface QuizPayload {
  title: string;
  questions: {
    question: string;
    options: string[];
    correctIndex: number;
    explanation: string;
  }[];
}

export interface CodeChallengePayload {
  title: string;
  instructions: string;
  language: string;
  starterCode: string;
  testCases: { name: string; expression: string }[];
  expectedOutput?: string;
}
