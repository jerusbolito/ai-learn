import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { PROVIDER_KINDS, type ProviderKind } from "@/lib/providers";

export async function GET() {
  const settings = await db.appSettings.upsert({
    where: { id: "singleton" },
    create: { id: "singleton" },
    update: {},
  });
  return NextResponse.json(settings);
}

export async function PATCH(req: Request) {
  const body = await req.json().catch(() => ({}));
  const { activeProvider, activeModel } = body as {
    activeProvider?: string;
    activeModel?: string;
  };

  if (activeProvider !== undefined && activeProvider !== "") {
    const provider = await db.provider.findUnique({
      where: { slug: activeProvider },
    });
    if (!provider) {
      return NextResponse.json({ error: "Unknown provider" }, { status: 400 });
    }
    const kind = PROVIDER_KINDS[provider.kind as ProviderKind];
    if (kind?.requiresKey && !provider.apiKey) {
      return NextResponse.json(
        { error: `Add an API key for ${provider.label} before activating it` },
        { status: 400 }
      );
    }
  }

  const settings = await db.appSettings.upsert({
    where: { id: "singleton" },
    create: { id: "singleton" },
    update: {},
  });
  const updated = await db.appSettings.update({
    where: { id: settings.id },
    data: {
      ...(activeProvider !== undefined ? { activeProvider } : {}),
      ...(activeModel !== undefined ? { activeModel } : {}),
    },
  });
  return NextResponse.json(updated);
}
