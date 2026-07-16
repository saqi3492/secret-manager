"use client";

import { useCallback, useEffect, useState } from "react";

interface Secret {
  id: string;
  key: string;
  value: string;
}

export default function SecretsTable({
  environmentId,
  canEdit,
}: {
  environmentId: string;
  canEdit: boolean;
}) {
  const [secrets, setSecrets] = useState<Secret[]>([]);
  const [loading, setLoading] = useState(true);
  const [revealed, setRevealed] = useState<Set<string>>(new Set());
  const [copied, setCopied] = useState<string | null>(null);

  // Add-secret form
  const [newKey, setNewKey] = useState("");
  const [newValue, setNewValue] = useState("");
  const [addError, setAddError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch(`/api/environments/${environmentId}/secrets`);
    if (res.ok) setSecrets(await res.json());
    setRevealed(new Set());
    setLoading(false);
  }, [environmentId]);

  useEffect(() => {
    load();
  }, [load]);

  function toggleReveal(id: string) {
    setRevealed((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  async function copy(value: string, id: string) {
    await navigator.clipboard.writeText(value);
    setCopied(id);
    setTimeout(() => setCopied((c) => (c === id ? null : c)), 1200);
  }

  async function addSecret(e: React.FormEvent) {
    e.preventDefault();
    setAddError(null);
    const res = await fetch(`/api/environments/${environmentId}/secrets`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key: newKey, value: newValue }),
    });
    const data = await res.json();
    if (!res.ok) {
      setAddError(data.error ?? "Failed to add secret.");
      return;
    }
    setNewKey("");
    setNewValue("");
    await load();
  }

  async function saveEdit(id: string, key: string, value: string) {
    const res = await fetch(`/api/secrets/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key, value }),
    });
    if (!res.ok) {
      const data = await res.json();
      alert(data.error ?? "Failed to save.");
      return false;
    }
    await load();
    return true;
  }

  async function remove(id: string) {
    if (!confirm("Delete this secret?")) return;
    const res = await fetch(`/api/secrets/${id}`, { method: "DELETE" });
    if (res.ok) await load();
  }

  if (loading) {
    return <p className="py-8 text-center text-slate-400">Loading secrets…</p>;
  }

  return (
    <div>
      {secrets.length === 0 ? (
        <div className="rounded-lg border border-dashed border-slate-300 bg-white p-8 text-center text-slate-500">
          No secrets in this environment yet.
          {canEdit && " Add one below or import a .env file."}
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
          <table className="w-full text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-left text-xs uppercase text-slate-500">
              <tr>
                <th className="px-4 py-2 font-medium">Key</th>
                <th className="px-4 py-2 font-medium">Value</th>
                <th className="px-4 py-2" />
              </tr>
            </thead>
            <tbody>
              {secrets.map((s) => (
                <SecretRow
                  key={s.id}
                  secret={s}
                  revealed={revealed.has(s.id)}
                  copied={copied === s.id}
                  canEdit={canEdit}
                  onToggle={() => toggleReveal(s.id)}
                  onCopy={() => copy(s.value, s.id)}
                  onSave={saveEdit}
                  onDelete={() => remove(s.id)}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}

      {canEdit && (
        <form
          onSubmit={addSecret}
          className="mt-4 flex flex-wrap items-start gap-2 rounded-lg border border-slate-200 bg-white p-3"
        >
          <input
            value={newKey}
            onChange={(e) => setNewKey(e.target.value)}
            placeholder="KEY"
            required
            className="w-48 rounded-md border border-slate-300 px-3 py-2 font-mono text-sm outline-none focus:border-slate-500"
          />
          <input
            value={newValue}
            onChange={(e) => setNewValue(e.target.value)}
            placeholder="value"
            className="min-w-[12rem] flex-1 rounded-md border border-slate-300 px-3 py-2 font-mono text-sm outline-none focus:border-slate-500"
          />
          <button
            type="submit"
            className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
          >
            Add secret
          </button>
          {addError && (
            <p className="w-full text-sm text-red-700">{addError}</p>
          )}
        </form>
      )}
    </div>
  );
}

function SecretRow({
  secret,
  revealed,
  copied,
  canEdit,
  onToggle,
  onCopy,
  onSave,
  onDelete,
}: {
  secret: Secret;
  revealed: boolean;
  copied: boolean;
  canEdit: boolean;
  onToggle: () => void;
  onCopy: () => void;
  onSave: (id: string, key: string, value: string) => Promise<boolean>;
  onDelete: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [key, setKey] = useState(secret.key);
  const [value, setValue] = useState(secret.value);

  if (editing) {
    return (
      <tr className="border-b border-slate-100 last:border-0">
        <td className="px-4 py-2">
          <input
            value={key}
            onChange={(e) => setKey(e.target.value)}
            className="w-full rounded border border-slate-300 px-2 py-1 font-mono text-sm"
          />
        </td>
        <td className="px-4 py-2">
          <input
            value={value}
            onChange={(e) => setValue(e.target.value)}
            className="w-full rounded border border-slate-300 px-2 py-1 font-mono text-sm"
          />
        </td>
        <td className="whitespace-nowrap px-4 py-2 text-right">
          <button
            onClick={async () => {
              if (await onSave(secret.id, key, value)) setEditing(false);
            }}
            className="mr-2 text-sm font-medium text-slate-900"
          >
            Save
          </button>
          <button
            onClick={() => {
              setKey(secret.key);
              setValue(secret.value);
              setEditing(false);
            }}
            className="text-sm text-slate-500"
          >
            Cancel
          </button>
        </td>
      </tr>
    );
  }

  return (
    <tr className="border-b border-slate-100 last:border-0">
      <td className="px-4 py-2 font-mono">{secret.key}</td>
      <td className="px-4 py-2 font-mono text-slate-700">
        <span className="mr-2">
          {revealed ? secret.value : "•".repeat(Math.min(12, secret.value.length || 4))}
        </span>
      </td>
      <td className="whitespace-nowrap px-4 py-2 text-right text-slate-500">
        <button onClick={onToggle} className="mr-3 text-sm hover:text-slate-900">
          {revealed ? "Hide" : "Reveal"}
        </button>
        <button onClick={onCopy} className="mr-3 text-sm hover:text-slate-900">
          {copied ? "Copied!" : "Copy"}
        </button>
        {canEdit && (
          <>
            <button
              onClick={() => setEditing(true)}
              className="mr-3 text-sm hover:text-slate-900"
            >
              Edit
            </button>
            <button
              onClick={onDelete}
              className="text-sm text-red-500 hover:text-red-700"
            >
              Delete
            </button>
          </>
        )}
      </td>
    </tr>
  );
}
