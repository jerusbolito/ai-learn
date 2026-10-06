import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { regeneratePlan, getActiveModel } from "@/lib/llm";

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const path = await db.learningPath.findUnique({
    where: { id },
    include: { modules: { include: { lessons: true } } },
  });
  if (!path) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (path.status !== "ready") {
    return NextResponse.json(
      { error: "Path is not ready" },
      { status: 400 }
    );
  }

  let provider = "";
  try {
    provider = (await getActiveModel()).provider;
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 400 }
    );
  }

  const currentOutline = {
    summary: path.summary,
    modules: path.modules
      .sort((a, b) => a.order - b.order)
      .map((m) => ({
        stableId: m.stableId,
        title: m.title,
        description: m.description,
        lessons: m.lessons
          .sort((a, b) => a.order - b.order)
          .map((l) => ({
            stableId: l.stableId,
            title: l.title,
            summary: l.summary,
            objectives: JSON.parse(l.objectives || "[]") as string[],
          })),
      })),
  };

  try {
    const regen = await regeneratePlan({
      topic: path.topic,
      currentOutline,
    });
    const newVersion = path.version + 1;
    const now = new Date();

    // Snapshot the new version with notes on what changed.
    await db.planVersion.create({
      data: {
        pathId: path.id,
        version: newVersion,
        snapshot: JSON.stringify(regen),
        changeNotes: regen.changeNotes,
      },
    });

    const oldModules = path.modules;
    const oldLessons = oldModules.flatMap((m) => m.lessons);
    const keptModuleStableIds = new Set(regen.modules.map((m) => m.stableId));
    const keptLessonStableIds = new Set(
      regen.modules.flatMap((m) => m.lessons.map((l) => l.stableId))
    );

    // Upsert modules by stableId.
    const moduleIdByStableId = new Map<string, string>();
    for (const [mi, mod] of regen.modules.entries()) {
      const existing = oldModules.find((m) => m.stableId === mod.stableId);
      const data = {
        order: mi,
        title: mod.title,
        description: mod.description,
      };
      const row = existing
        ? await db.module.update({ where: { id: existing.id }, data })
        : await db.module.create({
            data: { ...data, pathId: path.id, stableId: mod.stableId },
          });
      moduleIdByStableId.set(mod.stableId, row.id);
    }

    // Upsert lessons by stableId (re-parent to their module first, so that
    // deleting un-matched old modules only removes un-carried lessons).
    for (const [mi, mod] of regen.modules.entries()) {
      const moduleId = moduleIdByStableId.get(mod.stableId)!;
      for (const [li, lesson] of mod.lessons.entries()) {
        const existing = oldLessons.find(
          (l) => l.stableId === lesson.stableId
        );
        const base = {
          moduleId,
          order: li,
          title: lesson.title,
          summary: lesson.summary,
          objectives: JSON.stringify(lesson.objectives),
        };
        if (existing) {
          if (lesson.changed) {
            await db.challenge.deleteMany({ where: { lessonId: existing.id } });
            await db.flashcard.deleteMany({
              where: { lessonId: existing.id },
            });
          }
          await db.lesson.update({
            where: { id: existing.id },
            data: lesson.changed
              ? { ...base, content: "", contentGenerated: false }
              : base,
          });
        } else {
          await db.lesson.create({
            data: { ...base, stableId: lesson.stableId },
          });
        }
        void mi;
      }
    }

    // Remove modules/lessons that no longer exist in the updated plan.
    await db.module.deleteMany({
      where: { pathId: path.id, stableId: { notIn: [...keptModuleStableIds] } },
    });
    await db.lesson.deleteMany({
      where: {
        module: { pathId: path.id },
        stableId: { notIn: [...keptLessonStableIds] },
      },
    });

    const updated = await db.learningPath.update({
      where: { id: path.id },
      data: {
        version: newVersion,
        summary: regen.summary,
        providerUsed: provider,
        lastRegeneratedAt: now,
      },
    });

    return NextResponse.json({
      id: updated.id,
      version: updated.version,
      changeNotes: regen.changeNotes,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
