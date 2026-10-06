"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Button, Card, Pill, Spinner } from "@/components/ui";
import { Markdown } from "@/components/Markdown";
import { QuizCard } from "@/components/QuizCard";
import { ChallengeCard } from "@/components/ChallengeCard";
import { FlashcardDeck } from "@/components/FlashcardDeck";

export interface LessonChallenge {
  id: string;
  type: string;
  title: string;
  payload: Record<string, unknown>;
  completed: boolean;
}

export interface LessonData {
  id: string;
  title: string;
  summary: string;
  objectives: string[];
  content: string;
  contentGenerated: boolean;
  completed: boolean;
  pathId: string;
  pathTopic: string;
  moduleTitle: string;
  challenges: LessonChallenge[];
  flashcards: { id: string; front: string; back: string; nextReviewAt: string }[];
  flashcardTotal: number;
}

export function LessonView({ initial }: { initial: LessonData }) {
  const [lesson, setLesson] = useState(initial);
  const [generating, setGenerating] = useState(!initial.contentGenerated);
  const [genError, setGenError] = useState("");
  const [quizResult, setQuizResult] = useState<{
    correct: number;
    total: number;
  } | null>(null);
  const [completing, setCompleting] = useState(false);
  const [reward, setReward] = useState<{
    xp: number;
    newBadges?: string[];
  } | null>(null);

  const refresh = useCallback(async () => {
    const res = await fetch(`/api/lessons/${lesson.id}`);
    if (res.ok) setLesson(await res.json());
  }, [lesson.id]);

  useEffect(() => {
    if (lesson.contentGenerated || genError) return;
    let cancelled = false;
    (async () => {
      const res = await fetch(`/api/lessons/${lesson.id}/generate`, {
        method: "POST",
      });
      if (cancelled) return;
      if (res.ok) {
        await refresh();
      } else {
        const data = await res.json().catch(() => ({}));
        setGenError(data.error ?? "Content generation failed");
      }
      setGenerating(false);
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lesson.id, lesson.contentGenerated, genError]);

  async function completeLesson() {
    setCompleting(true);
    const res = await fetch(`/api/lessons/${lesson.id}/complete`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        quizCorrect: quizResult?.correct ?? 0,
        quizTotal: quizResult?.total ?? 0,
      }),
    });
    const data = await res.json().catch(() => ({}));
    setCompleting(false);
    if (res.ok) {
      setReward({ xp: data.xp ?? 0, newBadges: data.newBadges });
      setLesson((l) => ({ ...l, completed: true }));
    }
  }

  const quiz = lesson.challenges.find((c) => c.type === "quiz");
  const handsOn = lesson.challenges.filter((c) => c.type !== "quiz");

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs text-zinc-500">
          <Link href={`/paths/${lesson.pathId}`} className="hover:text-indigo-300">
            ← {lesson.pathTopic}
          </Link>
          <span className="mx-2">·</span>
          {lesson.moduleTitle}
        </p>
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <h1 className="text-3xl font-bold">{lesson.title}</h1>
          {lesson.completed && <Pill color="green">✓ completed</Pill>}
        </div>
        {lesson.objectives.length > 0 && (
          <div className="mt-3">
            <p className="text-xs font-medium text-zinc-400">
              You&apos;ll learn to:
            </p>
            <ul className="mt-1 list-disc pl-5 text-sm text-zinc-300">
              {lesson.objectives.map((o, i) => (
                <li key={i}>{o}</li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {generating && (
        <Card className="py-12 text-center">
          <Spinner className="mx-auto mb-3 h-6 w-6" />
          <p className="text-sm text-zinc-400">
            The AI is writing your lesson — content, quiz, and challenges.
            This only happens once per lesson.
          </p>
        </Card>
      )}
      {genError && (
        <Card className="border-red-800 bg-red-500/10">
          <p className="text-sm text-red-300">{genError}</p>
          <Button
            variant="secondary"
            className="mt-3"
            onClick={() => {
              setGenerating(true);
              setGenError("");
            }}
          >
            Retry
          </Button>
        </Card>
      )}

      {lesson.contentGenerated && (
        <>
          <Card>
            <Markdown content={lesson.content} />
          </Card>

          {quiz && (
            <QuizCard
              challenge={quiz}
              onResult={(correct, total) => setQuizResult({ correct, total })}
            />
          )}

          {handsOn.map((c) => (
            <ChallengeCard
              key={c.id}
              challenge={c}
              onSolved={() =>
                setLesson((l) => ({
                  ...l,
                  challenges: l.challenges.map((x) =>
                    x.id === c.id ? { ...x, completed: true } : x
                  ),
                }))
              }
            />
          ))}

          {lesson.flashcardTotal > 0 && (
            <FlashcardDeck
              cards={lesson.flashcards}
              total={lesson.flashcardTotal}
            />
          )}

          <Card className="flex flex-wrap items-center justify-between gap-3">
            <div className="text-sm text-zinc-400">
              {lesson.completed
                ? "Lesson complete — nice work!"
                : "Finished reading and tried the activities?"}
            </div>
            {reward ? (
              <Pill color="amber">+{reward.xp} XP earned</Pill>
            ) : lesson.completed ? (
              <Pill color="green">✓ Done</Pill>
            ) : (
              <Button onClick={completeLesson} disabled={completing}>
                {completing ? <Spinner /> : "Mark lesson complete"}
              </Button>
            )}
          </Card>
        </>
      )}
    </div>
  );
}
