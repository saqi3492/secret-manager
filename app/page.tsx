import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";

export default async function Home() {
  // Logged-in users skip the marketing page and go straight to their projects.
  if (await getSession()) redirect("/dashboard");

  return (
    <div className="min-h-screen">
      {/* Top bar */}
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
          <span className="font-semibold">🔒 Secret Manager</span>
          <div className="flex items-center gap-3 text-sm">
            <Link
              href="/login"
              className="rounded-md px-3 py-1.5 text-slate-600 hover:text-slate-900"
            >
              Log in
            </Link>
            <Link
              href="/signup"
              className="rounded-md bg-slate-900 px-4 py-1.5 font-medium text-white hover:bg-slate-800"
            >
              Get started
            </Link>
          </div>
        </div>
      </header>

      {/* Hero */}
      <main className="mx-auto max-w-5xl px-6">
        <section className="py-16 text-center sm:py-24">
          <span className="inline-block rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600">
            For development teams
          </span>
          <h1 className="mx-auto mt-5 max-w-3xl text-4xl font-bold tracking-tight text-slate-900 sm:text-5xl">
            Stop sharing <code className="rounded bg-slate-100 px-2">.env</code>{" "}
            files over Slack
          </h1>
          <p className="mx-auto mt-5 max-w-2xl text-lg text-slate-600">
            Secret Manager is one secure home for your team&apos;s project secrets.
            Store them per project and environment, control who can view or edit,
            and onboard a new developer by simply adding them to the project —
            no more hunting for the latest <code>.env</code> and re-sending it.
          </p>
          <div className="mt-8 flex justify-center gap-3">
            <Link
              href="/signup"
              className="rounded-md bg-slate-900 px-6 py-3 text-sm font-medium text-white hover:bg-slate-800"
            >
              Create your account
            </Link>
            <Link
              href="/login"
              className="rounded-md border border-slate-300 bg-white px-6 py-3 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              Log in
            </Link>
          </div>
        </section>

        {/* The problem */}
        <section className="rounded-2xl border border-slate-200 bg-white p-8 sm:p-10">
          <h2 className="text-lg font-semibold text-slate-900">
            The problem it solves
          </h2>
          <p className="mt-3 max-w-3xl text-slate-600">
            Teams keep secrets — API keys, database URLs, tokens — in a{" "}
            <code>.env</code> file that never gets committed to Git. So the file
            lives &ldquo;somewhere&rdquo; on each machine, and every time a new
            developer joins, someone has to dig it up and hand it over. That&apos;s
            insecure, easy to get wrong, and impossible to keep in sync.
          </p>
        </section>

        {/* How it helps */}
        <section className="py-16">
          <h2 className="text-center text-2xl font-semibold text-slate-900">
            How it helps
          </h2>
          <div className="mt-8 grid gap-6 sm:grid-cols-3">
            {FEATURES.map((f) => (
              <div
                key={f.title}
                className="rounded-xl border border-slate-200 bg-white p-6"
              >
                <div className="text-2xl">{f.icon}</div>
                <h3 className="mt-3 font-medium text-slate-900">{f.title}</h3>
                <p className="mt-1 text-sm text-slate-600">{f.body}</p>
              </div>
            ))}
          </div>
        </section>

        {/* How it works */}
        <section className="pb-16">
          <h2 className="text-center text-2xl font-semibold text-slate-900">
            How it works
          </h2>
          <ol className="mx-auto mt-8 grid max-w-3xl gap-4">
            {STEPS.map((s, i) => (
              <li
                key={i}
                className="flex gap-4 rounded-xl border border-slate-200 bg-white p-5"
              >
                <span className="flex h-8 w-8 flex-none items-center justify-center rounded-full bg-slate-900 text-sm font-semibold text-white">
                  {i + 1}
                </span>
                <p className="text-slate-700">{s}</p>
              </li>
            ))}
          </ol>
          <div className="mt-10 text-center">
            <Link
              href="/signup"
              className="rounded-md bg-slate-900 px-6 py-3 text-sm font-medium text-white hover:bg-slate-800"
            >
              Get started — it&apos;s free
            </Link>
          </div>
        </section>
      </main>

      <footer className="border-t border-slate-200 py-8 text-center text-sm text-slate-400">
        🔒 Secret Manager — secure secrets for your team
      </footer>
    </div>
  );
}

const FEATURES = [
  {
    icon: "🗂️",
    title: "Organized per project & environment",
    body: "Keep secrets grouped by project, with separate sets for development, staging, and production.",
  },
  {
    icon: "👥",
    title: "View / edit permissions",
    body: "Invite teammates and decide who can only read secrets and who can change them.",
  },
  {
    icon: "🔐",
    title: "Encrypted & import/export ready",
    body: "Values are encrypted at rest. Paste an existing .env to import, and export any environment back to a .env in one click.",
  },
];

const STEPS = [
  "Create a project and paste in your existing .env — it's imported and encrypted instantly.",
  "Invite your teammates by email and give each of them viewer or editor access.",
  "A new developer joins? Add them to the project and they export the .env themselves. No manual handoff.",
];
