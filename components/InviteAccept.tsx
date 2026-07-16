"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

interface InviteInfo {
  valid: boolean;
  accepted: boolean;
  email?: string;
  role?: string;
  projectName?: string;
}

// Defined at module scope (not inside the component) so it keeps a stable
// component identity across renders — otherwise React remounts its subtree on
// every keystroke and the focused input loses focus.
function Card({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto mt-24 w-full max-w-md rounded-xl border border-slate-200 bg-white p-8 shadow-sm">
      {children}
    </div>
  );
}

export default function InviteAccept({
  token,
  loggedIn,
}: {
  token: string;
  loggedIn: boolean;
}) {
  const router = useRouter();
  const [info, setInfo] = useState<InviteInfo | null>(null);
  const [mode, setMode] = useState<"signup" | "login">("signup");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    fetch(`/api/invites/${token}`)
      .then((r) => r.json())
      .then((data: InviteInfo) => {
        setInfo(data);
        if (data.email) setEmail(data.email);
      })
      .catch(() => setInfo({ valid: false, accepted: false }));
  }, [token]);

  async function accept() {
    const res = await fetch(`/api/invites/${token}/accept`, { method: "POST" });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error ?? "Could not accept the invitation.");
      return;
    }
    router.push(`/projects/${data.projectId}`);
    router.refresh();
  }

  async function authThenAccept(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const res = await fetch(`/api/auth/${mode}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          mode === "signup" ? { name, email, password } : { email, password }
        ),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Authentication failed.");
        return;
      }
      await accept();
    } finally {
      setBusy(false);
    }
  }

  if (!info) {
    return <Card>Loading invitation…</Card>;
  }

  if (!info.valid) {
    return (
      <Card>
        <h1 className="text-xl font-semibold">Invitation not found</h1>
        <p className="mt-2 text-sm text-slate-600">
          This invite link is invalid or has been revoked. Ask the project owner
          to send you a new one.
        </p>
        <Link href="/login" className="mt-4 inline-block text-sm underline">
          Go to login
        </Link>
      </Card>
    );
  }

  if (info.accepted) {
    return (
      <Card>
        <h1 className="text-xl font-semibold">Invitation already used</h1>
        <p className="mt-2 text-sm text-slate-600">
          This invitation has already been accepted. Log in to access the project.
        </p>
        <Link href="/login" className="mt-4 inline-block text-sm underline">
          Go to login
        </Link>
      </Card>
    );
  }

  const heading = (
    <>
      <h1 className="text-xl font-semibold">You&apos;ve been invited 🎉</h1>
      <p className="mt-2 text-sm text-slate-600">
        You&apos;ve been invited to join{" "}
        <span className="font-medium text-slate-900">{info.projectName}</span> as{" "}
        <span className="font-medium capitalize text-slate-900">{info.role}</span>.
      </p>
    </>
  );

  // Logged in → one-click accept.
  if (loggedIn) {
    return (
      <Card>
        {heading}
        {error && <p className="mt-3 text-sm text-red-700">{error}</p>}
        <button
          onClick={accept}
          className="mt-5 w-full rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
        >
          Accept invitation
        </button>
      </Card>
    );
  }

  // Not logged in → sign up (or log in) then accept.
  return (
    <Card>
      {heading}
      <p className="mt-4 text-sm text-slate-500">
        {mode === "signup"
          ? "Create your account to accept:"
          : "Log in to accept:"}
      </p>

      <form onSubmit={authThenAccept} className="mt-3 space-y-3">
        {mode === "signup" && (
          <input
            type="text"
            placeholder="Your name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-500"
          />
        )}
        <input
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-500"
        />
        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-500"
        />
        {error && <p className="text-sm text-red-700">{error}</p>}
        <button
          type="submit"
          disabled={busy}
          className="w-full rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50"
        >
          {busy
            ? "Please wait…"
            : mode === "signup"
              ? "Sign up & accept"
              : "Log in & accept"}
        </button>
      </form>

      <p className="mt-4 text-center text-sm text-slate-500">
        {mode === "signup" ? (
          <>
            Already have an account?{" "}
            <button
              onClick={() => {
                setMode("login");
                setError(null);
              }}
              className="font-medium text-slate-900 underline"
            >
              Log in
            </button>
          </>
        ) : (
          <>
            Need an account?{" "}
            <button
              onClick={() => {
                setMode("signup");
                setError(null);
              }}
              className="font-medium text-slate-900 underline"
            >
              Sign up
            </button>
          </>
        )}
      </p>
    </Card>
  );
}
