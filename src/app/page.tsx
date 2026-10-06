import Link from "next/link";
import { db } from "@/lib/db";
import { ensureBadges, getStats, levelForXp, BADGES } from "@/lib/gamification";
import { Card, Pill, ProgressBar } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function Dashboard() {
  await ensureBadges();
  const [stats, paths, earned, dueFlashcards] = await Promise.all([
    getStats(),
    db.learningPath.findMany({
      orderBy: { updatedAt: "desc" },
      include: {
        modules: { include: { lessons: { include: { progress: true } } } },
        prereqFor: { select: { topic: true } },
      },
    }),
    db.userBadge.findMany(),
    db.flashcard.count({ where: { nextReviewAt: { lte: new Date() } } }),
  ]);

  const level = levelForXp(stats.totalXp);
  const earnedIds = new Set(earned.map((e) => e.badgeId));
  const lessonsCompleted = await db.progress.count({
    where: { challengeId: null },
  });
  const hasCredentials = (await db.provider.count()) > 0;

  return (
    <div className="space-y-8">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-3xl font-bold">Dashboard</h1>
          <p className="mt-1 text-sm text-zinc-400">
            Your AI-powered learning journey
          </p>
        </div>
        <Link
          href="/paths/new"
          className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500"
        >
          + New Learning Path
        </Link>
      </div>

      {!hasCredentials && (
        <Card className="border-amber-800 bg-amber-500/10">
          <p className="text-sm text-amber-200">
            You haven&apos;t added an LLM API key yet.{" "}
            <Link href="/settings" className="font-medium underline">
              Add one in Settings
            </Link>{" "}
            to generate your first learning path.
          </p>
        </Card>
      )}

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Card>
          <p className="text-xs text-zinc-400">Level</p>
          <p className="mt-1 text-2xl font-bold text-amber-400">
            {level.level}
          </p>
          <p className="mt-1 text-xs text-zinc-500">
            {level.xpIntoLevel}/{level.xpForNextLevel} XP to next
          </p>
          <ProgressBar
            value={level.xpIntoLevel / level.xpForNextLevel}
            className="mt-2"
          />
        </Card>
        <Card>
          <p className="text-xs text-zinc-400">Total XP</p>
          <p className="mt-1 text-2xl font-bold">{stats.totalXp}</p>
        </Card>
        <Card>
          <p className="text-xs text-zinc-400">Streak</p>
          <p className="mt-1 text-2xl font-bold">
            🔥 {stats.currentStreak}
            <span className="ml-1 text-xs font-normal text-zinc-500">
              best {stats.longestStreak}
            </span>
          </p>
        </Card>
        <Card>
          <p className="text-xs text-zinc-400">Lessons done</p>
          <p className="mt-1 text-2xl font-bold">{lessonsCompleted}</p>
          {dueFlashcards > 0 && (
            <p className="mt-1 text-xs text-indigo-300">
              {dueFlashcards} flashcards due
            </p>
          )}
        </Card>
      </div>

      <section>
        <h2 className="mb-3 text-lg font-semibold">Learning paths</h2>
        {paths.length === 0 ? (
          <Card className="py-10 text-center">
            <p className="text-zinc-400">
              No learning paths yet. Tell the AI what you want to learn!
            </p>
            <Link
              href="/paths/new"
              className="mt-4 inline-block rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500"
            >
              Create your first path
            </Link>
          </Card>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            {paths.map((p) => {
              const lessons = p.modules.flatMap((m) => m.lessons);
              const done = lessons.filter((l) => l.progress.length > 0).length;
              return (
                <Link key={p.id} href={`/paths/${p.id}`}>
                  <Card className="h-full transition-colors hover:border-indigo-700">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <h3 className="font-semibold">{p.topic}</h3>
                        {p.prereqFor && (
                          <p className="mt-0.5 text-xs text-amber-300/80">
                            prereq for {p.prereqFor.topic}
                          </p>
                        )}
                      </div>
                      <Pill
                        color={
                          p.status === "ready"
                            ? "green"
                            : p.status === "failed"
                              ? "red"
                              : "amber"
                        }
                      >
                        {p.status}
                      </Pill>
                    </div>
                    {p.summary && (
                      <p className="mt-2 line-clamp-2 text-sm text-zinc-400">
                        {p.summary}
                      </p>
                    )}
                    <div className="mt-4 flex items-center justify-between text-xs text-zinc-500">
                      <span>
                        {done}/{lessons.length} lessons
                      </span>
                      <span>v{p.version}</span>
                    </div>
                    <ProgressBar
                      value={lessons.length ? done / lessons.length : 0}
                      className="mt-2"
                    />
                  </Card>
                </Link>
              );
            })}
          </div>
        )}
      </section>

      <section>
        <h2 className="mb-3 text-lg font-semibold">Badges</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {BADGES.map((b) => {
            const unlocked = earnedIds.has(b.id);
            return (
              <div
                key={b.id}
                className={`rounded-xl border p-3 ${
                  unlocked
                    ? "border-amber-800 bg-amber-500/10"
                    : "border-zinc-800 bg-zinc-900/40 opacity-50"
                }`}
                title={b.description}
              >
                <p className="text-sm font-medium">
                  {unlocked ? "🏅" : "🔒"} {b.name}
                </p>
                <p className="mt-0.5 text-xs text-zinc-400">{b.description}</p>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}
