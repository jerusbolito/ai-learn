"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button, Card, Input, Pill, Spinner } from "@/components/ui";

const SUGGESTIONS = [
  "JavaScript",
  "Python",
  "Machine Learning",
  "React",
  "SQL",
  "Rust",
  "System Design",
  "Docker & Kubernetes",
];

interface Interview {
  skillQuestion: string;
  skillOptions: string[];
  prerequisites: { topic: string; description: string }[];
  questions: { question: string; options: string[] }[];
}

export default function NewPathPage() {
  const router = useRouter();
  const [topic, setTopic] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  // Interview state (step 2)
  const [interview, setInterview] = useState<Interview | null>(null);
  const [skillLevel, setSkillLevel] = useState("");
  const [known, setKnown] = useState<Record<number, boolean>>({});
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [makePrereqs, setMakePrereqs] = useState(true);

  async function api(url: string, init?: RequestInit) {
    const res = await fetch(url, {
      headers: { "Content-Type": "application/json" },
      ...init,
    });
    const data = await res.json().catch(() => ({}));
    return { ok: res.ok, data };
  }

  function errorText(err: unknown, fallback = "Generation failed") {
    return err instanceof Error ? err.message : fallback;
  }

  async function startInterview() {
    const t = topic.trim();
    if (!t) return;
    setBusy(true);
    setError("");
    const { ok, data } = await api("/api/paths/interview", {
      method: "POST",
      body: JSON.stringify({ topic: t }),
    });
    setBusy(false);
    if (ok && data.skillQuestion) {
      setInterview(data);
      setSkillLevel(data.skillOptions?.[0] ?? "");
      setKnown({});
      setAnswers({});
    } else {
      setError(data.error ?? "Could not generate interview questions");
    }
  }

  async function generate(skipInterview = false) {
    const t = topic.trim();
    if (!t) return;
    setBusy(true);
    setError("");
    const payload: Record<string, unknown> = { topic: t };
    if (!skipInterview && interview) {
      payload.interview = {
        skillLevel,
        prerequisites: interview.prerequisites.map((p, i) => ({
          topic: p.topic,
          known: Boolean(known[i]),
        })),
        answers: interview.questions.map((q, i) => ({
          question: q.question,
          answer: answers[i] ?? "",
        })),
      };
      payload.generatePrereqs = makePrereqs;
    }
    try {
      const res = await fetch("/api/paths", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (res.ok && data.id) {
        router.push(`/paths/${data.id}`);
      } else {
        setError(data.error ?? "Generation failed");
        setBusy(false);
      }
    } catch (err) {
      setError(errorText(err));
      setBusy(false);
    }
  }

  const prereqCount = interview
    ? interview.prerequisites.filter((_, i) => !known[i]).length
    : 0;

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-3xl font-bold">What do you want to learn?</h1>
        <p className="mt-1 text-sm text-zinc-400">
          The AI will build a structured lesson plan — modules, lessons,
          quizzes, and challenges — saved so you can learn at your own pace.
        </p>
      </div>

      {/* Step 1: topic */}
      <Card className="space-y-4">
        <div className="flex gap-2">
          <Input
            placeholder='e.g. "JavaScript", "Quantum Computing", "Spanish"'
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            onKeyDown={(e) =>
              e.key === "Enter" && !interview && startInterview()
            }
            disabled={busy || !!interview}
            autoFocus
          />
          {!interview && (
            <Button onClick={startInterview} disabled={!topic.trim() || busy}>
              {busy ? <Spinner /> : "Continue"}
            </Button>
          )}
        </div>
        {busy && !interview && (
          <p className="text-sm text-zinc-400">
            <Spinner className="mr-2 align-middle" />
            Preparing a few quick questions…
          </p>
        )}
        {error && (
          <div className="rounded-lg border border-red-800 bg-red-500/10 p-3 text-sm text-red-300">
            {error}{" "}
            {error.toLowerCase().includes("api key") ||
            error.toLowerCase().includes("provider") ? (
              <>
                —{" "}
                <Link href="/settings" className="underline">
                  check Settings
                </Link>
              </>
            ) : null}
          </div>
        )}
        {!interview && (
          <div>
            <p className="mb-2 text-xs text-zinc-500">Try:</p>
            <div className="flex flex-wrap gap-2">
              {SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  onClick={() => setTopic(s)}
                  disabled={busy}
                  className="rounded-full border border-zinc-700 px-3 py-1 text-xs text-zinc-300 hover:border-indigo-600 hover:text-indigo-300"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}
      </Card>

      {/* Step 2: interview */}
      {interview && (
        <Card className="space-y-6">
          <div>
            <h2 className="font-semibold">{interview.skillQuestion}</h2>
            <div className="mt-3 flex flex-wrap gap-2">
              {interview.skillOptions.map((opt) => (
                <button
                  key={opt}
                  onClick={() => setSkillLevel(opt)}
                  disabled={busy}
                  className={`rounded-full border px-3 py-1.5 text-sm transition-colors ${
                    skillLevel === opt
                      ? "border-indigo-500 bg-indigo-500/20 text-indigo-200"
                      : "border-zinc-700 text-zinc-300 hover:border-indigo-700"
                  }`}
                >
                  {opt}
                </button>
              ))}
            </div>
          </div>

          {interview.prerequisites.length > 0 && (
            <div>
              <h2 className="font-semibold">
                Which of these do you already know?
              </h2>
              <p className="mt-0.5 text-xs text-zinc-500">
                Check the ones you&apos;re comfortable with — the plan
                won&apos;t spend time on them.
              </p>
              <div className="mt-3 space-y-2">
                {interview.prerequisites.map((p, i) => (
                  <label
                    key={p.topic}
                    className={`flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition-colors ${
                      known[i]
                        ? "border-emerald-800 bg-emerald-500/10"
                        : "border-zinc-800 hover:border-zinc-700"
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={Boolean(known[i])}
                      onChange={(e) =>
                        setKnown((k) => ({ ...k, [i]: e.target.checked }))
                      }
                      disabled={busy}
                      className="mt-0.5 accent-indigo-500"
                    />
                    <span>
                      <span className="text-sm font-medium">{p.topic}</span>
                      <span className="ml-2 text-xs text-zinc-500">
                        {p.description}
                      </span>
                    </span>
                  </label>
                ))}
              </div>
            </div>
          )}

          {interview.questions.map((q, i) => (
            <div key={i}>
              <h2 className="font-semibold">{q.question}</h2>
              <div className="mt-3 flex flex-wrap gap-2">
                {q.options.map((opt) => (
                  <button
                    key={opt}
                    onClick={() => setAnswers((a) => ({ ...a, [i]: opt }))}
                    disabled={busy}
                    className={`rounded-full border px-3 py-1.5 text-sm transition-colors ${
                      answers[i] === opt
                        ? "border-indigo-500 bg-indigo-500/20 text-indigo-200"
                        : "border-zinc-700 text-zinc-300 hover:border-indigo-700"
                    }`}
                  >
                    {opt}
                  </button>
                ))}
              </div>
            </div>
          ))}

          {prereqCount > 0 && (
            <label className="flex cursor-pointer items-center gap-2 text-sm text-zinc-300">
              <input
                type="checkbox"
                checked={makePrereqs}
                onChange={(e) => setMakePrereqs(e.target.checked)}
                disabled={busy}
                className="accent-indigo-500"
              />
              Also create learning paths for the {prereqCount} prerequisite
              {prereqCount === 1 ? "" : "s"} I don&apos;t know
            </label>
          )}

          <div className="flex items-center gap-3 border-t border-zinc-800 pt-4">
            <Button onClick={() => generate()} disabled={busy}>
              {busy ? <Spinner /> : "Generate my path"}
            </Button>
            <Button
              variant="ghost"
              onClick={() => setInterview(null)}
              disabled={busy}
            >
              Back
            </Button>
            <button
              onClick={() => generate(true)}
              disabled={busy}
              className="text-xs text-zinc-500 underline hover:text-zinc-300"
            >
              skip questions — just generate
            </button>
            {makePrereqs && prereqCount > 0 && (
              <Pill color="indigo">+{prereqCount} prereq paths</Pill>
            )}
          </div>
          {busy && (
            <p className="text-sm text-zinc-400">
              <Spinner className="mr-2 align-middle" />
              Building your lesson plan — this can take 20-60 seconds
              {makePrereqs && prereqCount > 0
                ? " (prerequisite paths generate in the background)"
                : ""}
              …
            </p>
          )}
        </Card>
      )}
    </div>
  );
}
