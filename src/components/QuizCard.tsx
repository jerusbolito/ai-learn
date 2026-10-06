"use client";

import { useState } from "react";
import { Button, Card, Pill } from "@/components/ui";
import { cn } from "@/lib/cn";
import type { LessonChallenge } from "./LessonView";

interface Question {
  question: string;
  options: string[];
  correctIndex: number;
  explanation: string;
}

export function QuizCard({
  challenge,
  onResult,
}: {
  challenge: LessonChallenge;
  onResult: (correct: number, total: number) => void;
}) {
  const payload = challenge.payload as {
    title?: string;
    questions?: Question[];
  };
  const questions = payload.questions ?? [];
  const [answers, setAnswers] = useState<(number | null)[]>(
    questions.map(() => null)
  );
  const [submitted, setSubmitted] = useState(false);

  const allAnswered = answers.every((a) => a !== null);
  const correctCount = questions.reduce(
    (n, q, i) => n + (answers[i] === q.correctIndex ? 1 : 0),
    0
  );

  function submit() {
    setSubmitted(true);
    onResult(correctCount, questions.length);
  }

  return (
    <Card>
      <div className="mb-4 flex items-center justify-between">
        <h2 className="font-semibold">
          📝 {payload.title || "Knowledge check"}
        </h2>
        {submitted && (
          <Pill color={correctCount === questions.length ? "green" : "amber"}>
            {correctCount}/{questions.length} correct
          </Pill>
        )}
      </div>
      <div className="space-y-6">
        {questions.map((q, qi) => (
          <div key={qi}>
            <p className="mb-2 text-sm font-medium">
              {qi + 1}. {q.question}
            </p>
            <div className="grid gap-2 sm:grid-cols-2">
              {q.options.map((opt, oi) => {
                const selected = answers[qi] === oi;
                const isCorrect = oi === q.correctIndex;
                return (
                  <button
                    key={oi}
                    disabled={submitted}
                    onClick={() =>
                      setAnswers((a) => {
                        const next = [...a];
                        next[qi] = oi;
                        return next;
                      })
                    }
                    className={cn(
                      "rounded-lg border px-3 py-2 text-left text-sm transition-colors",
                      !submitted && selected
                        ? "border-indigo-500 bg-indigo-500/20"
                        : !submitted
                          ? "border-zinc-700 hover:border-zinc-500"
                          : isCorrect
                            ? "border-emerald-600 bg-emerald-500/15"
                            : selected
                              ? "border-red-600 bg-red-500/15"
                              : "border-zinc-800 opacity-60"
                    )}
                  >
                    {opt}
                  </button>
                );
              })}
            </div>
            {submitted && q.explanation && (
              <p className="mt-2 text-xs text-zinc-400">💡 {q.explanation}</p>
            )}
          </div>
        ))}
      </div>
      {!submitted && (
        <Button
          className="mt-4"
          onClick={submit}
          disabled={!allAnswered || questions.length === 0}
        >
          Submit answers
        </Button>
      )}
    </Card>
  );
}
