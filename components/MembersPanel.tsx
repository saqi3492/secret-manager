"use client";

import { useCallback, useEffect, useState } from "react";

interface Env {
  id: string;
  name: string;
}

interface Member {
  userId: string;
  name: string;
  email: string;
  role: "owner" | "editor" | "viewer";
  environmentIds: string[];
}

interface Invitation {
  id: string;
  email: string;
  role: string;
  token: string;
  inviteUrl: string;
  environmentIds: string[];
}

export default function MembersPanel({ projectId }: { projectId: string }) {
  const [environments, setEnvironments] = useState<Env[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [loading, setLoading] = useState(true);

  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"editor" | "viewer">("viewer");
  const [inviteEnvs, setInviteEnvs] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch(`/api/projects/${projectId}/members`);
    if (res.ok) {
      const data = await res.json();
      setEnvironments(data.environments);
      setMembers(data.members);
      setInvitations(data.invitations);
      // Default new invites to granting all environments.
      setInviteEnvs(new Set(data.environments.map((e: Env) => e.id)));
    }
    setLoading(false);
  }, [projectId]);

  useEffect(() => {
    load();
  }, [load]);

  const envName = (id: string) =>
    environments.find((e) => e.id === id)?.name ?? id;

  async function copyLink(url: string, key: string) {
    await navigator.clipboard.writeText(url);
    setCopied(key);
    setTimeout(() => setCopied((c) => (c === key ? null : c)), 1500);
  }

  function toggleInviteEnv(id: string) {
    setInviteEnvs((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  async function invite(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (inviteEnvs.size === 0) {
      setError("Select at least one environment to grant access to.");
      return;
    }
    const res = await fetch(`/api/projects/${projectId}/members`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email,
        role,
        environmentIds: [...inviteEnvs],
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error ?? "Failed to create invite.");
      return;
    }
    setEmail("");
    await load();
    await copyLink(data.inviteUrl, data.token);
  }

  async function changeRole(userId: string, newRole: string) {
    const res = await fetch(`/api/projects/${projectId}/members/${userId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ role: newRole }),
    });
    if (!res.ok) alert((await res.json()).error ?? "Failed to change role.");
    await load();
  }

  async function saveAccess(userId: string, ids: string[]) {
    const res = await fetch(
      `/api/projects/${projectId}/members/${userId}/environments`,
      {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ environmentIds: ids }),
      }
    );
    if (!res.ok) alert((await res.json()).error ?? "Failed to update access.");
    await load();
  }

  async function removeMember(userId: string) {
    if (!confirm("Remove this member from the project?")) return;
    const res = await fetch(`/api/projects/${projectId}/members/${userId}`, {
      method: "DELETE",
    });
    if (!res.ok) alert((await res.json()).error ?? "Failed to remove member.");
    await load();
  }

  async function revoke(token: string) {
    if (!confirm("Revoke this invitation link?")) return;
    const res = await fetch(`/api/invites/${token}`, { method: "DELETE" });
    if (!res.ok) alert((await res.json()).error ?? "Failed to revoke.");
    await load();
  }

  return (
    <div>
      {/* Invite form */}
      <form
        onSubmit={invite}
        className="mb-4 rounded-lg border border-slate-200 bg-white p-4"
      >
        <div className="flex flex-wrap items-end gap-2">
          <label className="flex-1">
            <span className="mb-1 block text-sm font-medium text-slate-700">
              Invite by email
            </span>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="teammate@company.com"
              required
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-500"
            />
          </label>
          <label>
            <span className="mb-1 block text-sm font-medium text-slate-700">
              Role
            </span>
            <select
              value={role}
              onChange={(e) => setRole(e.target.value as "editor" | "viewer")}
              className="rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-500"
            >
              <option value="viewer">Viewer (read-only)</option>
              <option value="editor">Editor (read/write)</option>
            </select>
          </label>
          <button
            type="submit"
            className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
          >
            Create invite link
          </button>
        </div>

        <div className="mt-3">
          <span className="mb-1 block text-sm font-medium text-slate-700">
            Environments this person can access
          </span>
          <div className="flex flex-wrap gap-3">
            {environments.map((env) => (
              <label key={env.id} className="flex items-center gap-1.5 text-sm">
                <input
                  type="checkbox"
                  checked={inviteEnvs.has(env.id)}
                  onChange={() => toggleInviteEnv(env.id)}
                />
                {env.name}
              </label>
            ))}
          </div>
        </div>

        {error && <p className="mt-2 text-sm text-red-700">{error}</p>}
      </form>

      <p className="mb-6 rounded-md bg-blue-50 px-3 py-2 text-xs text-blue-800">
        No email is sent. Create an invite link, copy it, and share it with your
        teammate. They open it, sign up or log in, and get access to exactly the
        environments you selected.
      </p>

      {loading ? (
        <p className="text-slate-400">Loading…</p>
      ) : (
        <>
          {/* Pending invitations */}
          {invitations.length > 0 && (
            <div className="mb-6">
              <h3 className="mb-2 text-sm font-semibold text-slate-700">
                Pending invitations
              </h3>
              <ul className="space-y-2">
                {invitations.map((inv) => (
                  <li
                    key={inv.id}
                    className="flex flex-wrap items-center gap-3 rounded-lg border border-slate-200 bg-white p-3 text-sm"
                  >
                    <div className="flex-1">
                      <span className="font-medium">{inv.email}</span>
                      <span className="ml-2 rounded-full bg-slate-100 px-2 py-0.5 text-xs capitalize text-slate-600">
                        {inv.role}
                      </span>
                      <div className="mt-0.5 text-xs text-slate-500">
                        Access: {inv.environmentIds.map(envName).join(", ") || "—"}
                      </div>
                    </div>
                    <input
                      readOnly
                      value={inv.inviteUrl}
                      onFocus={(e) => e.currentTarget.select()}
                      className="min-w-0 flex-1 rounded border border-slate-200 bg-slate-50 px-2 py-1 font-mono text-xs text-slate-500"
                    />
                    <button
                      onClick={() => copyLink(inv.inviteUrl, inv.token)}
                      className="rounded-md border border-slate-300 px-3 py-1 hover:bg-slate-50"
                    >
                      {copied === inv.token ? "Copied!" : "Copy link"}
                    </button>
                    <button
                      onClick={() => revoke(inv.token)}
                      className="text-red-500 hover:text-red-700"
                    >
                      Revoke
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Current members */}
          <h3 className="mb-2 text-sm font-semibold text-slate-700">Members</h3>
          <ul className="space-y-2">
            {members.map((m) => (
              <MemberRow
                key={m.userId}
                member={m}
                environments={environments}
                onChangeRole={changeRole}
                onSaveAccess={saveAccess}
                onRemove={removeMember}
              />
            ))}
          </ul>
        </>
      )}
    </div>
  );
}

function MemberRow({
  member,
  environments,
  onChangeRole,
  onSaveAccess,
  onRemove,
}: {
  member: Member;
  environments: Env[];
  onChangeRole: (userId: string, role: string) => void;
  onSaveAccess: (userId: string, ids: string[]) => Promise<void>;
  onRemove: (userId: string) => void;
}) {
  const isOwner = member.role === "owner";
  const [editing, setEditing] = useState(false);
  const [sel, setSel] = useState<Set<string>>(new Set(member.environmentIds));
  const [saving, setSaving] = useState(false);

  // Keep local selection in sync when the member data reloads.
  useEffect(() => {
    setSel(new Set(member.environmentIds));
  }, [member.environmentIds]);

  const envName = (id: string) =>
    environments.find((e) => e.id === id)?.name ?? id;

  function toggle(id: string) {
    setSel((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  return (
    <li className="rounded-lg border border-slate-200 bg-white p-3 text-sm">
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex-1">
          <div className="font-medium">{member.name}</div>
          <div className="text-xs text-slate-500">{member.email}</div>
        </div>
        <select
          value={member.role}
          onChange={(e) => onChangeRole(member.userId, e.target.value)}
          className="rounded-md border border-slate-300 px-2 py-1 text-sm capitalize"
        >
          <option value="owner">Owner</option>
          <option value="editor">Editor</option>
          <option value="viewer">Viewer</option>
        </select>
        <button
          onClick={() => onRemove(member.userId)}
          className="text-red-500 hover:text-red-700"
        >
          Remove
        </button>
      </div>

      {/* Environment access */}
      <div className="mt-2 border-t border-slate-100 pt-2 text-xs">
        {isOwner ? (
          <span className="text-slate-500">
            Access: <span className="font-medium">All environments</span> (owner)
          </span>
        ) : editing ? (
          <div>
            <div className="mb-2 flex flex-wrap gap-3">
              {environments.map((env) => (
                <label key={env.id} className="flex items-center gap-1.5">
                  <input
                    type="checkbox"
                    checked={sel.has(env.id)}
                    onChange={() => toggle(env.id)}
                  />
                  {env.name}
                </label>
              ))}
            </div>
            <button
              disabled={saving}
              onClick={async () => {
                setSaving(true);
                await onSaveAccess(member.userId, [...sel]);
                setSaving(false);
                setEditing(false);
              }}
              className="mr-2 rounded-md bg-slate-900 px-3 py-1 font-medium text-white disabled:opacity-50"
            >
              {saving ? "Saving…" : "Save access"}
            </button>
            <button
              onClick={() => {
                setSel(new Set(member.environmentIds));
                setEditing(false);
              }}
              className="text-slate-500"
            >
              Cancel
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <span className="text-slate-500">
              Access:{" "}
              <span className="text-slate-700">
                {member.environmentIds.length
                  ? member.environmentIds.map(envName).join(", ")
                  : "no environments"}
              </span>
            </span>
            <button
              onClick={() => setEditing(true)}
              className="text-slate-900 underline"
            >
              Edit access
            </button>
          </div>
        )}
      </div>
    </li>
  );
}
