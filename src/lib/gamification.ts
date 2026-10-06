import { db } from "@/lib/db";

export const XP = {
  LESSON_COMPLETE: 50,
  QUIZ_PER_CORRECT: 10,
  QUIZ_PERFECT_BONUS: 25,
  CHALLENGE_SOLVED: 30,
  FLASHCARD_REVIEW: 2,
} as const;

/** Cumulative XP required to *reach* a level. Level 1=0, 2=100, 3=300, 4=600, 5=1000... */
export function xpForLevel(level: number): number {
  return 50 * level * (level - 1);
}

export function levelForXp(totalXp: number) {
  let level = 1;
  while (totalXp >= xpForLevel(level + 1)) level++;
  const currentLevelXp = xpForLevel(level);
  const nextLevelXp = xpForLevel(level + 1);
  return {
    level,
    currentLevelXp,
    nextLevelXp,
    xpIntoLevel: totalXp - currentLevelXp,
    xpForNextLevel: nextLevelXp - currentLevelXp,
  };
}

export function todayKey(d = new Date()): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate()
  ).padStart(2, "0")}`;
}

export function nextStreak(
  lastActivityDate: string,
  currentStreak: number,
  today: string
): number {
  if (lastActivityDate === today) return Math.max(currentStreak, 1);
  const last = Date.parse(lastActivityDate);
  const now = Date.parse(today);
  if (!Number.isNaN(last) && !Number.isNaN(now)) {
    const days = Math.round((now - last) / 86_400_000);
    if (days === 1) return currentStreak + 1;
  }
  return 1;
}

export const BADGES: { id: string; name: string; description: string }[] = [
  { id: "first-lesson", name: "First Steps", description: "Complete your first lesson" },
  { id: "first-quiz", name: "Quiz Taker", description: "Complete your first quiz" },
  { id: "perfect-quiz", name: "Perfect Score", description: "Score 100% on a quiz" },
  { id: "first-challenge", name: "Challenger", description: "Solve your first challenge" },
  { id: "module-complete", name: "Module Master", description: "Finish every lesson in a module" },
  { id: "path-complete", name: "Path Finisher", description: "Finish an entire learning path" },
  { id: "streak-3", name: "Warming Up", description: "Learn 3 days in a row" },
  { id: "streak-7", name: "On Fire", description: "Learn 7 days in a row" },
  { id: "streak-30", name: "Unstoppable", description: "Learn 30 days in a row" },
  { id: "xp-500", name: "Scholar", description: "Earn 500 XP" },
  { id: "xp-2000", name: "Sage", description: "Earn 2,000 XP" },
];

export async function ensureBadges() {
  for (const b of BADGES) {
    await db.badge.upsert({ where: { id: b.id }, create: b, update: {} });
  }
}

export async function getStats() {
  const stats = await db.userStats.upsert({
    where: { id: "singleton" },
    create: { id: "singleton" },
    update: {},
  });
  return stats;
}

async function unlock(badgeId: string, unlocked: Set<string>, out: string[]) {
  if (unlocked.has(badgeId) || !BADGES.some((b) => b.id === badgeId)) return;
  await db.userBadge.create({ data: { badgeId } });
  unlocked.add(badgeId);
  out.push(badgeId);
}

/**
 * Award XP, bump the daily streak, and check badges.
 * `checks` lets callers assert which event badges to evaluate.
 */
export async function awardXp(
  xp: number,
  checks: {
    lessonCompleted?: boolean;
    quizCompleted?: boolean;
    quizPerfect?: boolean;
    challengeSolved?: boolean;
    moduleCompleted?: boolean;
    pathCompleted?: boolean;
  } = {}
): Promise<{ totalXp: number; level: number; streak: number; newBadges: string[] }> {
  await ensureBadges();
  const stats = await getStats();
  const today = todayKey();
  const streak = nextStreak(stats.lastActivityDate, stats.currentStreak, today);
  const totalXp = stats.totalXp + xp;
  const updated = await db.userStats.update({
    where: { id: "singleton" },
    data: {
      totalXp,
      currentStreak: streak,
      longestStreak: Math.max(stats.longestStreak, streak),
      lastActivityDate: today,
    },
  });

  const earned = await db.userBadge.findMany({ select: { badgeId: true } });
  const unlocked = new Set(earned.map((e) => e.badgeId));
  const newBadges: string[] = [];

  if (checks.lessonCompleted) await unlock("first-lesson", unlocked, newBadges);
  if (checks.quizCompleted) await unlock("first-quiz", unlocked, newBadges);
  if (checks.quizPerfect) await unlock("perfect-quiz", unlocked, newBadges);
  if (checks.challengeSolved) await unlock("first-challenge", unlocked, newBadges);
  if (checks.moduleCompleted) await unlock("module-complete", unlocked, newBadges);
  if (checks.pathCompleted) await unlock("path-complete", unlocked, newBadges);
  if (streak >= 3) await unlock("streak-3", unlocked, newBadges);
  if (streak >= 7) await unlock("streak-7", unlocked, newBadges);
  if (streak >= 30) await unlock("streak-30", unlocked, newBadges);
  if (totalXp >= 500) await unlock("xp-500", unlocked, newBadges);
  if (totalXp >= 2000) await unlock("xp-2000", unlocked, newBadges);

  return {
    totalXp: updated.totalXp,
    level: levelForXp(updated.totalXp).level,
    streak: updated.currentStreak,
    newBadges,
  };
}
