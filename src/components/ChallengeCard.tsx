"use client";

import { useState } from "react";
import { Button, Card, Pill, Spinner, Textarea } from "@/components/ui";
import { Markdown } from "@/components/Markdown";
import { runInSandbox } from "@/lib/sandbox";
import type { LessonChallenge } from "./LessonView";

interface Payload {
  title?: string;
  instructions?: string;
  language?: string;
  starterCode?: string;
  testCases?: { name: string; expression: string }[];
  expectedOutput?: string;
}

export function ChallengeCard({
  challenge,
  onSolved,
}: {
  challenge: LessonChallenge;
  onSolved: () => void;
}) {
  const p = challenge.payload as Payload;
  const [code, setCode] = useState(p.starterCode ?? "");
  const [submission, setSubmission] = useState("");
  const [busy, setBusy] = useState(false);
  const [output, setOutput] = useState<string | null>(null);
  const [runError, setRunError] = useState<string | null>(null);
  const [results, setResults] = useState<
    { name: string; passed: boolean; error?: string }[] | null
  >(null);
  const [feedback, setFeedback] = useState("");
  const [solved, setSolved] = useState(challenge.completed);

  async function markSolved() {
    setSolved(true);
    onSolved();
    await fetch(`/api/challenges/${challenge.id}/complete`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ passed: true }),
    });
  }

  async function runCode() {
    setBusy(true);
    setFeedback("");
    const tests = p.testCases ?? [];
    const res = await runInSandbox(code, tests);
    setOutput(res.output);
    setRunError(
      res.error && /unexpected token|jsx|unexpected identifier/i.test(res.error)
        ? `${res.error}\nHint: the sandbox runs plain JavaScript — use React.createElement(type, props, ...children) instead of JSX.`
        : (res.error ?? null)
    );
    setResults(res.results);
    setBusy(false);
    if (!res.error && tests.length > 0 && res.results.every((r) => r.passed)) {
      await markSolved();
    } else if (!res.error && tests.length === 0) {
      // No tests: running cleanly counts as a pass
      await markSolved();
    }
  }

  async function checkPrediction() {
    const expected = (p.expectedOutput ?? "").trim();
    const given = submission.trim();
    if (given === expected) {
      setFeedback("Correct!");
      await markSolved();
    } else {
      setFeedback(
        expected
          ? "Not quite — check your answer against what the code actually does."
          : "Submitted."
      );
    }
  }

  async function gradeFreeform() {
    setBusy(true);
    setFeedback("");
    const res = await fetch(`/api/challenges/${challenge.id}/grade`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ submission }),
    });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) {
      setFeedback(data.error ?? "Grading failed");
      return;
    }
    setFeedback(data.feedback ?? "");
    if (data.passed) await markSolved();
  }

  const icons: Record<string, string> = {
    code: "💻",
    output_prediction: "🔮",
    freeform: "✍️",
  };

  return (
    <Card>
      <div className="mb-2 flex items-center justify-between">
        <h2 className="font-semibold">
          {icons[challenge.type] ?? "🏆"} {p.title || challenge.title}
        </h2>
        {solved && <Pill color="green">✓ +30 XP</Pill>}
      </div>
      {p.instructions && (
        <Markdown content={p.instructions} className="text-sm" />
      )}

      {challenge.type === "code" && (
        <div className="mt-3 space-y-3">
          <Textarea
            className="min-h-40 font-mono text-xs"
            spellCheck={false}
            value={code}
            onChange={(e) => setCode(e.target.value)}
          />
          <div className="flex items-center gap-3">
            <Button onClick={runCode} disabled={busy || !code.trim()}>
              {busy ? <Spinner /> : "▶ Run tests"}
            </Button>
            {(p.language === "javascript" || p.language === "typescript") && (
              <span className="text-xs text-zinc-500">
                runs in a sandboxed worker in your browser
              </span>
            )}
          </div>
          {runError && (
            <pre className="rounded-lg border border-red-800 bg-red-500/10 p-3 text-xs text-red-300">
              {runError}
            </pre>
          )}
          {output !== null && output !== "" && (
            <pre className="rounded-lg border border-zinc-800 bg-zinc-950 p-3 text-xs text-zinc-300">
              {output}
            </pre>
          )}
          {results && results.length > 0 && (
            <ul className="space-y-1 text-sm">
              {results.map((r, i) => (
                <li key={i} className={r.passed ? "text-emerald-400" : "text-red-400"}>
                  {r.passed ? "✓" : "✗"} {r.name}
                  {r.error && <span className="text-zinc-500"> — {r.error}</span>}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {challenge.type === "output_prediction" && (
        <div className="mt-3 space-y-3">
          <Textarea
            className="min-h-20 font-mono text-xs"
            placeholder="What does the code output?"
            value={submission}
            onChange={(e) => setSubmission(e.target.value)}
          />
          <Button onClick={checkPrediction} disabled={!submission.trim() || solved}>
            Check answer
          </Button>
        </div>
      )}

      {challenge.type === "freeform" && (
        <div className="mt-3 space-y-3">
          <Textarea
            className="min-h-28"
            placeholder="Write your answer / code / explanation here…"
            value={submission}
            onChange={(e) => setSubmission(e.target.value)}
          />
          <div className="flex items-center gap-3">
            <Button
              onClick={gradeFreeform}
              disabled={busy || !submission.trim() || solved}
            >
              {busy ? <Spinner /> : "Submit for AI review"}
            </Button>
            <span className="text-xs text-zinc-500">graded by the LLM</span>
          </div>
        </div>
      )}

      {feedback && (
        <Markdown content={feedback} className="mt-3 text-sm text-zinc-300" />
      )}
    </Card>
  );
}
