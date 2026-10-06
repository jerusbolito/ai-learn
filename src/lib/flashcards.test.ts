import { describe, expect, it } from "vitest";
import { scheduleReview } from "./flashcards";

const NOW = new Date("2026-10-04T12:00:00Z");

describe("scheduleReview", () => {
  it("again resets interval and lowers ease (min 1.3)", () => {
    const r = scheduleReview("again", 10, 2.5, NOW);
    expect(r.intervalDays).toBe(0);
    expect(r.ease).toBeCloseTo(2.3);
    expect(r.nextReviewAt.getTime()).toBe(NOW.getTime());
    const floor = scheduleReview("again", 5, 1.4, NOW);
    expect(floor.ease).toBe(1.3);
  });

  it("good on a new card schedules 1 day", () => {
    const r = scheduleReview("good", 0, 2.5, NOW);
    expect(r.intervalDays).toBe(1);
    expect(r.nextReviewAt.getTime()).toBe(NOW.getTime() + 86_400_000);
  });

  it("good multiplies existing interval by ease", () => {
    expect(scheduleReview("good", 4, 2.5, NOW).intervalDays).toBe(10);
  });

  it("easy on a new card schedules 4 days and raises ease", () => {
    const r = scheduleReview("easy", 0, 2.5, NOW);
    expect(r.intervalDays).toBe(4);
    expect(r.ease).toBeCloseTo(2.65);
  });

  it("easy grows interval faster and caps ease at 3.0", () => {
    const r = scheduleReview("easy", 10, 2.95, NOW);
    expect(r.intervalDays).toBe(38); // round(10 * 2.95 * 1.3)
    expect(r.ease).toBe(3.0);
  });
});
