import { prisma } from "@/lib/db";
import { handle, json, error, requireSession } from "@/lib/api";
import { requireRole } from "@/lib/authz";

type Params = { params: Promise<{ token: string }> };

// GET /api/invites/[token] — public invite info for the accept page.
export async function GET(_req: Request, { params }: Params) {
  return handle(async () => {
    const { token } = await params;
    const inv = await prisma.invitation.findUnique({
      where: { token },
      include: { project: { select: { name: true } } },
    });

    if (!inv) return json({ valid: false, accepted: false });
    return json({
      valid: true,
      accepted: inv.acceptedAt !== null,
      email: inv.email,
      role: inv.role,
      projectName: inv.project.name,
    });
  });
}

// DELETE /api/invites/[token] — revoke a pending invitation (owner only).
export async function DELETE(_req: Request, { params }: Params) {
  return handle(async () => {
    const session = await requireSession();
    const { token } = await params;
    const inv = await prisma.invitation.findUnique({ where: { token } });
    if (!inv) return error("Not found", 404);

    await requireRole(session.userId, inv.projectId, "owner");
    await prisma.invitation.delete({ where: { token } });
    return json({ ok: true });
  });
}
