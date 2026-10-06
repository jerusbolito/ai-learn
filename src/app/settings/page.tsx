import { db } from "@/lib/db";
import { PROVIDER_PRESETS } from "@/lib/providers";
import { parseModels } from "@/lib/llm";
import { PROVIDER_KINDS } from "@/lib/providers";
import { SettingsClient } from "@/components/SettingsClient";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const [providers, settings] = await Promise.all([
    db.provider.findMany({ orderBy: { createdAt: "asc" } }),
    db.appSettings.upsert({
      where: { id: "singleton" },
      create: { id: "singleton" },
      update: {},
    }),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Settings</h1>
        <p className="mt-1 text-sm text-zinc-400">
          Manage your LLM providers. Anything that speaks the OpenAI,
          Anthropic, or Gemini API works — cloud or local. Keys are stored in
          your local database.
        </p>
      </div>
      <SettingsClient
        presets={PROVIDER_PRESETS}
        kindLabels={Object.fromEntries(
          Object.entries(PROVIDER_KINDS).map(([k, v]) => [k, v.label])
        )}
        providers={providers.map((p) => ({
          id: p.id,
          slug: p.slug,
          label: p.label,
          kind: p.kind,
          baseUrl: p.baseUrl,
          hasKey: p.apiKey.length > 0,
          keyPreview: p.apiKey ? p.apiKey.slice(-4) : "",
          defaultModel: p.defaultModel,
          models: parseModels(p.models),
        }))}
        settings={{
          activeProvider: settings.activeProvider,
          activeModel: settings.activeModel,
        }}
      />
    </div>
  );
}
