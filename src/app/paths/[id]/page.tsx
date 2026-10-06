import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { Card, Pill, ProgressBar } from "@/components/ui";
import { PathActions } from "@/components/PathActions";
import { Markdown } from "@/components/Markdown";

export const dynamic = "force-dynamic";

export default async function PathPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const path = await db.learningPath.findUnique({
    where: { id },
    include: {
      modules: {
        orderBy: { order: "asc" },
        include: {
          lessons: {
            orderBy: { order: "asc" },
            include: { progress: true },
          },
        },
      },
      versions: { orderBy: { version: "desc" } },
      prereqPaths: {
        orderBy: { createdAt: "asc" },
        include: {
          modules: { include: { lessons: { include: { progress: true } } } },
        },
      },
      prereqFor: { select: { id: true, topic: true } },
    },
  });
  if (!path) notFound();

  const lessons = path.modules.flatMap((m) => m.lessons);
  const done = lessons.filter((l) => l.progress.length > 0).length;
  const pct = lessons.length ? done / lessons.length : 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-bold">{path.topic}</h1>
            <Pill color={path.status === "ready" ? "green" : "amber"}>
              {path.status}
            </Pill>
            <Pill>v{path.version}</Pill>
          </div>
          {path.summary && (
            <p className="mt-2 max-w-2xl text-sm text-zinc-400">{path.summary}</p>
          )}
          <p className="mt-1 text-xs text-zinc-500">
            Generated with {path.providerUsed || "—"}
            {path.lastRegeneratedAt &&
              ` · updated ${new Date(path.lastRegeneratedAt).toLocaleString()}`}
          </p>
          {path.prereqFor && (
            <p className="mt-1 text-xs text-zinc-500">
              Prerequisite for{" "}
              <Link
                href={`/paths/${path.prereqFor.id}`}
                className="text-indigo-300 underline"
              >
                {path.prereqFor.topic}
              </Link>
            </p>
          )}
        </div>
        <PathActions pathId={path.id} ready={path.status === "ready"} />
      </div>

      {path.status === "failed" && (
        <Card className="border-red-800 bg-red-500/10">
          <p className="text-sm text-red-300">
            Generation failed: {path.error}
          </p>
        </Card>
      )}

      <div className="flex items-center gap-3">
        <ProgressBar value={pct} className="flex-1" />
        <span className="text-xs text-zinc-400">
          {done}/{lessons.length} lessons
        </span>
      </div>

      {path.prereqPaths.length > 0 && (
        <Card className="border-amber-800/60 bg-amber-500/5">
          <h2 className="mb-2 font-semibold text-amber-200">
            Recommended prerequisites
          </h2>
          <div className="flex flex-wrap gap-2">
            {path.prereqPaths.map((p) => {
              const pl = p.modules.flatMap((m) => m.lessons);
              const pDone = pl.filter((l) => l.progress.length > 0).length;
              return (
                <Link key={p.id} href={`/paths/${p.id}`}>
                  <Pill
                    color={
                      p.status === "ready" && pDone === pl.length && pl.length
                        ? "green"
                        : p.status === "generating"
                          ? "amber"
                          : "zinc"
                    }
                    className="px-3 py-1.5 text-sm"
                  >
                    {p.topic}
                    {p.status === "generating" && " (generating…)"}
                    {p.status === "failed" && " (failed)"}
                    {p.status === "ready" && ` · ${pDone}/${pl.length}`}
                  </Pill>
                </Link>
              );
            })}
          </div>
        </Card>
      )}

      <div className="space-y-4">
        {path.modules.map((m, mi) => {
          const modDone = m.lessons.filter((l) => l.progress.length > 0).length;
          return (
            <Card key={m.id}>
              <div className="mb-3 flex items-center justify-between">
                <div>
                  <h2 className="font-semibold">
                    <span className="mr-2 text-zinc-500">{mi + 1}.</span>
                    {m.title}
                  </h2>
                  {m.description && (
                    <p className="mt-0.5 text-xs text-zinc-500">
                      {m.description}
                    </p>
                  )}
                </div>
                <Pill color={modDone === m.lessons.length ? "green" : "zinc"}>
                  {modDone}/{m.lessons.length}
                </Pill>
              </div>
              <ul className="divide-y divide-zinc-800">
                {m.lessons.map((l) => (
                  <li key={l.id}>
                    <Link
                      href={`/paths/${path.id}/lessons/${l.id}`}
                      className="group flex items-center justify-between py-2.5"
                    >
                      <div className="flex items-center gap-3">
                        <span
                          className={`flex h-6 w-6 items-center justify-center rounded-full border text-xs ${
                            l.progress.length > 0
                              ? "border-emerald-600 bg-emerald-500/20 text-emerald-300"
                              : "border-zinc-700 text-zinc-500 group-hover:border-indigo-500"
                          }`}
                        >
                          {l.progress.length > 0 ? "✓" : l.order + 1}
                        </span>
                        <div>
                          <p className="text-sm font-medium group-hover:text-indigo-300">
                            {l.title}
                          </p>
                          {l.summary && (
                            <p className="text-xs text-zinc-500">{l.summary}</p>
                          )}
                        </div>
                      </div>
                      <span className="text-zinc-600 group-hover:text-indigo-400">
                        →
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </Card>
          );
        })}
      </div>

      {path.versions.length > 0 && (
        <Card>
          <h2 className="mb-3 font-semibold">Update history</h2>
          <div className="space-y-4">
            {path.versions.map((v) => (
              <div
                key={v.version}
                className="border-l-2 border-indigo-800 pl-4"
              >
                <p className="text-xs text-zinc-500">
                  v{v.version} · {new Date(v.createdAt).toLocaleString()}
                </p>
                {v.changeNotes ? (
                  <Markdown className="mt-1 text-sm" content={v.changeNotes} />
                ) : (
                  <p className="mt-1 text-sm text-zinc-400">Initial plan</p>
                )}
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}
