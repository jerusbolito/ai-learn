import { NextResponse } from "next/server";
import { getLessonData } from "@/lib/lesson-data";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const lesson = await getLessonData(id);
  if (!lesson) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json(lesson);
}
