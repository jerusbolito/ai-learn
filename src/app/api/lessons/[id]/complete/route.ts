import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { awardXp, XP } from "@/lib/gamification";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const quizCorrect = Number.isInteger(body.quizCorrect) ? body.quizCorrect : 0;
  const quizTotal = Number.isInteger(body.quizTotal) ? body.quizTotal : 0;

  const lesson = await db.lesson.findUnique({
    where: { id },
    include: {
      progress: true,
      module: {
        include: {
          lessons: { include: { progress: true } },
          path: { include: { modules: { include: { lessons: { include: { progress: true } } } } } },
        },
      },
    },
  });
  if (!lesson) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (lesson.progress.length > 0) {
    return NextResponse.json({ alreadyCompleted: true, xp: 0 });
  }

  const perfect = quizTotal > 0 && quizCorrect === quizTotal;
  const xp =
    XP.LESSON_COMPLETE +
    XP.QUIZ_PER_CORRECT * quizCorrect +
    (perfect ? XP.QUIZ_PERFECT_BONUS : 0);

  await db.progress.create({
    data: { lessonId: lesson.id, score: quizCorrect, xpEarned: xp },
  });

  const moduleCompleted = lesson.module.lessons.every(
    (l) => l.id === lesson.id || l.progress.length > 0
  );
  const pathCompleted = lesson.module.path.modules.every((m) =>
    m.lessons.every((l) => l.id === lesson.id || l.progress.length > 0)
  );

  const result = await awardXp(xp, {
    lessonCompleted: true,
    quizCompleted: quizTotal > 0,
    quizPerfect: perfect,
    moduleCompleted,
    pathCompleted,
  });

  return NextResponse.json({ xp, moduleCompleted, pathCompleted, ...result });
}
