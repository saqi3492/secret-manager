import { z } from "zod";
import { prisma } from "@/lib/db";
import { handle, json, error, requireSession } from "@/lib/api";
import { requireRole, projectIdForEnvironment } from "@/lib/authz";

type Params = { params: Promise<{ id: string }> };

const patchSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1)
    .regex(/^[A-Za-z0-9_-]+$/, "Use letters, numbers, dashes or underscores only"),
});

// PATCH /api/environments/[id] — rename (editor+).
export async function PATCH(req: Request, { params }: Params) {
  return handle(async () => {
    const session = await requireSession();
    const { id } = await params;
    const projectId = await projectIdForEnvironment(id);
    if (!projectId) return error("Not found", 404);
    await requireRole(session.userId, projectId, "editor");

    const body = patchSchema.parse(await req.json());
    const env = await prisma.environment.update({
      where: { id },
      data: { name: body.name },
      select: { id: true, name: true },
    });
    return json(env);
  });
}

// DELETE /api/environments/[id] — editor+. Cascades to its secrets.
export async function DELETE(_req: Request, { params }: Params) {
  return handle(async () => {
    const session = await requireSession();
    const { id } = await params;
    const projectId = await projectIdForEnvironment(id);
    if (!projectId) return error("Not found", 404);
    await requireRole(session.userId, projectId, "editor");

    // Refuse to delete the last environment in a project.
    const count = await prisma.environment.count({ where: { projectId } });
    if (count <= 1) {
      return error("A project must have at least one environment.", 400);
    }

    await prisma.environment.delete({ where: { id } });
    return json({ ok: true });
  });
}
