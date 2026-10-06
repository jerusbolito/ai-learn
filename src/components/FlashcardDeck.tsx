"use client";

import { useState } from "react";
import { Button, Card, Pill } from "@/components/ui";
import { cn } from "@/lib/cn";

interface Card_ {
  id: string;
  front: string;
  back: string;
  nextReviewAt: string;
}

export function FlashcardDeck({
  cards,
  total,
}: {
  cards: Card_[]; // due cards only (filtered server-side)
  total: number;
}) {
  const [queue, setQueue] = useState<Card_[]>(cards);
  const [flipped, setFlipped] = useState(false);
  const [done, setDone] = useState(0);
  const [xpEarned, setXpEarned] = useState(0);

  async function review(quality: "again" | "good" | "easy") {
    const card = queue[0];
    setFlipped(false);
    try {
      const res = await fetch(`/api/flashcards/${card.id}/review`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ quality }),
      });
      if (res.ok) {
        const data = await res.json();
        setXpEarned((x) => x + (data.xp ?? 0));
      }
    } catch {
      // offline or db hiccup — still advance the local queue
    }
    setQueue((q) => {
      const rest = q.slice(1);
      return quality === "again" ? [...rest, card] : rest;
    });
    if (quality !== "again") setDone((d) => d + 1);
  }

  if (queue.length === 0) {
    if (cards.length === 0 && done === 0) {
      return (
        <Card>
          <h2 className="mb-1 font-semibold">🃏 Flashcards</h2>
          <p className="text-sm text-zinc-400">
            All {total} cards are scheduled for later — nothing due right now.
          </p>
        </Card>
      );
    }
    return (
      <Card>
        <h2 className="mb-1 font-semibold">🃏 Flashcards</h2>
        <p className="text-sm text-zinc-300">
          Session complete — {done} cards reviewed
          {xpEarned > 0 && ` · +${xpEarned} XP`}.
        </p>
      </Card>
    );
  }

  const card = queue[0];
  return (
    <Card>
      <div className="mb-3 flex items-center justify-between">
        <h2 className="font-semibold">🃏 Flashcards</h2>
        <Pill>
          {queue.length} left · {done} done
          {xpEarned > 0 && ` · +${xpEarned} XP`}
        </Pill>
      </div>
      <button
        onClick={() => setFlipped((f) => !f)}
        className={cn(
          "flex min-h-32 w-full items-center justify-center rounded-xl border p-6 text-center transition-colors",
          flipped
            ? "border-indigo-700 bg-indigo-500/10"
            : "border-zinc-700 bg-zinc-900 hover:border-zinc-500"
        )}
      >
        <div>
          <p className="text-xs uppercase tracking-wide text-zinc-500">
            {flipped ? "Answer" : "Question"}
          </p>
          <p className="mt-2 text-sm">{flipped ? card.back : card.front}</p>
        </div>
      </button>
      {flipped && (
        <div className="mt-3 flex gap-2">
          <Button variant="danger" onClick={() => review("again")}>
            Again
          </Button>
          <Button variant="secondary" onClick={() => review("good")}>
            Good
          </Button>
          <Button onClick={() => review("easy")}>Easy</Button>
        </div>
      )}
      {!flipped && (
        <p className="mt-2 text-center text-xs text-zinc-500">
          Click the card to reveal the answer
        </p>
      )}
    </Card>
  );
}
