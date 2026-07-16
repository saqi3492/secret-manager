import { z } from "zod";
import { prisma } from "@/lib/db";
import { handle, json, requireSession } from "@/lib/api";

// GET /api/projects — list projects the current user belongs to.
export async function GET() {
  return handle(async () => {
    const session = await requireSession();
    const memberships = await prisma.membership.findMany({
      where: { userId: session.userId },
      include: {
        project: {
          include: { _count: { select: { environments: true, memberships: true } } },
        },
      },
      orderBy: { project: { createdAt: "desc" } },
    });

    return json(
      memberships.map((m) => ({
        id: m.project.id,
        name: m.project.name,
        description: m.project.description,
        role: m.role,
        environmentCount: m.project._count.environments,
        memberCount: m.project._count.memberships,
      }))
    );
  });
}

const createSchema = z.object({
  name: z.string().trim().min(1, "Project name is required"),
  description: z.string().trim().optional(),
});

// POST /api/projects — create a project; creator becomes owner and a default
// "development" environment is created.
export async function POST(req: Request) {
  return handle(async () => {
    const session = await requireSession();
    const body = createSchema.parse(await req.json());

    const project = await prisma.project.create({
      data: {
        name: body.name,
        description: body.description,
        memberships: {
          create: { userId: session.userId, role: "owner" },
        },
        environments: { create: { name: "development" } },
      },
    });

    return json({ id: project.id, name: project.name }, 201);
  });
}
