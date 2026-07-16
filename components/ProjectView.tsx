"use client";

import { useCallback, useEffect, useState } from "react";
import type { Role } from "@/lib/authz";
import SecretsTable from "@/components/SecretsTable";
import ImportExport from "@/components/ImportExport";
import MembersPanel from "@/components/MembersPanel";

export interface Env {
  id: string;
  name: string;
}

const rank: Record<Role, number> = { viewer: 0, editor: 1, owner: 2 };

export default function ProjectView({
  projectId,
  projectName,
  role,
  initialEnvironments,
}: {
  projectId: string;
  projectName: string;
  role: Role;
  initialEnvironments: Env[];
}) {
  const [envs, setEnvs] = useState<Env[]>(initialEnvironments);
  const [activeId, setActiveId] = useState<string>(
    initialEnvironments[0]?.id ?? ""
  );
  const [tab, setTab] = useState<"secrets" | "members">("secrets");
  const [addingEnv, setAddingEnv] = useState(false);
  const [newEnv, setNewEnv] = useState("");
  const [envError, setEnvError] = useState<string | null>(null);

  const canEdit = rank[role] >= rank.editor;
  const isOwner = role === "owner";

  const refreshEnvs = useCallback(async () => {
    const res = await fetch(`/api/projects/${projectId}/environments`);
    if (res.ok) setEnvs(await res.json());
  }, [projectId]);

  async function addEnv(e: React.FormEvent) {
    e.preventDefault();
    setEnvError(null);
    const res = await fetch(`/api/projects/${projectId}/environments`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newEnv }),
    });
    const data = await res.json();
    if (!res.ok) {
      setEnvError(data.error ?? "Failed to add environment.");
      return;
    }
    setNewEnv("");
    setAddingEnv(false);
    await refreshEnvs();
    setActiveId(data.id);
  }

  async function deleteEnv(id: string) {
    if (!confirm("Delete this environment and all its secrets?")) return;
    const res = await fetch(`/api/environments/${id}`, { method: "DELETE" });
    if (!res.ok) {
      const data = await res.json();
      alert(data.error ?? "Failed to delete environment.");
      return;
    }
    await refreshEnvs();
    setActiveId((prev) => (prev === id ? envs.find((e) => e.id !== id)?.id ?? "" : prev));
  }

  useEffect(() => {
    if (!envs.some((e) => e.id === activeId) && envs[0]) {
      setActiveId(envs[0].id);
    }
  }, [envs, activeId]);

  return (
    <div className="mt-4">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">{projectName}</h1>
          <span className="text-sm capitalize text-slate-500">
            Your role: {role}
          </span>
        </div>
        {isOwner && (
          <div className="flex gap-2 rounded-lg border border-slate-200 bg-white p-1 text-sm">
            <button
              onClick={() => setTab("secrets")}
              className={`rounded-md px-3 py-1 ${
                tab === "secrets" ? "bg-slate-900 text-white" : "text-slate-600"
              }`}
            >
              Secrets
            </button>
            <button
              onClick={() => setTab("members")}
              className={`rounded-md px-3 py-1 ${
                tab === "members" ? "bg-slate-900 text-white" : "text-slate-600"
              }`}
            >
              Members
            </button>
          </div>
        )}
      </div>

      {tab === "members" && isOwner ? (
        <MembersPanel projectId={projectId} />
      ) : (
        <>
          {/* Environment tabs */}
          <div className="mb-4 flex flex-wrap items-center gap-2 border-b border-slate-200 pb-3">
            {envs.map((env) => (
              <div key={env.id} className="group flex items-center">
                <button
                  onClick={() => setActiveId(env.id)}
                  className={`rounded-md px-3 py-1.5 text-sm ${
                    env.id === activeId
                      ? "bg-slate-900 text-white"
                      : "bg-white text-slate-700 hover:bg-slate-100"
                  }`}
                >
                  {env.name}
                </button>
                {canEdit && envs.length > 1 && (
                  <button
                    onClick={() => deleteEnv(env.id)}
                    title="Delete environment"
                    className="ml-1 hidden text-slate-400 hover:text-red-600 group-hover:inline"
                  >
                    ✕
                  </button>
                )}
              </div>
            ))}

            {canEdit &&
              (addingEnv ? (
                <form onSubmit={addEnv} className="flex items-center gap-1">
                  <input
                    autoFocus
                    value={newEnv}
                    onChange={(e) => setNewEnv(e.target.value)}
                    placeholder="staging"
                    className="w-28 rounded-md border border-slate-300 px-2 py-1 text-sm outline-none"
                  />
                  <button
                    type="submit"
                    className="rounded-md bg-slate-900 px-2 py-1 text-sm text-white"
                  >
                    Add
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setAddingEnv(false);
                      setEnvError(null);
                    }}
                    className="text-sm text-slate-500"
                  >
                    Cancel
                  </button>
                </form>
              ) : (
                <button
                  onClick={() => setAddingEnv(true)}
                  className="rounded-md border border-dashed border-slate-300 px-3 py-1.5 text-sm text-slate-500 hover:border-slate-400"
                >
                  + Environment
                </button>
              ))}
          </div>
          {envError && <p className="mb-3 text-sm text-red-700">{envError}</p>}

          {activeId ? (
            <>
              <SecretsTable environmentId={activeId} canEdit={canEdit} />
              <ImportExport
                environmentId={activeId}
                canEdit={canEdit}
                envName={envs.find((e) => e.id === activeId)?.name ?? "env"}
              />
            </>
          ) : (
            <p className="text-slate-500">No environments.</p>
          )}
        </>
      )}
    </div>
  );
}
