"use client";

import { useCallback, useEffect, useState } from "react";

interface Member {
  userId: string;
  name: string;
  email: string;
  role: "owner" | "editor" | "viewer";
}

interface Invitation {
  id: string;
  email: string;
  role: string;
  token: string;
  inviteUrl: string;
}

export default function MembersPanel({ projectId }: { projectId: string }) {
  const [members, setMembers] = useState<Member[]>([]);
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"editor" | "viewer">("viewer");
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch(`/api/projects/${projectId}/members`);
    if (res.ok) {
      const data = await res.json();
      setMembers(data.members);
      setInvitations(data.invitations);
    }
    setLoading(false);
  }, [projectId]);

  useEffect(() => {
    load();
  }, [load]);

  async function copyLink(url: string, key: string) {
    await navigator.clipboard.writeText(url);
    setCopied(key);
    setTimeout(() => setCopied((c) => (c === key ? null : c)), 1500);
  }

  async function invite(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const res = await fetch(`/api/projects/${projectId}/members`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, role }),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error ?? "Failed to create invite.");
      return;
    }
    setEmail("");
    await load();
    // Immediately copy the new link so the owner can paste it right away.
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
      <form
        onSubmit={invite}
        className="mb-4 flex flex-wrap items-end gap-2 rounded-lg border border-slate-200 bg-white p-4"
      >
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
          <span className="mb-1 block text-sm font-medium text-slate-700">Role</span>
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
        {error && <p className="w-full text-sm text-red-700">{error}</p>}
      </form>

      <p className="mb-6 rounded-md bg-blue-50 px-3 py-2 text-xs text-blue-800">
        No email is sent. Create an invite link, copy it, and share it with your
        teammate (Slack, chat, etc.). They open it, sign up or log in, and land
        straight in the project.
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
          <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
            <table className="w-full text-sm">
              <thead className="border-b border-slate-200 bg-slate-50 text-left text-xs uppercase text-slate-500">
                <tr>
                  <th className="px-4 py-2 font-medium">Member</th>
                  <th className="px-4 py-2 font-medium">Role</th>
                  <th className="px-4 py-2" />
                </tr>
              </thead>
              <tbody>
                {members.map((m) => (
                  <tr key={m.userId} className="border-b border-slate-100 last:border-0">
                    <td className="px-4 py-2">
                      <div className="font-medium">{m.name}</div>
                      <div className="text-xs text-slate-500">{m.email}</div>
                    </td>
                    <td className="px-4 py-2">
                      <select
                        value={m.role}
                        onChange={(e) => changeRole(m.userId, e.target.value)}
                        className="rounded-md border border-slate-300 px-2 py-1 text-sm capitalize"
                      >
                        <option value="owner">Owner</option>
                        <option value="editor">Editor</option>
                        <option value="viewer">Viewer</option>
                      </select>
                    </td>
                    <td className="px-4 py-2 text-right">
                      <button
                        onClick={() => removeMember(m.userId)}
                        className="text-sm text-red-500 hover:text-red-700"
                      >
                        Remove
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
