"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Card, Input, Pill, Select, Spinner } from "@/components/ui";

interface SavedProvider {
  id: string;
  slug: string;
  label: string;
  kind: string;
  baseUrl: string;
  hasKey: boolean;
  keyPreview: string;
  defaultModel: string;
  models: string[];
}

interface Preset {
  label: string;
  kind: string;
  baseUrl: string;
  keyHint: string;
  defaultModel: string;
  models: string[];
}

export function SettingsClient({
  providers,
  presets,
  kindLabels,
  settings,
}: {
  providers: SavedProvider[];
  presets: Preset[];
  kindLabels: Record<string, string>;
  settings: { activeProvider: string; activeModel: string };
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<Record<string, string>>({});

  // Active model input (free text — new model ids always work)
  const [modelInput, setModelInput] = useState(settings.activeModel);

  // Form state for adding a new provider
  const [presetIdx, setPresetIdx] = useState(0);
  const [form, setForm] = useState({
    label: presets[0]?.label ?? "",
    kind: presets[0]?.kind ?? "openai-compatible",
    baseUrl: presets[0]?.baseUrl ?? "",
    apiKey: "",
    defaultModel: presets[0]?.defaultModel ?? "",
    models: (presets[0]?.models ?? []).join(", "),
  });

  // Inline editing of existing keys
  const [editing, setEditing] = useState<Record<string, string>>({});

  const setMsg = (key: string, msg: string) =>
    setMessage((m) => ({ ...m, [key]: msg }));

  async function api(url: string, init?: RequestInit) {
    const res = await fetch(url, {
      headers: { "Content-Type": "application/json" },
      ...init,
    });
    const data = await res.json().catch(() => ({}));
    return { ok: res.ok, data };
  }

  function applyPreset(idx: number) {
    setPresetIdx(idx);
    const p = presets[idx];
    if (!p) return;
    setForm((f) => ({
      ...f,
      label: p.label,
      kind: p.kind,
      baseUrl: p.baseUrl,
      defaultModel: p.defaultModel,
      models: p.models.join(", "),
    }));
  }

  async function saveProvider() {
    setBusy("save");
    const { ok, data } = await api("/api/providers", {
      method: "POST",
      body: JSON.stringify({
        label: form.label,
        kind: form.kind,
        baseUrl: form.baseUrl,
        apiKey: form.apiKey,
        defaultModel: form.defaultModel,
        models: form.models,
      }),
    });
    setBusy(null);
    if (ok) {
      setForm((f) => ({ ...f, apiKey: "" }));
      setMsg("save", `Saved ${form.label}.`);
      router.refresh();
    } else {
      setMsg("save", data.error ?? "Failed to save");
    }
  }

  async function testProvider(opts: Record<string, string | undefined>) {
    const busyKey = `test-${opts.providerId ?? "new"}`;
    setBusy(busyKey);
    const { ok, data } = await api("/api/providers/test", {
      method: "POST",
      body: JSON.stringify(opts),
    });
    setBusy(null);
    setMsg(
      busyKey,
      ok ? "✓ Connection works" : `✗ ${data.error ?? "Connection failed"}`
    );
  }

  async function updateProvider(id: string, patch: Record<string, string>) {
    setBusy(`update-${id}`);
    const { ok, data } = await api(`/api/providers/${id}`, {
      method: "PATCH",
      body: JSON.stringify(patch),
    });
    setBusy(null);
    setMsg(`update-${id}`, ok ? "✓ Updated" : `✗ ${data.error}`);
    if (ok) {
      setEditing((e) => ({ ...e, [id]: "" }));
      router.refresh();
    }
  }

  async function deleteProvider(id: string) {
    if (!confirm("Delete this provider and its key?")) return;
    setBusy(`delete-${id}`);
    await api(`/api/providers/${id}`, { method: "DELETE" });
    setBusy(null);
    router.refresh();
  }

  async function fetchModels(id: string) {
    setBusy(`models-${id}`);
    const { ok, data } = await api(`/api/providers/${id}/models`, {
      method: "POST",
    });
    setBusy(null);
    setMsg(
      `models-${id}`,
      ok ? `✓ ${data.models?.length ?? 0} models` : `✗ ${data.error}`
    );
    if (ok) router.refresh();
  }

  async function setActive(provider: string, model: string) {
    setBusy("active");
    const { ok, data } = await api("/api/settings", {
      method: "PATCH",
      body: JSON.stringify({ activeProvider: provider, activeModel: model }),
    });
    setBusy(null);
    if (!ok) setMsg("active", `✗ ${data.error ?? "Failed"}`);
    else setMsg("active", "");
    router.refresh();
  }

  const activeMeta = providers.find((p) => p.slug === settings.activeProvider);

  return (
    <div className="space-y-6">
      {/* Active provider selection */}
      <Card>
        <h2 className="mb-1 font-semibold">Active provider</h2>
        <p className="mb-4 text-sm text-zinc-400">
          All lesson generation uses this provider and model. Type any model
          id — suggestions come from the provider&apos;s model list.
        </p>
        <div className="flex flex-wrap items-center gap-3">
          <Select
            value={settings.activeProvider}
            onChange={(e) => {
              setModelInput("");
              setActive(e.target.value, "");
            }}
            disabled={busy === "active"}
          >
            <option value="">— choose provider —</option>
            {providers.map((p) => (
              <option key={p.id} value={p.slug}>
                {p.label}
              </option>
            ))}
          </Select>
          <Input
            className="w-64"
            placeholder={
              activeMeta?.defaultModel ||
              activeMeta?.models[0] ||
              "model id, e.g. gpt-4o-mini"
            }
            value={modelInput}
            onChange={(e) => setModelInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && settings.activeProvider) {
                setActive(settings.activeProvider, modelInput.trim());
              }
            }}
            list="active-model-suggestions"
            disabled={!settings.activeProvider || busy === "active"}
          />
          <datalist id="active-model-suggestions">
            {(activeMeta?.models ?? []).map((m) => (
              <option key={m} value={m} />
            ))}
          </datalist>
          <Button
            variant="secondary"
            onClick={() =>
              settings.activeProvider &&
              setActive(settings.activeProvider, modelInput.trim())
            }
            disabled={!settings.activeProvider || busy === "active"}
          >
            Set model
          </Button>
          {busy === "active" && <Spinner />}
          {settings.activeProvider && (
            <Pill color="green">active: {settings.activeProvider}</Pill>
          )}
          {message.active && (
            <span className="text-xs text-red-400">{message.active}</span>
          )}
        </div>
      </Card>

      {/* Existing providers */}
      <section className="space-y-3">
        <h2 className="font-semibold">Saved providers</h2>
        {providers.length === 0 && (
          <p className="text-sm text-zinc-500">
            No providers yet — add one below.
          </p>
        )}
        {providers.map((p) => (
          <Card key={p.id} className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-medium">{p.label}</span>
                <Pill>{kindLabels[p.kind] ?? p.kind}</Pill>
                {p.hasKey ? (
                  <Pill>•••{p.keyPreview}</Pill>
                ) : (
                  <Pill color="amber">no key</Pill>
                )}
                {p.baseUrl && <Pill>{p.baseUrl}</Pill>}
                {p.defaultModel && (
                  <Pill color="indigo">{p.defaultModel}</Pill>
                )}
              </div>
              <Button
                variant="danger"
                onClick={() => deleteProvider(p.id)}
                disabled={busy === `delete-${p.id}`}
              >
                Delete
              </Button>
            </div>
            {p.models.length > 0 && (
              <p className="text-xs text-zinc-500">
                {p.models.length} model{p.models.length === 1 ? "" : "s"}:{" "}
                {p.models.slice(0, 8).join(", ")}
                {p.models.length > 8 ? ", …" : ""}
              </p>
            )}
            <div className="flex flex-wrap items-center gap-2">
              <Input
                className="max-w-xs"
                placeholder={
                  p.hasKey ? "Paste new key to replace" : "Paste API key"
                }
                type="password"
                value={editing[p.id] ?? ""}
                onChange={(e) =>
                  setEditing((s) => ({ ...s, [p.id]: e.target.value }))
                }
              />
              <Button
                variant="secondary"
                onClick={() =>
                  updateProvider(p.id, { apiKey: editing[p.id] })
                }
                disabled={!editing[p.id]?.trim() || busy === `update-${p.id}`}
              >
                {busy === `update-${p.id}` ? <Spinner /> : "Update key"}
              </Button>
              <Button
                variant="secondary"
                onClick={() => testProvider({ providerId: p.id })}
                disabled={busy === `test-${p.id}`}
              >
                {busy === `test-${p.id}` ? <Spinner /> : "Test"}
              </Button>
              <Button
                variant="secondary"
                onClick={() => fetchModels(p.id)}
                disabled={busy === `models-${p.id}`}
              >
                {busy === `models-${p.id}` ? <Spinner /> : "Fetch models"}
              </Button>
              {message[`test-${p.id}`] && (
                <span className="text-xs text-zinc-400">
                  {message[`test-${p.id}`]}
                </span>
              )}
              {message[`models-${p.id}`] && (
                <span className="text-xs text-zinc-400">
                  {message[`models-${p.id}`]}
                </span>
              )}
              {message[`update-${p.id}`] && (
                <span className="text-xs text-zinc-400">
                  {message[`update-${p.id}`]}
                </span>
              )}
            </div>
          </Card>
        ))}
      </section>

      {/* Add provider */}
      <Card>
        <h2 className="mb-1 font-semibold">Add a provider</h2>
        <p className="mb-4 text-sm text-zinc-400">
          Pick a preset to prefill the form, or choose Custom for any
          OpenAI-compatible endpoint.
        </p>
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <label className="mb-1 block text-xs text-zinc-400">Preset</label>
            <Select
              value={presetIdx}
              onChange={(e) => applyPreset(Number(e.target.value))}
            >
              {presets.map((p, i) => (
                <option key={p.label} value={i}>
                  {p.label}
                </option>
              ))}
              <option value={-1}>Custom</option>
            </Select>
          </div>
          <div>
            <label className="mb-1 block text-xs text-zinc-400">Name</label>
            <Input
              className="w-44"
              value={form.label}
              onChange={(e) => setForm({ ...form, label: e.target.value })}
            />
          </div>
          <div>
            <label className="mb-1 block text-xs text-zinc-400">API type</label>
            <Select
              value={form.kind}
              onChange={(e) => setForm({ ...form, kind: e.target.value })}
            >
              {Object.entries(kindLabels).map(([k, label]) => (
                <option key={k} value={k}>
                  {label}
                </option>
              ))}
            </Select>
          </div>
          <div className="min-w-56">
            <label className="mb-1 block text-xs text-zinc-400">
              Base URL{form.kind === "openai-compatible" ? " *" : ""}
            </label>
            <Input
              placeholder="https://api.example.com/v1"
              value={form.baseUrl}
              onChange={(e) => setForm({ ...form, baseUrl: e.target.value })}
            />
          </div>
          <div className="min-w-56 flex-1">
            <label className="mb-1 block text-xs text-zinc-400">API key</label>
            <Input
              type="password"
              placeholder={presets[presetIdx]?.keyHint ?? "API key"}
              value={form.apiKey}
              onChange={(e) => setForm({ ...form, apiKey: e.target.value })}
            />
          </div>
          <div>
            <label className="mb-1 block text-xs text-zinc-400">
              Default model
            </label>
            <Input
              className="w-56"
              placeholder="e.g. deepseek-chat"
              value={form.defaultModel}
              onChange={(e) =>
                setForm({ ...form, defaultModel: e.target.value })
              }
            />
          </div>
          <div className="min-w-64 flex-1">
            <label className="mb-1 block text-xs text-zinc-400">
              Models (comma-separated — or fetch after saving)
            </label>
            <Input
              placeholder="model-a, model-b"
              value={form.models}
              onChange={(e) => setForm({ ...form, models: e.target.value })}
            />
          </div>
          <Button
            variant="secondary"
            onClick={() =>
              testProvider({
                kind: form.kind,
                baseUrl: form.baseUrl,
                apiKey: form.apiKey,
                model: form.defaultModel || undefined,
              })
            }
            disabled={
              (form.kind !== "openai-compatible" && !form.apiKey.trim()) ||
              busy === "test-new"
            }
          >
            {busy === "test-new" ? <Spinner /> : "Test"}
          </Button>
          <Button onClick={saveProvider} disabled={busy === "save"}>
            {busy === "save" ? <Spinner /> : "Save"}
          </Button>
        </div>
        {(message["test-new"] || message.save) && (
          <p className="mt-3 text-xs text-zinc-400">
            {message["test-new"]} {message.save}
          </p>
        )}
      </Card>
    </div>
  );
}
