import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { BADGES, ensureBadges, getStats, levelForXp } from "@/lib/gamification";

export async function GET() {
  await ensureBadges();
  const stats = await getStats();
  const earned = await db.userBadge.findMany({
    include: { badge: true },
    orderBy: { unlockedAt: "asc" },
  });
  const [lessonsCompleted, paths, dueFlashcards] = await Promise.all([
    db.progress.count({ where: { challengeId: null } }),
    db.learningPath.count(),
    db.flashcard.count({ where: { nextReviewAt: { lte: new Date() } } }),
  ]);
  const level = levelForXp(stats.totalXp);
  return NextResponse.json({
    totalXp: stats.totalXp,
    level: level.level,
    xpIntoLevel: level.xpIntoLevel,
    xpForNextLevel: level.xpForNextLevel,
    currentStreak: stats.currentStreak,
    longestStreak: stats.longestStreak,
    lessonsCompleted,
    paths,
    dueFlashcards,
    badges: BADGES.map((b) => ({
      ...b,
      unlocked: earned.some((e) => e.badgeId === b.id),
      unlockedAt: earned.find((e) => e.badgeId === b.id)?.unlockedAt ?? null,
    })),
  });
}
