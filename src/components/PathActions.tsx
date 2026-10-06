"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Spinner } from "@/components/ui";

export function PathActions({
  pathId,
  ready,
}: {
  pathId: string;
  ready: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<"regen" | "delete" | null>(null);
  const [msg, setMsg] = useState("");

  async function regenerate() {
    if (
      !confirm(
        "Ask the AI to review and update this lesson plan? Your progress on unchanged lessons is preserved."
      )
    )
      return;
    setBusy("regen");
    setMsg("");
    const res = await fetch(`/api/paths/${pathId}/regenerate`, {
      method: "POST",
    });
    const data = await res.json().catch(() => ({}));
    setBusy(null);
    if (res.ok) {
      router.refresh();
    } else {
      setMsg(data.error ?? "Update failed");
    }
  }

  async function remove() {
    if (!confirm("Delete this learning path and all its progress?")) return;
    setBusy("delete");
    await fetch(`/api/paths/${pathId}`, { method: "DELETE" });
    router.push("/");
  }

  return (
    <div className="flex flex-col items-end gap-2">
      <div className="flex gap-2">
        <Button
          variant="secondary"
          onClick={regenerate}
          disabled={!ready || busy !== null}
          title="Ask the AI to check for updates and refresh this plan"
        >
          {busy === "regen" ? <Spinner /> : "↻ Update with AI"}
        </Button>
        <Button
          variant="danger"
          onClick={remove}
          disabled={busy !== null}
        >
          {busy === "delete" ? <Spinner /> : "Delete"}
        </Button>
      </div>
      {busy === "regen" && (
        <p className="text-xs text-zinc-400">
          Reviewing the plan against the latest developments…
        </p>
      )}
      {msg && <p className="text-xs text-red-400">{msg}</p>}
    </div>
  );
}
