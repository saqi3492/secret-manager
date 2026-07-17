import { z } from "zod";
import { prisma } from "@/lib/db";
import { handle, json, error, requireSession } from "@/lib/api";
import { requireRole, AuthzError } from "@/lib/authz";

type Params = { params: Promise<{ id: string; userId: string }> };

const patchSchema = z.object({
  role: z.enum(["owner", "editor", "viewer"]),
});

// PATCH /api/projects/[id]/members/[userId] — change a member's role (owner only).
export async function PATCH(req: Request, { params }: Params) {
  return handle(async () => {
    const session = await requireSession();
    const { id, userId } = await params;
    await requireRole(session.userId, id, "owner");
    const body = patchSchema.parse(await req.json());

    // Prevent removing the last owner (via demotion).
    if (body.role !== "owner") {
      await ensureNotLastOwner(id, userId);
    }

    await prisma.membership.update({
      where: { userId_projectId: { userId, projectId: id } },
      data: { role: body.role },
    });
    return json({ userId, role: body.role });
  });
}

// DELETE /api/projects/[id]/members/[userId] — remove a member (owner only).
export async function DELETE(_req: Request, { params }: Params) {
  return handle(async () => {
    const session = await requireSession();
    const { id, userId } = await params;
    await requireRole(session.userId, id, "owner");

    await ensureNotLastOwner(id, userId);

    // Remove their per-environment access in this project as well, so a future
    // re-invite starts from a clean slate.
    await prisma.environmentAccess.deleteMany({
      where: { userId, environment: { projectId: id } },
    });
    await prisma.membership.delete({
      where: { userId_projectId: { userId, projectId: id } },
    });
    return json({ ok: true });
  });
}

async function ensureNotLastOwner(projectId: string, userId: string) {
  const target = await prisma.membership.findUnique({
    where: { userId_projectId: { userId, projectId } },
  });
  if (target?.role === "owner") {
    const owners = await prisma.membership.count({
      where: { projectId, role: "owner" },
    });
    if (owners <= 1) {
      throw new AuthzError("A project must have at least one owner.", 400);
    }
  }
}
