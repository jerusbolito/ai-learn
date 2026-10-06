import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { listProviderModels } from "@/lib/llm";

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const provider = await db.provider.findUnique({ where: { id } });
  if (!provider) {
    return NextResponse.json({ error: "Provider not found" }, { status: 404 });
  }
  try {
    const models = await listProviderModels(provider);
    const merged = [
      ...new Set([provider.defaultModel, ...models].filter(Boolean)),
    ];
    await db.provider.update({
      where: { id },
      data: { models: JSON.stringify(merged) },
    });
    return NextResponse.json({ models: merged });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 502 }
    );
  }
}
