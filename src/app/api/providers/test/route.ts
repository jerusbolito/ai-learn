import { NextResponse } from "next/server";
import { testCredential, parseModels } from "@/lib/llm";
import { db } from "@/lib/db";
import { isProviderKind } from "@/lib/providers";

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const { providerId, kind, baseUrl, apiKey, model } = body as {
    providerId?: string;
    kind?: string;
    baseUrl?: string;
    apiKey?: string;
    model?: string;
  };

  let config: { slug: string; kind: string; baseUrl: string; apiKey: string };
  let modelName = model;

  if (providerId) {
    const provider = await db.provider.findUnique({
      where: { id: providerId },
    });
    if (!provider) {
      return NextResponse.json({ error: "Provider not found" }, { status: 404 });
    }
    config = provider;
    modelName = modelName || provider.defaultModel || parseModels(provider.models)[0];
  } else {
    if (!kind || !isProviderKind(kind)) {
      return NextResponse.json({ error: "Invalid provider type" }, { status: 400 });
    }
    config = {
      slug: "test",
      kind,
      baseUrl: baseUrl ?? "",
      apiKey: apiKey ?? "",
    };
  }

  const result = await testCredential(config, modelName);
  return NextResponse.json(result, { status: result.ok ? 200 : 502 });
}
