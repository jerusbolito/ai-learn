import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { isProviderKind, PROVIDER_KINDS, slugifyProvider } from "@/lib/providers";
import { parseModels } from "@/lib/llm";

type ProviderRow = {
  id: string;
  slug: string;
  label: string;
  kind: string;
  baseUrl: string;
  apiKey: string;
  models: string;
  defaultModel: string;
};

export function maskProvider(p: ProviderRow) {
  return {
    id: p.id,
    slug: p.slug,
    label: p.label,
    kind: p.kind,
    kindLabel: PROVIDER_KINDS[p.kind as keyof typeof PROVIDER_KINDS]?.label ?? p.kind,
    baseUrl: p.baseUrl,
    hasKey: p.apiKey.length > 0,
    keyPreview: p.apiKey ? p.apiKey.slice(-4) : "",
    defaultModel: p.defaultModel,
    models: parseModels(p.models),
  };
}

export function normalizeModels(input: unknown): string[] {
  const list = Array.isArray(input)
    ? input
    : typeof input === "string"
      ? input.split(/[\n,]+/)
      : [];
  return [...new Set(list.map((m) => String(m).trim()).filter(Boolean))];
}

function validBaseUrl(url: string): boolean {
  try {
    const u = new URL(url);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}

export async function GET() {
  const providers = await db.provider.findMany({
    orderBy: { createdAt: "asc" },
  });
  return NextResponse.json(providers.map(maskProvider));
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const label = typeof body.label === "string" ? body.label.trim() : "";
  const kind = typeof body.kind === "string" ? body.kind : "";
  const baseUrl = typeof body.baseUrl === "string" ? body.baseUrl.trim() : "";
  const apiKey = typeof body.apiKey === "string" ? body.apiKey.trim() : "";
  const models = normalizeModels(body.models);
  const defaultModel =
    typeof body.defaultModel === "string" && body.defaultModel.trim()
      ? body.defaultModel.trim()
      : models[0] || "";

  if (!label || label.length > 60) {
    return NextResponse.json(
      { error: "A provider name is required" },
      { status: 400 }
    );
  }
  if (!isProviderKind(kind)) {
    return NextResponse.json({ error: "Invalid provider type" }, { status: 400 });
  }
  const kindMeta = PROVIDER_KINDS[kind];
  if (kindMeta.requiresBaseUrl && !validBaseUrl(baseUrl)) {
    return NextResponse.json(
      { error: "This provider type needs a valid base URL (http/https)" },
      { status: 400 }
    );
  }
  if (baseUrl && !validBaseUrl(baseUrl)) {
    return NextResponse.json({ error: "Invalid base URL" }, { status: 400 });
  }
  if (kindMeta.requiresKey && apiKey.length < 8) {
    return NextResponse.json({ error: "API key is required" }, { status: 400 });
  }

  // Unique slug derived from the label.
  const base = slugifyProvider(label);
  let slug = base;
  for (let i = 2; await db.provider.findUnique({ where: { slug } }); i++) {
    slug = `${base}-${i}`;
  }

  const provider = await db.provider.create({
    data: {
      slug,
      label,
      kind,
      baseUrl,
      apiKey,
      models: JSON.stringify(models),
      defaultModel,
    },
  });
  return NextResponse.json(maskProvider(provider));
}
