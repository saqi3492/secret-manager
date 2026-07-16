"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";

export default function Header({ name }: { name: string }) {
  const router = useRouter();

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  return (
    <header className="border-b border-slate-200 bg-white">
      <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-3">
        <Link href="/dashboard" className="font-semibold">
          🔒 Secret Manager
        </Link>
        <div className="flex items-center gap-4 text-sm">
          <span className="text-slate-500">{name}</span>
          <button
            onClick={logout}
            className="rounded-md border border-slate-300 px-3 py-1 hover:bg-slate-50"
          >
            Log out
          </button>
        </div>
      </div>
    </header>
  );
}
