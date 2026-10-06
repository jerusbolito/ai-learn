import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { maskProvider, normalizeModels } from "../route";

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const data: Record<string, string> = {};

  if (typeof body.label === "string" && body.label.trim()) {
    data.label = body.label.trim().slice(0, 60);
  }
  if (typeof body.baseUrl === "string") {
    data.baseUrl = body.baseUrl.trim();
  }
  if (typeof body.apiKey === "string" && body.apiKey.trim()) {
    data.apiKey = body.apiKey.trim();
  }
  if (typeof body.defaultModel === "string") {
    data.defaultModel = body.defaultModel.trim();
  }
  if (body.models !== undefined) {
    data.models = JSON.stringify(normalizeModels(body.models));
  }
  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
  }
  const provider = await db.provider
    .update({ where: { id }, data })
    .catch(() => null);
  if (!provider) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json(maskProvider(provider));
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const provider = await db.provider.findUnique({ where: { id } });
  if (!provider) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  await db.provider.delete({ where: { id } });

  // If the deleted provider was active, clear active settings.
  const settings = await db.appSettings.findUnique({
    where: { id: "singleton" },
  });
  if (settings?.activeProvider === provider.slug) {
    await db.appSettings.update({
      where: { id: "singleton" },
      data: { activeProvider: "", activeModel: "" },
    });
  }
  return NextResponse.json({ ok: true });
}
