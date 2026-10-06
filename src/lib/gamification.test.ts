import { describe, expect, it } from "vitest";
import {
  levelForXp,
  nextStreak,
  todayKey,
  xpForLevel,
} from "./gamification";

// gamification.ts imports the db — stub it so pure functions can be tested
// without a database connection being constructed.
import { vi } from "vitest";
vi.mock("@/lib/db", () => ({ db: {} }));

describe("xpForLevel / levelForXp", () => {
  it("level 1 requires 0 xp, level 2 requires 100", () => {
    expect(xpForLevel(1)).toBe(0);
    expect(xpForLevel(2)).toBe(100);
    expect(xpForLevel(3)).toBe(300);
    expect(xpForLevel(4)).toBe(600);
  });

  it("computes level boundaries correctly", () => {
    expect(levelForXp(0).level).toBe(1);
    expect(levelForXp(99).level).toBe(1);
    expect(levelForXp(100).level).toBe(2);
    expect(levelForXp(299).level).toBe(2);
    expect(levelForXp(300).level).toBe(3);
    expect(levelForXp(1000).level).toBe(5);
  });

  it("reports progress within the level", () => {
    const l = levelForXp(150); // level 2: 100..300
    expect(l.level).toBe(2);
    expect(l.xpIntoLevel).toBe(50);
    expect(l.xpForNextLevel).toBe(200);
  });
});

describe("nextStreak", () => {
  it("same day keeps streak", () => {
    expect(nextStreak("2026-10-04", 5, "2026-10-04")).toBe(5);
  });
  it("consecutive day increments", () => {
    expect(nextStreak("2026-10-03", 5, "2026-10-04")).toBe(6);
  });
  it("gap resets to 1", () => {
    expect(nextStreak("2026-10-01", 5, "2026-10-04")).toBe(1);
  });
  it("first activity starts at 1", () => {
    expect(nextStreak("", 0, "2026-10-04")).toBe(1);
  });
});

describe("todayKey", () => {
  it("formats YYYY-MM-DD", () => {
    expect(todayKey(new Date(2026, 9, 4))).toBe("2026-10-04");
  });
});
