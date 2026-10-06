import {
  generateObject,
  generateText,
  tool,
  NoObjectGeneratedError,
  type LanguageModel,
} from "ai";
import { z } from "zod";
import { createOpenAI } from "@ai-sdk/openai";
import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { createAnthropic } from "@ai-sdk/anthropic";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { db } from "@/lib/db";
import { PROVIDER_KINDS, type ProviderKind } from "@/lib/providers";
import {
  interviewSchema,
  lessonContentSchema,
  outlineSchema,
  regenSchema,
  type Interview,
  type LessonContent,
  type Outline,
  type Regen,
} from "./schemas";

export interface ProviderConfig {
  slug: string;
  label: string;
  kind: string;
  baseUrl: string;
  apiKey: string;
  models: string; // JSON array
  defaultModel: string;
}

export function parseModels(models: string): string[] {
  try {
    const parsed = JSON.parse(models);
    return Array.isArray(parsed) ? parsed.filter((m) => typeof m === "string") : [];
  } catch {
    return [];
  }
}

export function modelFor(
  provider: Pick<ProviderConfig, "slug" | "kind" | "baseUrl" | "apiKey">,
  model: string
): LanguageModel {
  switch (provider.kind as ProviderKind) {
    case "openai":
      return createOpenAI({
        apiKey: provider.apiKey,
        ...(provider.baseUrl ? { baseURL: provider.baseUrl } : {}),
      }).chat(model);
    case "anthropic":
      return createAnthropic({ apiKey: provider.apiKey })(model);
    case "google":
      return createGoogleGenerativeAI({ apiKey: provider.apiKey })(model);
    case "openai-compatible":
      if (!provider.baseUrl) {
        throw new Error("This provider requires a base URL.");
      }
      return createOpenAICompatible({
        name: provider.slug || "custom",
        apiKey: provider.apiKey || undefined,
        baseURL: provider.baseUrl,
      })(model);
    default:
      throw new Error(`Unknown provider kind: ${provider.kind}`);
  }
}

export async function getActiveModel(): Promise<{
  model: LanguageModel;
  provider: string;
  providerKind: string;
  modelName: string;
}> {
  const settings = await db.appSettings.findUnique({
    where: { id: "singleton" },
  });
  if (!settings?.activeProvider) {
    throw new Error("No active LLM provider. Add one in Settings first.");
  }
  const provider = await db.provider.findUnique({
    where: { slug: settings.activeProvider },
  });
  if (!provider) {
    throw new Error(
      `Provider "${settings.activeProvider}" was deleted. Pick another in Settings.`
    );
  }
  const modelName =
    settings.activeModel ||
    provider.defaultModel ||
    parseModels(provider.models)[0];
  if (!modelName) {
    throw new Error(
      `No model selected for ${provider.label}. Pick one in Settings.`
    );
  }
  return {
    model: modelFor(provider, modelName),
    provider: provider.slug,
    providerKind: provider.kind,
    modelName,
  };
}

// OpenAI-compatible endpoints that lack json_schema support only guarantee
// *valid* JSON via response_format=json_object — not schema-conformant JSON
// (DeepSeek, some local servers). For those, embed the schema in the prompt.
// If the response still fails validation, retry via a required tool call,
// which carries the schema through the function-calling channel.
async function generateStructured<T>({
  model,
  schema,
  prompt,
  providerKind,
}: {
  model: LanguageModel;
  schema: z.ZodType<T>;
  prompt: string;
  providerKind: string;
}): Promise<T> {
  const fullPrompt =
    providerKind === "openai-compatible"
      ? `${prompt}\n\nRespond with a single json object conforming to this JSON schema:\n${JSON.stringify(z.toJSONSchema(schema))}`
      : prompt;
  try {
    const { object } = await generateObject({
      model,
      schema,
      prompt: fullPrompt,
      maxRetries: 3,
    });
    return object;
  } catch (err) {
    if (!NoObjectGeneratedError.isInstance(err)) throw err;
    try {
      const result = await generateText({
        model,
        prompt: fullPrompt,
        tools: {
          submit_result: tool({
            description: "Submit the structured result",
            inputSchema: schema,
          }),
        },
        toolChoice: "required",
        maxRetries: 2,
      });
      const input = result.toolCalls[0]?.input;
      const fallback = (() => {
        try {
          return JSON.parse(result.text);
        } catch {
          return undefined;
        }
      })();
      const parsed = schema.safeParse(input ?? fallback);
      if (parsed.success) return parsed.data;
    } catch {
      // Endpoint may not support tools — surface the original error below.
    }
    throw err;
  }
}

