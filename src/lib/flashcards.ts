export type ReviewQuality = "again" | "good" | "easy";

export interface ReviewSchedule {
  intervalDays: number;
  ease: number;
  nextReviewAt: Date;
}

/** SM-2-inspired scheduling for flashcard reviews. */
export function scheduleReview(
  quality: ReviewQuality,
  intervalDays: number,
  ease: number,
  now = new Date()
): ReviewSchedule {
  let interval = intervalDays;
  let e = ease;
  if (quality === "again") {
    interval = 0;
    e = Math.max(1.3, e - 0.2);
  } else if (quality === "good") {
    interval = interval <= 0 ? 1 : Math.round(interval * e);
  } else {
    interval = interval <= 0 ? 4 : Math.max(4, Math.round(interval * e * 1.3));
    e = Math.min(3.0, e + 0.15);
  }
  return {
    intervalDays: interval,
    ease: e,
    nextReviewAt: new Date(now.getTime() + interval * 86_400_000),
  };
}
