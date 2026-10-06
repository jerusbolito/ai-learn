"use client";

import { useEffect, useState } from "react";

interface Stats {
  totalXp: number;
  level: number;
  xpIntoLevel: number;
  xpForNextLevel: number;
  currentStreak: number;
}

export function StatsBar() {
  const [stats, setStats] = useState<Stats | null>(null);

  useEffect(() => {
    let cancelled = false;
    const load = () =>
      fetch("/api/stats")
        .then((r) => (r.ok ? r.json() : null))
        .then((d) => !cancelled && setStats(d))
        .catch(() => null);
    load();
    // Re-fetch when the user navigates back to the tab (cheap refresh)
    const onFocus = () => load();
    window.addEventListener("focus", onFocus);
    return () => {
      cancelled = true;
      window.removeEventListener("focus", onFocus);
    };
  }, []);

  if (!stats) return <div className="h-8 w-48" />;

  return (
    <div className="hidden items-center gap-4 text-xs sm:flex">
      <div className="flex items-center gap-1.5" title={`${stats.totalXp} total XP`}>
        <span className="text-amber-400">⚡</span>
        <span className="font-semibold">Lv {stats.level}</span>
        <span className="text-zinc-500">
          {stats.xpIntoLevel}/{stats.xpForNextLevel} XP
        </span>
      </div>
      <div
        className="h-1.5 w-20 rounded-full bg-zinc-800"
        title="Progress to next level"
      >
        <div
          className="h-1.5 rounded-full bg-amber-400 transition-all"
          style={{
            width: `${Math.min(100, (stats.xpIntoLevel / stats.xpForNextLevel) * 100)}%`,
          }}
        />
      </div>
      <div className="flex items-center gap-1" title="Daily streak">
        <span>🔥</span>
        <span className="font-semibold">{stats.currentStreak}</span>
      </div>
    </div>
  );
}
