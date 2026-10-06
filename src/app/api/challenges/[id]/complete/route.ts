import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { awardXp, XP } from "@/lib/gamification";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  if (body.passed !== true) {
    return NextResponse.json({ ok: true, xp: 0 });
  }

  const challenge = await db.challenge.findUnique({
    where: { id },
    include: { progress: true },
  });
  if (!challenge) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (challenge.progress.length > 0) {
    return NextResponse.json({ alreadyCompleted: true, xp: 0 });
  }

  await db.progress.create({
    data: {
      lessonId: challenge.lessonId,
      challengeId: challenge.id,
      xpEarned: XP.CHALLENGE_SOLVED,
    },
  });
  const result = await awardXp(XP.CHALLENGE_SOLVED, { challengeSolved: true });
  return NextResponse.json({ xp: XP.CHALLENGE_SOLVED, ...result });
}
