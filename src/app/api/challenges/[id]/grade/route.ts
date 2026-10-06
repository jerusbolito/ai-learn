import { NextResponse } from "next/server";
import { generateObject } from "ai";
import { z } from "zod";
import { db } from "@/lib/db";
import { getActiveModel } from "@/lib/llm";

const verdictSchema = z.object({
  passed: z.boolean(),
  feedback: z
    .string()
    .describe("Short, encouraging feedback (1-3 sentences, markdown ok)"),
});

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const submission = typeof body.submission === "string" ? body.submission : "";
  if (!submission.trim()) {
    return NextResponse.json(
      { error: "Submission is required" },
      { status: 400 }
    );
  }

  const challenge = await db.challenge.findUnique({
    where: { id },
    include: { lesson: { include: { module: { include: { path: true } } } } },
  });
  if (!challenge) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const payload = JSON.parse(challenge.payload || "{}") as {
    instructions?: string;
    title?: string;
  };

  try {
    const { model } = await getActiveModel();
    const { object } = await generateObject({
      model,
      schema: verdictSchema,
      prompt: `You are grading a learner's answer for the topic "${challenge.lesson.module.path.topic}".

Challenge: ${payload.title ?? challenge.title}
Instructions: ${payload.instructions ?? ""}

Learner's submission:
"""
${submission}
"""

Decide if the submission reasonably satisfies the instructions. Be encouraging but honest — pass only genuinely adequate attempts, and give brief constructive feedback either way.`,
      maxRetries: 2,
    });
    return NextResponse.json(object);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
