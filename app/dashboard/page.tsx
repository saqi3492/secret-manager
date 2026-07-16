import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import Header from "@/components/Header";
import NewProjectButton from "@/components/NewProjectButton";

export default async function DashboardPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  const memberships = await prisma.membership.findMany({
    where: { userId: session.userId },
    include: {
      project: {
        include: {
          _count: { select: { environments: true, memberships: true } },
        },
      },
    },
    orderBy: { project: { createdAt: "desc" } },
  });

  return (
    <div>
      <Header name={session.name} />
      <main className="mx-auto max-w-5xl px-6 py-8">
        <div className="mb-6 flex items-center justify-between">
          <h1 className="text-xl font-semibold">Your projects</h1>
          <NewProjectButton />
        </div>

        {memberships.length === 0 ? (
          <div className="rounded-lg border border-dashed border-slate-300 bg-white p-10 text-center text-slate-500">
            No projects yet. Create your first project to start storing secrets.
          </div>
        ) : (
          <ul className="grid gap-4 sm:grid-cols-2">
            {memberships.map((m) => (
              <li key={m.project.id}>
                <Link
                  href={`/projects/${m.project.id}`}
                  className="block rounded-lg border border-slate-200 bg-white p-5 shadow-sm transition hover:border-slate-400"
                >
                  <div className="flex items-center justify-between">
                    <h2 className="font-medium">{m.project.name}</h2>
                    <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs capitalize text-slate-600">
                      {m.role}
                    </span>
                  </div>
                  {m.project.description && (
                    <p className="mt-1 text-sm text-slate-500">
                      {m.project.description}
                    </p>
                  )}
                  <p className="mt-3 text-xs text-slate-400">
                    {m.project._count.environments} environment
                    {m.project._count.environments !== 1 ? "s" : ""} ·{" "}
                    {m.project._count.memberships} member
                    {m.project._count.memberships !== 1 ? "s" : ""}
                  </p>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </main>
    </div>
  );
}
