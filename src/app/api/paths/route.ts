import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import {
  generateOutline,
  getActiveModel,
  type OutlineContext,
} from "@/lib/llm";
import type { InterviewAnswers, Outline } from "@/lib/llm/schemas";

export async function GET() {
  const paths = await db.learningPath.findMany({
    orderBy: { updatedAt: "desc" },
    include: {
      modules: { include: { lessons: { include: { progress: true } } } },
      prereqFor: { select: { topic: true } },
    },
  });
  return NextResponse.json(
    paths.map((p) => {
      const lessons = p.modules.flatMap((m) => m.lessons);
      const completed = lessons.filter((l) => l.progress.length > 0).length;
      return {
        id: p.id,
        topic: p.topic,
        summary: p.summary,
        status: p.status,
        version: p.version,
        prereqFor: p.prereqFor?.topic ?? null,
        createdAt: p.createdAt,
        totalLessons: lessons.length,
        completedLessons: completed,
      };
    })
  );
}

function parseInterview(input: unknown): InterviewAnswers {
  if (!input || typeof input !== "object") return {};
  const i = input as Record<string, unknown>;
  return {
    skillLevel: typeof i.skillLevel === "string" ? i.skillLevel : undefined,
    prerequisites: Array.isArray(i.prerequisites)
      ? i.prerequisites
          .filter(
            (p) =>
              p && typeof p === "object" && typeof (p as { topic: unknown }).topic === "string"
          )
          .map((p) => ({
            topic: (p as { topic: string }).topic.slice(0, 100),
            known: Boolean((p as { known: unknown }).known),
          }))
      : undefined,
    answers: Array.isArray(i.answers)
      ? i.answers
          .filter(
            (a) =>
              a &&
              typeof a === "object" &&
              typeof (a as { question: unknown }).question === "string"
          )
          .map((a) => ({
            question: (a as { question: string }).question.slice(0, 300),
            answer: String((a as { answer: unknown }).answer ?? "").slice(0, 300),
          }))
      : undefined,
  };
}

async function applyOutline(pathId: string, outline: Outline) {
  for (const [mi, mod] of outline.modules.entries()) {
    await db.module.create({
      data: {
        pathId,
        stableId: mod.stableId,
        order: mi,
        title: mod.title,
        description: mod.description,
        lessons: {
          create: mod.lessons.map((l, li) => ({
            stableId: l.stableId,
            order: li,
            title: l.title,
            summary: l.summary,
            objectives: JSON.stringify(l.objectives),
          })),
        },
      },
    });
  }
  await db.learningPath.update({
    where: { id: pathId },
    data: { status: "ready", summary: outline.summary },
  });
}

// Fire-and-forget: generate outlines for prerequisite paths sequentially.
// The dev/prod server is long-running, so this outlives the response.
async function generatePrereqPaths(ids: string[], forTopic: string) {
  for (const id of ids) {
    const path = await db.learningPath.findUnique({ where: { id } });
    if (!path) continue;
    try {
      const outline = await generateOutline(path.topic, {
        isPrereqFor: forTopic,
      });
      await applyOutline(id, outline);
    } catch (err) {
      await db.learningPath.update({
        where: { id },
        data: {
          status: "failed",
          error: err instanceof Error ? err.message : String(err),
        },
      });
    }
  }
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const topic = typeof body.topic === "string" ? body.topic.trim() : "";
  if (!topic || topic.length < 2 || topic.length > 200) {
    return NextResponse.json(
      { error: "Topic must be 2-200 characters" },
      { status: 400 }
    );
  }
  const interview = parseInterview(body.interview);
  const generatePrereqs = body.generatePrereqs !== false;

  // Ensure an active provider exists before creating anything.
  let provider = "";
  try {
    provider = (await getActiveModel()).provider;
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 400 }
    );
  }

  const context: OutlineContext = {
    skillLevel: interview.skillLevel,
    knownPrereqs: interview.prerequisites
      ?.filter((p) => p.known)
      .map((p) => p.topic),
    missingPrereqs: interview.prerequisites
      ?.filter((p) => !p.known)
      .map((p) => p.topic),
    answers: interview.answers,
  };

  const path = await db.learningPath.create({
    data: {
      topic,
      status: "generating",
      providerUsed: provider,
      interview: JSON.stringify(interview),
    },
  });

  try {
    const outline = await generateOutline(topic, context);
    await applyOutline(path.id, outline);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await db.learningPath.update({
      where: { id: path.id },
      data: { status: "failed", error: message },
    });
    return NextResponse.json(
      { id: path.id, status: "failed", error: message },
      { status: 502 }
    );
  }

  // Create/link prerequisite paths for topics the learner doesn't know.
  const prereqIds: string[] = [];
  const missing = context.missingPrereqs ?? [];
  if (generatePrereqs && missing.length) {
    const existing = await db.learningPath.findMany({
      select: { id: true, topic: true, status: true, prereqForId: true },
    });
    const toGenerate: string[] = [];
    for (const prereqTopic of missing) {
      const dupe = existing.find(
        (p) =>
          p.topic.toLowerCase() === prereqTopic.toLowerCase() &&
          p.status !== "failed"
      );
      if (dupe) {
        // Reuse an existing path on the same topic instead of regenerating.
        if (!dupe.prereqForId) {
          await db.learningPath.update({
            where: { id: dupe.id },
            data: { prereqForId: path.id },
          });
        }
        prereqIds.push(dupe.id);
        continue;
      }
      const created = await db.learningPath.create({
        data: {
          topic: prereqTopic,
          status: "generating",
          providerUsed: provider,
          prereqForId: path.id,
        },
      });
      prereqIds.push(created.id);
      toGenerate.push(created.id);
    }
    if (toGenerate.length) void generatePrereqPaths(toGenerate, topic);
  }

  return NextResponse.json({ id: path.id, status: "ready", prereqIds });
}
