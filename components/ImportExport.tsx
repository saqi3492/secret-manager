"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function ImportExport({
  environmentId,
  envName,
  canEdit,
}: {
  environmentId: string;
  envName: string;
  canEdit: boolean;
}) {
  const router = useRouter();
  const [showImport, setShowImport] = useState(false);
  const [content, setContent] = useState("");
  const [result, setResult] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);

  async function exportEnv() {
    const res = await fetch(`/api/environments/${environmentId}/export`);
    if (!res.ok) {
      alert("Failed to export.");
      return;
    }
    const text = await res.text();
    const blob = new Blob([text], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `.env.${envName}`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function importEnv() {
    setImporting(true);
    setResult(null);
    const res = await fetch(`/api/environments/${environmentId}/import`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content }),
    });
    const data = await res.json();
    setImporting(false);
    if (!res.ok) {
      setResult(data.error ?? "Import failed.");
      return;
    }
    setResult(
      `Imported: ${data.created} created, ${data.updated} updated, ${data.skipped} skipped.`
    );
    setContent("");
    // Refresh the secrets table (which reloads on its own env effect via router).
    router.refresh();
    setTimeout(() => window.location.reload(), 400);
  }

  return (
    <div className="mt-6 flex flex-col gap-3">
      <div className="flex gap-2">
        <button
          onClick={exportEnv}
          className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:hover:bg-slate-800"
        >
          ⬇ Export .env
        </button>
        {canEdit && (
          <button
            onClick={() => setShowImport((v) => !v)}
            className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:hover:bg-slate-800"
          >
            ⬆ Import .env
          </button>
        )}
      </div>

      {showImport && canEdit && (
        <div className="rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
          <label className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-300">
            Paste .env contents
          </label>
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            rows={8}
            placeholder={"DATABASE_URL=postgres://…\nAPI_KEY=sk-…"}
            className="w-full rounded-md border border-slate-300 bg-white p-3 font-mono text-sm text-slate-900 outline-none placeholder:text-slate-400 focus:border-slate-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:placeholder:text-slate-500 dark:focus:border-slate-400"
          />
          <div className="mt-3 flex items-center gap-3">
            <button
              onClick={importEnv}
              disabled={importing || !content.trim()}
              className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-white"
            >
              {importing ? "Importing…" : "Import"}
            </button>
            {result && <span className="text-sm text-slate-600 dark:text-slate-400">{result}</span>}
          </div>
          <p className="mt-2 text-xs text-slate-400 dark:text-slate-500">
            Existing keys are updated; new keys are added.
          </p>
        </div>
      )}
    </div>
  );
}
