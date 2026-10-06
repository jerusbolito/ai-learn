import { NextResponse } from "next/server";
import { generateInterview } from "@/lib/llm";

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const topic = typeof body.topic === "string" ? body.topic.trim() : "";
  if (!topic || topic.length < 2 || topic.length > 200) {
    return NextResponse.json(
      { error: "Topic must be 2-200 characters" },
      { status: 400 }
    );
  }
  try {
    const interview = await generateInterview(topic);
    return NextResponse.json(interview);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 502 }
    );
  }
}
