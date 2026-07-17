import { z } from "zod";
import { prisma } from "@/lib/db";
import { handle, json, error, requireSession } from "@/lib/api";
import { requireRole } from "@/lib/authz";

type Params = { params: Promise<{ id: string; userId: string }> };

const schema = z.object({
  environmentIds: z.array(z.string()),
});

// PUT /api/projects/[id]/members/[userId]/environments — replace the set of
// environments a member can access (owner only). Owners always have access to
// everything, so this is a no-op for owner members.
export async function PUT(req: Request, { params }: Params) {
  return handle(async () => {
    const session = await requireSession();
    const { id, userId } = await params;
    await requireRole(session.userId, id, "owner");

    const membership = await prisma.membership.findUnique({
      where: { userId_projectId: { userId, projectId: id } },
    });
    if (!membership) return error("That user is not a member.", 404);
    if (membership.role === "owner") {
      // Owners implicitly have full access; nothing to store.
      return json({ userId, environmentIds: "all" });
    }

    const body = schema.parse(await req.json());

    // Only accept environment ids that belong to this project.
    const valid = await prisma.environment.findMany({
      where: { projectId: id, id: { in: body.environmentIds } },
      select: { id: true },
    });
    const envIds = valid.map((e) => e.id);

    // Replace the member's access set atomically.
    await prisma.$transaction([
      prisma.environmentAccess.deleteMany({
        where: { userId, environment: { projectId: id } },
      }),
      prisma.environmentAccess.createMany({
        data: envIds.map((environmentId) => ({ userId, environmentId })),
      }),
    ]);

    return json({ userId, environmentIds: envIds });
  });
}