export async function testCredential(
  provider: Pick<ProviderConfig, "slug" | "kind" | "baseUrl" | "apiKey">,
  model?: string
): Promise<{ ok: boolean; error?: string }> {
  const fallbackModel = {
    openai: "gpt-4o-mini",
    anthropic: "claude-haiku-4-5",
    google: "gemini-2.0-flash",
  }[provider.kind];
  const modelName = model || fallbackModel;
  if (!modelName) {
    return { ok: false, error: "Enter a model name to test this endpoint" };
  }
  try {
    await generateText({
      model: modelFor(provider, modelName),
      prompt: "Reply with the single word: ok",
      maxOutputTokens: 8,
    });
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

// Fetch the live model list from a provider's API so the settings UI can
// offer up-to-date suggestions. Returns [] when the endpoint can't be read.
export async function listProviderModels(
  provider: Pick<ProviderConfig, "kind" | "baseUrl" | "apiKey">
): Promise<string[]> {
  const kind = PROVIDER_KINDS[provider.kind as ProviderKind];
  if (!kind) throw new Error(`Unknown provider kind: ${provider.kind}`);
  try {
    switch (provider.kind) {
      case "anthropic": {
        const res = await fetch(
          `${(provider.baseUrl || kind.defaultBaseUrl).replace(/\/+$/, "")}/v1/models?limit=1000`,
          {
            headers: {
              "x-api-key": provider.apiKey,
              "anthropic-version": "2023-06-01",
            },
          }
        );
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = (await res.json()) as { data?: { id: string }[] };
        return (data.data ?? []).map((m) => m.id).sort();
      }
      case "google": {
        const res = await fetch(
          `${(provider.baseUrl || kind.defaultBaseUrl).replace(/\/+$/, "")}/v1beta/models?pageSize=1000`,
          { headers: { "x-goog-api-key": provider.apiKey } }
        );
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = (await res.json()) as {
          models?: { name: string; supportedGenerationMethods?: string[] }[];
        };
        return (data.models ?? [])
          .filter((m) =>
            (m.supportedGenerationMethods ?? []).includes("generateContent")
          )
          .map((m) => m.name.replace(/^models\//, ""))
          .sort();
      }
      default: {
        // openai + any OpenAI-compatible endpoint: GET {base}/models
        const base = (
          provider.baseUrl || kind.defaultBaseUrl
        ).replace(/\/+$/, "");
        const res = await fetch(`${base}/models`, {
          headers: provider.apiKey
            ? { Authorization: `Bearer ${provider.apiKey}` }
            : {},
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = (await res.json()) as { data?: { id: string }[] };
        return (data.data ?? [])
          .map((m) => m.id)
          .filter(
            (id) =>
              provider.kind !== "openai" ||
              !/(whisper|tts|dall-e|embed|moderation|audio|realtime|transcribe|image|sora)/i.test(
                id
              )
          )
          .sort();
      }
    }
  } catch (err) {
    throw new Error(
      `Could not fetch models: ${err instanceof Error ? err.message : String(err)}`
    );
  }
}

export async function generateInterview(topic: string): Promise<Interview> {
  const { model, providerKind } = await getActiveModel();
  return generateStructured({
    model,
    schema: interviewSchema,
    providerKind,
    prompt: `A learner wants to learn "${topic}". Design a quick pre-course interview (10 seconds to answer) that will tailor their lesson plan.

Produce:
1. skillQuestion + skillOptions: how experienced they are with "${topic}" specifically (ordered least→most experienced).
2. prerequisites: up to 6 foundational topics a learner should already know BEFORE "${topic}" — e.g. for "Angular" you'd list TypeScript, JavaScript, HTML/CSS. Each must be a self-contained learnable topic. Keep the list tight: only things genuinely required.
3. questions: 1-4 multiple-choice questions about their goals or context that meaningfully change the plan (e.g. "What's your goal — job interview prep, building a project, academic study?"). Each option must be a concrete distinct answer.`,
  });
}

export interface OutlineContext {
  skillLevel?: string;
  knownPrereqs?: string[];
  missingPrereqs?: string[];
  answers?: { question: string; answer: string }[];
  isPrereqFor?: string;
}

export async function generateOutline(
  topic: string,
  context?: OutlineContext
): Promise<Outline> {
  const { model, providerKind } = await getActiveModel();

  const contextLines: string[] = [];
  if (context?.skillLevel) {
    contextLines.push(
      `- Self-rated experience with "${topic}": ${context.skillLevel} — calibrate starting difficulty accordingly (don't waste their time on things they clearly know).`
    );
  }
  if (context?.knownPrereqs?.length) {
    contextLines.push(
      `- Already knows: ${context.knownPrereqs.join(", ")} — skip or compress material covering these.`
    );
  }
  if (context?.missingPrereqs?.length) {
    contextLines.push(
      `- Does NOT know these prerequisites: ${context.missingPrereqs.join(", ")} — separate learning paths cover them; you may add brief refresher notes but do not dedicate whole lessons to them.`
    );
  }
  for (const qa of context?.answers ?? []) {
    contextLines.push(`- Q: ${qa.question} → A: ${qa.answer}`);
  }
  if (context?.isPrereqFor) {
    contextLines.push(
      `- This path is a PREREQUISITE for learning "${context.isPrereqFor}" — scope it to what "${context.isPrereqFor}" actually needs rather than exhaustive coverage.`
    );
  }
  const contextBlock = contextLines.length
    ? `\n\nLearner context:\n${contextLines.join("\n")}`
    : "";

  return generateStructured({
    model,
    schema: outlineSchema,
    providerKind,
    prompt: `You are an expert curriculum designer. Create a lesson plan outline for a learner who wants to learn: "${topic}".${contextBlock}

Requirements:
- 3-8 modules, ordered from fundamentals to advanced.
- 2-6 lessons per module, each a concrete learnable unit.
- Each lesson: a URL-safe stableId (kebab-case slug, unique within the plan), title, one-line summary, and 2-4 learning objectives.
- summary: 1-2 sentences describing what the path covers and who it suits.
- Tailor the depth to the topic: a programming language needs fundamentals → intermediate → advanced → projects; a tool/framework can be shorter.`,
  });
}

export async function generateLessonContent(input: {
  topic: string;
  moduleTitle: string;
  lessonTitle: string;
  objectives: string[];
  lessonSummary: string;
}): Promise<LessonContent> {
  const { model, providerKind } = await getActiveModel();
  return generateStructured({
    model,
    schema: lessonContentSchema,
    providerKind,
    prompt: `You are an expert teacher creating interactive lesson content for someone learning "${input.topic}".

Module: ${input.moduleTitle}
Lesson: ${input.lessonTitle}
Summary: ${input.lessonSummary}
Objectives:
${input.objectives.map((o) => `- ${o}`).join("\n")}

Produce:
1. content: A complete, well-structured lesson in GitHub-flavored markdown (600-1200 words). Use headings, code blocks with language tags, examples, and a short recap. Teach, don't just list facts.
2. quiz: 3-5 multiple-choice questions testing the objectives. 4 options each, exactly one correct. Include a brief explanation for each.
3. challenges: 1-3 hands-on challenges.
   - "code": learner writes code. ONLY use executable testCases when language is javascript/typescript. The runtime is a bare Web Worker: plain JavaScript only — NO JSX, NO imports/requires, NO DOM, NO browser or Node APIs. A minimal React.createElement global is provided — for React topics instruct the learner to use it directly instead of JSX. Each testCase.expression is a JS boolean expression evaluated after the learner's code runs in the same scope, e.g. 'typeof add === "function" && add(2,3) === 5'. starterCode should guide them and must be runnable plain JavaScript (no TypeScript type annotations, no JSX).
   - "output_prediction": show code in instructions, learner types what it prints. Set expectedOutput exactly.
   - "freeform": open-ended exercise, graded by AI. Leave testCases empty.
   For non-JavaScript topics prefer output_prediction and freeform challenges.
4. flashcards: 3-6 cards (front = term/question, back = concise answer) covering key concepts.`,
  });
}

export async function regeneratePlan(input: {
  topic: string;
  currentOutline: Outline;
}): Promise<Regen> {
  const { model, providerKind } = await getActiveModel();
  return generateStructured({
    model,
    schema: regenSchema,
    providerKind,
    prompt: `You are an expert curriculum designer updating an existing lesson plan for "${input.topic}".

Current plan (JSON):
${JSON.stringify(input.currentOutline, null, 2)}

Task: review the plan against current best practices and recent developments in "${input.topic}". Update it where the field has evolved — new features, deprecated approaches, better learning order, missing important topics. Don't churn for its own sake; a good plan needs few changes.

Rules:
- PRESERVE stableId for any lesson that teaches the same underlying concept — learner progress is keyed to it. Only invent new stableIds for genuinely new lessons.
- Same for modules: reuse the existing module stableId when the module covers the same topic.
- Set changed=true only on lessons whose content should be regenerated because the material changed.
- You may add/remove/reorder modules and lessons.
- changeNotes: concise markdown summary of what changed and why (this is shown to the learner).`,
  });
}
