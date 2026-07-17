import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { type Role, accessibleEnvironmentIds } from "@/lib/authz";
import Header from "@/components/Header";
import ProjectView from "@/components/ProjectView";

export default async function ProjectPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await getSession();
  if (!session) redirect("/login");
  const { id } = await params;

  const membership = await prisma.membership.findUnique({
    where: { userId_projectId: { userId: session.userId, projectId: id } },
    include: {
      project: {
        include: { environments: { orderBy: { createdAt: "asc" } } },
      },
    },
  });

  if (!membership) notFound();

  const { project } = membership;
  const role = membership.role as Role;

  // Only surface environments this user is allowed to see.
  const allowed = await accessibleEnvironmentIds(session.userId, project.id, role);
  const visibleEnvironments = project.environments.filter((e) =>
    allowed.has(e.id)
  );

  return (
    <div>
      <Header name={session.name} />
      <main className="mx-auto max-w-5xl px-6 py-8">
        <Link
          href="/dashboard"
          className="text-sm text-slate-500 hover:text-slate-900"
        >
          ← All projects
        </Link>
        <ProjectView
          projectId={project.id}
          projectName={project.name}
          role={role}
          initialEnvironments={visibleEnvironments.map((e) => ({
            id: e.id,
            name: e.name,
          }))}
        />
      </main>
    </div>
  );
}
