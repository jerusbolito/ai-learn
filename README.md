# LearnAI — AI-Assisted Learning Platform

A local-first learning platform. Tell it what you want to learn, plug in your
own LLM API key (OpenAI, Anthropic, Google Gemini, or any OpenAI-compatible
endpoint like DeepSeek, Groq, xAI, OpenRouter, Ollama, ...), and it generates
a structured lesson plan — modules, lessons, quizzes, coding challenges, and
flashcards — that you work through at your own pace, with XP, levels, streaks,
and badges to keep you going.

## Features

- **BYOK, any provider** — providers are configured in **Settings**, not
  hardcoded: pick a preset (OpenAI, Anthropic, Gemini, DeepSeek, Groq,
  Mistral, xAI, OpenRouter, Together, Ollama, LM Studio) or add any custom
  OpenAI-compatible endpoint with a base URL. **Fetch models** pulls the
  live model list from the provider's API; the active model is free text so
  new model ids work immediately. Keys are stored in your local database;
  switch the active provider/model anytime.
- **Generated lesson plans, cached forever** — the outline (modules → lessons)
  is generated once and saved in SQLite. Opening a path never regenerates it.
- **Lazy lesson content** — full lesson content, quiz, challenges, and
  flashcards are generated the first time you open a lesson, then cached.
- **Update with AI** — regenerate a plan against the latest developments in the
  topic. Progress is preserved via stable lesson IDs; previous versions are
  snapshotted with "what changed" notes.
- **Interactive + gamified** — multiple-choice quizzes, sandboxed in-browser
  JavaScript code challenges (Web Worker), output-prediction and AI-graded
  freeform challenges, spaced-repetition flashcards, XP/levels, daily streaks,
  and badges.

## Stack

- Next.js (App Router) + TypeScript + Tailwind CSS
- SQLite via Prisma (single `dev.db` file — swap the datasource to Postgres
  later to scale)
- Vercel AI SDK (`ai`, `@ai-sdk/openai`, `@ai-sdk/anthropic`, `@ai-sdk/google`,
  `@ai-sdk/openai-compatible`) with Zod-validated structured generation

## Getting started

```bash
npm install
```

Create a `.env` file with the database URL:

```bash
echo 'DATABASE_URL="file:./dev.db"' > .env
```

Run migrations and start:

```bash
npm run db:migrate
npm run dev
```

Open http://localhost:3000, go to **Settings**, add a provider (preset or
custom), pick the active provider and model, then create your first learning
path.

For a production build:

```bash
npm run build && npm start
```

## Scripts

| Command            | Purpose                                  |
| ------------------ | ---------------------------------------- |
| `npm run dev`      | Dev server                               |
| `npm run build`    | Production build                         |
| `npm start`        | Serve production build                   |
| `npm run lint`     | ESLint                                   |
| `npm test`         | Vitest unit tests                        |
| `npm run db:migrate` | Prisma migrate dev                     |
| `npm run db:studio`  | Prisma Studio                          |

## Notes & limitations

- API keys are stored **in plaintext in the local SQLite DB** — fine for a
  single-user local app; don't reuse this approach for a hosted multi-user
  deployment.
- Executable code challenges run JavaScript in a browser Web Worker.
  Non-JavaScript topics get output-prediction and AI-graded freeform
  challenges instead.
- Each LLM call uses the model selected in Settings; cheaper defaults are
  preselected per provider.

## How progress survives "Update with AI"

Every module and lesson gets a `stableId` at generation time. When you update a
path, the LLM is instructed to reuse `stableId`s for unchanged content. The
update flow re-parents carried-over lessons to their (possibly new) modules,
clears cached content only for lessons the AI flagged as `changed`, and deletes
only what was actually removed — so completed lessons stay complete.
