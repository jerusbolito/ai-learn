import { notFound } from "next/navigation";
import { getLessonData } from "@/lib/lesson-data";
import { LessonView } from "@/components/LessonView";

export const dynamic = "force-dynamic";

export default async function LessonPage({
  params,
}: {
  params: Promise<{ id: string; lessonId: string }>;
}) {
  const { lessonId } = await params;
  const lesson = await getLessonData(lessonId);
  if (!lesson) notFound();

  return <LessonView initial={lesson} />;
}
