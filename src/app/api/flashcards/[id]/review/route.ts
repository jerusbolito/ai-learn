import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { awardXp, XP } from "@/lib/gamification";
import { scheduleReview, type ReviewQuality } from "@/lib/flashcards";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const quality = body.quality as ReviewQuality;
  if (!["again", "good", "easy"].includes(quality)) {
    return NextResponse.json({ error: "Invalid quality" }, { status: 400 });
  }

  const card = await db.flashcard.findUnique({ where: { id } });
  if (!card) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const next = scheduleReview(quality, card.intervalDays, card.ease);
  const updated = await db.flashcard.update({
    where: { id },
    data: next,
  });
  const stats = await awardXp(XP.FLASHCARD_REVIEW);
  return NextResponse.json({
    id: updated.id,
    nextReviewAt: updated.nextReviewAt,
    intervalDays: updated.intervalDays,
    xp: XP.FLASHCARD_REVIEW,
    ...stats,
  });
}
