import { z } from "zod";
import { prisma } from "@/lib/db";
import { handle, json, error, requireSession } from "@/lib/api";
import { requireRole, accessibleEnvironmentIds, type Role } from "@/lib/authz";

type Params = { params: Promise<{ id: string }> };

// GET /api/projects/[id]/environments — list environments the caller can access.
// Owners see all; editors/viewers see only their granted environments.
export async function GET(_req: Request, { params }: Params) {
  return handle(async () => {
    const session = await requireSession();
    const { id } = await params;
    const membership = await requireRole(session.userId, id, "viewer");

    const allowed = await accessibleEnvironmentIds(
      session.userId,
      id,
      membership.role as Role
    );

    const envs = await prisma.environment.findMany({
      where: { projectId: id, id: { in: [...allowed] } },
      orderBy: { createdAt: "asc" },
      select: { id: true, name: true },
    });
    return json(envs);
  });
}

const createSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Environment name is required")
    .regex(/^[A-Za-z0-9_-]+$/, "Use letters, numbers, dashes or underscores only"),
});

// POST /api/projects/[id]/environments — owner only (environment structure is
// managed by the owner, who also controls per-user access).
export async function POST(req: Request, { params }: Params) {
  return handle(async () => {
    const session = await requireSession();
    const { id } = await params;
    await requireRole(session.userId, id, "owner");
    const body = createSchema.parse(await req.json());

    const existing = await prisma.environment.findUnique({
      where: { projectId_name: { projectId: id, name: body.name } },
    });
    if (existing) return error("An environment with that name already exists.", 409);

    const env = await prisma.environment.create({
      data: { projectId: id, name: body.name },
      select: { id: true, name: true },
    });
    return json(env, 201);
  });
}
