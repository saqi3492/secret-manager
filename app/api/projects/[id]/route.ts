import { z } from "zod";
import { prisma } from "@/lib/db";
import { handle, json, requireSession } from "@/lib/api";
import { requireRole } from "@/lib/authz";

type Params = { params: Promise<{ id: string }> };

// GET /api/projects/[id] — project detail with environments + the caller's role.
export async function GET(_req: Request, { params }: Params) {
  return handle(async () => {
    const session = await requireSession();
    const { id } = await params;
    const membership = await requireRole(session.userId, id, "viewer");

    const project = await prisma.project.findUnique({
      where: { id },
      include: { environments: { orderBy: { createdAt: "asc" } } },
    });
    if (!project) return json({ error: "Not found" }, 404);

    return json({
      id: project.id,
      name: project.name,
      description: project.description,
      role: membership.role,
      environments: project.environments.map((e) => ({
        id: e.id,
        name: e.name,
      })),
    });
  });
}

const patchSchema = z.object({
  name: z.string().trim().min(1).optional(),
  description: z.string().trim().nullable().optional(),
});

// PATCH /api/projects/[id] — owner only.
export async function PATCH(req: Request, { params }: Params) {
  return handle(async () => {
    const session = await requireSession();
    const { id } = await params;
    await requireRole(session.userId, id, "owner");
    const body = patchSchema.parse(await req.json());

    const project = await prisma.project.update({
      where: { id },
      data: { name: body.name, description: body.description ?? undefined },
    });
    return json({ id: project.id, name: project.name });
  });
}

// DELETE /api/projects/[id] — owner only. Cascades to envs/secrets/memberships.
export async function DELETE(_req: Request, { params }: Params) {
  return handle(async () => {
    const session = await requireSession();
    const { id } = await params;
    await requireRole(session.userId, id, "owner");
    await prisma.project.delete({ where: { id } });
    return json({ ok: true });
  });
}
