"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function AuthForm({ mode }: { mode: "login" | "signup" }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const isSignup = mode === "signup";

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch(`/api/auth/${mode}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          isSignup ? { name, email, password } : { email, password }
        ),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Something went wrong.");
        return;
      }
      router.push("/dashboard");
      router.refresh();
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto mt-24 w-full max-w-sm rounded-xl border border-slate-200 bg-white p-8 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <h1 className="mb-1 text-2xl font-semibold">
        {isSignup ? "Create your account" : "Welcome back"}
      </h1>
      <p className="mb-6 text-sm text-slate-500 dark:text-slate-400">
        Secret Manager — secure secrets for your team
      </p>

      <form onSubmit={onSubmit} className="space-y-4">
        {isSignup && (
          <Field
            label="Name"
            type="text"
            value={name}
            onChange={setName}
            autoComplete="name"
            required
          />
        )}
        <Field
          label="Email"
          type="email"
          value={email}
          onChange={setEmail}
          autoComplete="email"
          required
        />
        <Field
          label="Password"
          type="password"
          value={password}
          onChange={setPassword}
          autoComplete={isSignup ? "new-password" : "current-password"}
          required
        />

        {error && (
          <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950/40 dark:text-red-300">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-white"
        >
          {loading ? "Please wait…" : isSignup ? "Sign up" : "Log in"}
        </button>
      </form>

      <p className="mt-6 text-center text-sm text-slate-500 dark:text-slate-400">
        {isSignup ? (
          <>
            Already have an account?{" "}
            <Link href="/login" className="font-medium text-slate-900 underline dark:text-slate-100">
              Log in
            </Link>
          </>
        ) : (
          <>
            No account yet?{" "}
            <Link href="/signup" className="font-medium text-slate-900 underline dark:text-slate-100">
              Sign up
            </Link>
          </>
        )}
      </p>
    </div>
  );
}

function Field({
  label,
  type,
  value,
  onChange,
  autoComplete,
  required,
}: {
  label: string;
  type: string;
  value: string;
  onChange: (v: string) => void;
  autoComplete?: string;
  required?: boolean;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
        {label}
      </span>
      <input
        type={type}
        value={value}
        autoComplete={autoComplete}
        required={required}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none placeholder:text-slate-400 focus:border-slate-500 focus:ring-1 focus:ring-slate-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:placeholder:text-slate-500 dark:focus:border-slate-400 dark:focus:ring-slate-400"
      />
    </label>
  );
}
