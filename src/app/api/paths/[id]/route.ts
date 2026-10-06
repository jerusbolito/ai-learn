import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const path = await db.learningPath.findUnique({
    where: { id },
    include: {
      modules: {
        orderBy: { order: "asc" },
        include: {
          lessons: {
            orderBy: { order: "asc" },
            include: { progress: true },
          },
        },
      },
      versions: { orderBy: { version: "desc" } },
    },
  });
  if (!path) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json({
    id: path.id,
    topic: path.topic,
    summary: path.summary,
    status: path.status,
    error: path.error,
    version: path.version,
    providerUsed: path.providerUsed,
    lastRegeneratedAt: path.lastRegeneratedAt,
    createdAt: path.createdAt,
    modules: path.modules.map((m) => ({
      id: m.id,
      title: m.title,
      description: m.description,
      order: m.order,
      lessons: m.lessons.map((l) => ({
        id: l.id,
        stableId: l.stableId,
        title: l.title,
        summary: l.summary,
        objectives: JSON.parse(l.objectives || "[]") as string[],
        completed: l.progress.length > 0,
      })),
    })),
    versions: path.versions.map((v) => ({
      version: v.version,
      changeNotes: v.changeNotes,
      createdAt: v.createdAt,
    })),
  });
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  await db.learningPath.delete({ where: { id } }).catch(() => null);
  return NextResponse.json({ ok: true });
}
