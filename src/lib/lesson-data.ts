import { db } from "@/lib/db";

/** Loads a lesson with everything the lesson viewer needs. */
export async function getLessonData(lessonId: string) {
  const lesson = await db.lesson.findUnique({
    where: { id: lessonId },
    include: {
      module: { include: { path: true } },
      challenges: { include: { progress: true } },
      flashcards: true,
      progress: true,
    },
  });
  if (!lesson) return null;

  const now = Date.now();
  return {
    id: lesson.id,
    title: lesson.title,
    summary: lesson.summary,
    objectives: JSON.parse(lesson.objectives || "[]") as string[],
    content: lesson.content,
    contentGenerated: lesson.contentGenerated,
    completed: lesson.progress.length > 0,
    pathId: lesson.module.path.id,
    pathTopic: lesson.module.path.topic,
    moduleTitle: lesson.module.title,
    moduleId: lesson.module.id,
    challenges: lesson.challenges.map((c) => ({
      id: c.id,
      type: c.type,
      title: c.title,
      payload: JSON.parse(c.payload || "{}") as Record<string, unknown>,
      completed: c.progress.length > 0,
    })),
    flashcards: lesson.flashcards
      .filter((f) => f.nextReviewAt.getTime() <= now)
      .map((f) => ({
        id: f.id,
        front: f.front,
        back: f.back,
        nextReviewAt: f.nextReviewAt.toISOString(),
      })),
    flashcardTotal: lesson.flashcards.length,
  };
}
