import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { generateLessonContent } from "@/lib/llm";

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const lesson = await db.lesson.findUnique({
    where: { id },
    include: { module: { include: { path: true } } },
  });
  if (!lesson) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (lesson.contentGenerated) {
    return NextResponse.json({ id: lesson.id, alreadyGenerated: true });
  }

  try {
    const gen = await generateLessonContent({
      topic: lesson.module.path.topic,
      moduleTitle: lesson.module.title,
      lessonTitle: lesson.title,
      lessonSummary: lesson.summary,
      objectives: JSON.parse(lesson.objectives || "[]") as string[],
    });

    // Idempotent: clear any partial data from a previous attempt.
    await db.challenge.deleteMany({ where: { lessonId: lesson.id } });
    await db.flashcard.deleteMany({ where: { lessonId: lesson.id } });

    await db.challenge.create({
      data: {
        lessonId: lesson.id,
        type: "quiz",
        title: gen.quiz.title,
        payload: JSON.stringify({ title: gen.quiz.title, questions: gen.quiz.questions }),
      },
    });
    for (const ch of gen.challenges) {
      await db.challenge.create({
        data: {
          lessonId: lesson.id,
          type: ch.type,
          title: ch.title,
          payload: JSON.stringify(ch),
        },
      });
    }
    for (const f of gen.flashcards) {
      await db.flashcard.create({
        data: { lessonId: lesson.id, front: f.front, back: f.back },
      });
    }
    await db.lesson.update({
      where: { id: lesson.id },
      data: { content: gen.content, contentGenerated: true },
    });

    return NextResponse.json({ id: lesson.id, generated: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
