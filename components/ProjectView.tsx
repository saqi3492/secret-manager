"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
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
          <span className="text-sm capitalize text-slate-500 dark:text-slate-400">
            Your role: {role}
          </span>
        </div>
        {isOwner && (
          <div className="flex gap-2 rounded-lg border border-slate-200 bg-white p-1 text-sm dark:border-slate-800 dark:bg-slate-900">
            <button
              onClick={() => setTab("secrets")}
              className={`rounded-md px-3 py-1 ${
                tab === "secrets"
                  ? "bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900"
                  : "text-slate-600 dark:text-slate-400"
              }`}
            >
              Secrets
            </button>
            <button
              onClick={() => setTab("members")}
              className={`rounded-md px-3 py-1 ${
                tab === "members"
                  ? "bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900"
                  : "text-slate-600 dark:text-slate-400"
              }`}
            >
              Members
            </button>
          </div>
        )}
      </div>

      {tab === "members" && isOwner ? (
        <>
          <MembersPanel projectId={projectId} />
          <DeleteProjectZone projectId={projectId} projectName={projectName} />
        </>
      ) : (
        <>
          {/* Environment tabs */}
          <div className="mb-4 flex flex-wrap items-center gap-2 border-b border-slate-200 pb-3 dark:border-slate-800">
            {envs.map((env) => (
              <div key={env.id} className="group flex items-center">
                <button
                  onClick={() => setActiveId(env.id)}
                  className={`rounded-md px-3 py-1.5 text-sm ${
                    env.id === activeId
                      ? "bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900"
                      : "bg-white text-slate-700 hover:bg-slate-100 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
                  }`}
                >
                  {env.name}
                </button>
                {isOwner && envs.length > 1 && (
                  <button
                    onClick={() => deleteEnv(env.id)}
                    title="Delete environment"
                    className="ml-1 hidden text-slate-400 hover:text-red-600 group-hover:inline dark:text-slate-500 dark:hover:text-red-400"
                  >
                    ✕
                  </button>
                )}
              </div>
            ))}

            {isOwner &&
              (addingEnv ? (
                <form onSubmit={addEnv} className="flex items-center gap-1">
                  <input
                    autoFocus
                    value={newEnv}
                    onChange={(e) => setNewEnv(e.target.value)}
                    placeholder="staging"
                    className="w-28 rounded-md border border-slate-300 bg-white px-2 py-1 text-sm text-slate-900 outline-none placeholder:text-slate-400 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:placeholder:text-slate-500"
                  />
                  <button
                    type="submit"
                    className="rounded-md bg-slate-900 px-2 py-1 text-sm text-white dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-white"
                  >
                    Add
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setAddingEnv(false);
                      setEnvError(null);
                    }}
                    className="text-sm text-slate-500 dark:text-slate-400"
                  >
                    Cancel
                  </button>
                </form>
              ) : (
                <button
                  onClick={() => setAddingEnv(true)}
                  className="rounded-md border border-dashed border-slate-300 px-3 py-1.5 text-sm text-slate-500 hover:border-slate-400 dark:border-slate-700 dark:text-slate-400 dark:hover:border-slate-500"
                >
                  + Environment
                </button>
              ))}
          </div>
          {envError && <p className="mb-3 text-sm text-red-700 dark:text-red-400">{envError}</p>}

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
            <div className="rounded-lg border border-dashed border-slate-300 bg-white p-8 text-center text-slate-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400">
              {isOwner
                ? "No environments yet. Add one to get started."
                : "You don't have access to any environments in this project yet. Ask a project owner to grant you access."}
            </div>
          )}
        </>
      )}
    </div>
  );
}

// Owner-only "danger zone" for permanently deleting a project. Deleting cascades
// to every environment, secret, membership and pending invitation (see the
// Prisma schema's onDelete: Cascade). Because it's irreversible, the owner must
// type the project's exact name to enable the delete button.
function DeleteProjectZone({
  projectId,
  projectName,
}: {
  projectId: string;
  projectName: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [confirmName, setConfirmName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const canDelete = confirmName.trim() === projectName;

  async function deleteProject() {
    if (!canDelete) return;
    setError(null);
    setDeleting(true);
    try {
      const res = await fetch(`/api/projects/${projectId}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? "Failed to delete project.");
        setDeleting(false);
        return;
      }
      router.push("/dashboard");
      router.refresh();
    } catch {
      setError("Network error. Please try again.");
      setDeleting(false);
    }
  }

  return (
    <div className="mt-8 rounded-lg border border-red-200 bg-red-50/50 p-4 dark:border-red-900/60 dark:bg-red-950/20">
      <h3 className="text-sm font-semibold text-red-700 dark:text-red-400">
        Danger zone
      </h3>
      <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
        Deleting this project permanently removes all of its environments,
        secrets, members and pending invitations. This cannot be undone.
      </p>

      {!open ? (
        <button
          onClick={() => setOpen(true)}
          className="mt-3 rounded-md border border-red-300 px-4 py-2 text-sm font-medium text-red-700 hover:bg-red-100 dark:border-red-900/60 dark:text-red-400 dark:hover:bg-red-950/40"
        >
          Delete this project
        </button>
      ) : (
        <div className="mt-3">
          <label className="block text-sm text-slate-600 dark:text-slate-400">
            Type the project name{" "}
            <span className="font-mono font-medium text-slate-900 dark:text-slate-100">
              {projectName}
            </span>{" "}
            to confirm:
          </label>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <input
              autoFocus
              value={confirmName}
              onChange={(e) => setConfirmName(e.target.value)}
              placeholder={projectName}
              className="w-56 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none placeholder:text-slate-400 focus:border-red-400 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:placeholder:text-slate-500"
            />
            <button
              onClick={deleteProject}
              disabled={!canDelete || deleting}
              className="rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-40 dark:bg-red-600 dark:hover:bg-red-500"
            >
              {deleting ? "Deleting…" : "Delete project"}
            </button>
            <button
              onClick={() => {
                setOpen(false);
                setConfirmName("");
                setError(null);
              }}
              className="text-sm text-slate-500 dark:text-slate-400"
            >
              Cancel
            </button>
          </div>
          {error && (
            <p className="mt-2 text-sm text-red-700 dark:text-red-400">{error}</p>
          )}
        </div>
      )}
    </div>
  );
}
