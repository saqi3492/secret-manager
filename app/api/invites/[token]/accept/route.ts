import { prisma } from "@/lib/db";
import { handle, json, error, requireSession } from "@/lib/api";

type Params = { params: Promise<{ token: string }> };

// POST /api/invites/[token]/accept — the logged-in user joins the project the
// invitation points to. Requires an authenticated session.
export async function POST(_req: Request, { params }: Params) {
  return handle(async () => {
    const session = await requireSession();
    const { token } = await params;

    const inv = await prisma.invitation.findUnique({ where: { token } });
    if (!inv) return error("This invitation is invalid.", 404);
    if (inv.acceptedAt) return error("This invitation has already been used.", 410);

    // Add membership (idempotent if they somehow already belong).
    const existing = await prisma.membership.findUnique({
      where: { userId_projectId: { userId: session.userId, projectId: inv.projectId } },
    });
    if (!existing) {
      await prisma.membership.create({
        data: { userId: session.userId, projectId: inv.projectId, role: inv.role },
      });
    }

    // Grant access to the invited environments that still exist in the project.
    const envs = await prisma.environment.findMany({
      where: { projectId: inv.projectId, id: { in: inv.environmentIds } },
      select: { id: true },
    });
    for (const e of envs) {
      await prisma.environmentAccess.upsert({
        where: {
          userId_environmentId: { userId: session.userId, environmentId: e.id },
        },
        update: {},
        create: { userId: session.userId, environmentId: e.id },
      });
    }

    await prisma.invitation.update({
      where: { token },
      data: { acceptedAt: new Date() },
    });

    return json({ projectId: inv.projectId });
  });
}
