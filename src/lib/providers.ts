// Provider "kinds" describe the wire protocol a provider speaks.
// Any service that exposes one of these APIs can be added in Settings —
// the actual list of providers lives in the `Provider` DB table, not here.

export const PROVIDER_KINDS = {
  openai: {
    label: "OpenAI",
    requiresKey: true,
    requiresBaseUrl: false,
    defaultBaseUrl: "https://api.openai.com/v1",
  },
  anthropic: {
    label: "Anthropic",
    requiresKey: true,
    requiresBaseUrl: false,
    defaultBaseUrl: "https://api.anthropic.com",
  },
  google: {
    label: "Google Gemini",
    requiresKey: true,
    requiresBaseUrl: false,
    defaultBaseUrl: "https://generativelanguage.googleapis.com",
  },
  "openai-compatible": {
    label: "OpenAI-compatible",
    requiresKey: false,
    requiresBaseUrl: true,
    defaultBaseUrl: "",
  },
} as const;

export type ProviderKind = keyof typeof PROVIDER_KINDS;

export function isProviderKind(value: string): value is ProviderKind {
  return value in PROVIDER_KINDS;
}

export interface ProviderPreset {
  label: string;
  kind: ProviderKind;
  baseUrl: string;
  keyHint: string;
  defaultModel: string;
  models: string[];
}

// Convenience presets for the "add provider" form. Not a whitelist —
// pick "Custom" to configure any OpenAI-compatible endpoint, and use
// "Fetch models" on a saved provider to refresh its model list.
export const PROVIDER_PRESETS: ProviderPreset[] = [
  {
    label: "OpenAI",
    kind: "openai",
    baseUrl: "",
    keyHint: "sk-...",
    defaultModel: "gpt-4o-mini",
    models: ["gpt-4o-mini", "gpt-4o", "gpt-4.1-mini", "gpt-4.1"],
  },
  {
    label: "Anthropic",
    kind: "anthropic",
    baseUrl: "",
    keyHint: "sk-ant-...",
    defaultModel: "claude-haiku-4-5",
    models: [
      "claude-haiku-4-5",
      "claude-sonnet-4-5",
      "claude-3-5-haiku-latest",
      "claude-3-7-sonnet-latest",
    ],
  },
  {
    label: "Google Gemini",
    kind: "google",
    baseUrl: "",
    keyHint: "AIza...",
    defaultModel: "gemini-2.0-flash",
    models: ["gemini-2.0-flash", "gemini-2.5-flash", "gemini-2.5-pro"],
  },
  {
    label: "DeepSeek",
    kind: "openai-compatible",
    baseUrl: "https://api.deepseek.com/v1",
    keyHint: "sk-...",
    defaultModel: "deepseek-chat",
    models: ["deepseek-chat", "deepseek-reasoner"],
  },
  {
    label: "Groq",
    kind: "openai-compatible",
    baseUrl: "https://api.groq.com/openai/v1",
    keyHint: "gsk_...",
    defaultModel: "llama-3.3-70b-versatile",
    models: ["llama-3.3-70b-versatile", "llama-3.1-8b-instant"],
  },
  {
    label: "Mistral",
    kind: "openai-compatible",
    baseUrl: "https://api.mistral.ai/v1",
    keyHint: "API key",
    defaultModel: "mistral-small-latest",
    models: [
      "mistral-small-latest",
      "mistral-medium-latest",
      "mistral-large-latest",
    ],
  },
  {
    label: "xAI",
    kind: "openai-compatible",
    baseUrl: "https://api.x.ai/v1",
    keyHint: "xai-...",
    defaultModel: "grok-3-mini",
    models: ["grok-3-mini", "grok-3", "grok-4"],
  },
  {
    label: "OpenRouter",
    kind: "openai-compatible",
    baseUrl: "https://openrouter.ai/api/v1",
    keyHint: "sk-or-...",
    defaultModel: "openai/gpt-4o-mini",
    models: [
      "openai/gpt-4o-mini",
      "anthropic/claude-sonnet-4.5",
      "google/gemini-2.5-flash",
      "deepseek/deepseek-chat-v3.1",
      "meta-llama/llama-3.3-70b-instruct",
    ],
  },
  {
    label: "Together AI",
    kind: "openai-compatible",
    baseUrl: "https://api.together.xyz/v1",
    keyHint: "API key",
    defaultModel: "meta-llama/Llama-3.3-70B-Instruct-Turbo",
    models: [
      "meta-llama/Llama-3.3-70B-Instruct-Turbo",
      "Qwen/Qwen2.5-72B-Instruct-Turbo",
      "deepseek-ai/DeepSeek-V3.1",
    ],
  },
  {
    label: "Ollama (local)",
    kind: "openai-compatible",
    baseUrl: "http://localhost:11434/v1",
    keyHint: "no key needed",
    defaultModel: "",
    models: [],
  },
  {
    label: "LM Studio (local)",
    kind: "openai-compatible",
    baseUrl: "http://localhost:1234/v1",
    keyHint: "no key needed",
    defaultModel: "",
    models: [],
  },
];

export function slugifyProvider(label: string): string {
  const slug = label
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return slug || "provider";
}
