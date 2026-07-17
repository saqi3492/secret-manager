import { z } from "zod";
import { prisma } from "@/lib/db";
import { handle, json, error, requireSession } from "@/lib/api";
import { requireRole } from "@/lib/authz";
import { generateInviteToken, inviteUrl } from "@/lib/invite";

type Params = { params: Promise<{ id: string }> };

// GET /api/projects/[id]/members — members (with their environment access),
// pending invitations, and the project's environments (owner only).
export async function GET(req: Request, { params }: Params) {
  return handle(async () => {
    const session = await requireSession();
    const { id } = await params;
    await requireRole(session.userId, id, "owner");

    const [members, invitations, environments, access] = await Promise.all([
      prisma.membership.findMany({
        where: { projectId: id },
        include: { user: { select: { id: true, name: true, email: true } } },
        orderBy: { user: { email: "asc" } },
      }),
      prisma.invitation.findMany({
        where: { projectId: id, acceptedAt: null },
        orderBy: { createdAt: "desc" },
      }),
      prisma.environment.findMany({
        where: { projectId: id },
        orderBy: { createdAt: "asc" },
        select: { id: true, name: true },
      }),
      prisma.environmentAccess.findMany({
        where: { environment: { projectId: id } },
        select: { userId: true, environmentId: true },
      }),
    ]);

    const allEnvIds = environments.map((e) => e.id);
    const accessByUser = new Map<string, string[]>();
    for (const a of access) {
      const list = accessByUser.get(a.userId) ?? [];
      list.push(a.environmentId);
      accessByUser.set(a.userId, list);
    }

    return json({
      environments,
      members: members.map((m) => ({
        userId: m.user.id,
        name: m.user.name,
        email: m.user.email,
        role: m.role,
        // Owners implicitly have access to every environment.
        environmentIds:
          m.role === "owner" ? allEnvIds : accessByUser.get(m.user.id) ?? [],
      })),
      invitations: invitations.map((inv) => ({
        id: inv.id,
        email: inv.email,
        role: inv.role,
        token: inv.token,
        environmentIds: inv.environmentIds,
        inviteUrl: inviteUrl(req, inv.token),
        createdAt: inv.createdAt,
      })),
    });
  });
}

const inviteSchema = z.object({
  email: z.string().trim().toLowerCase().email("A valid email is required"),
  role: z.enum(["editor", "viewer"]),
  environmentIds: z.array(z.string()).min(1, "Select at least one environment"),
});

// POST /api/projects/[id]/members — create an invitation for specific
// environments and return a shareable link (owner only). No email is sent.
export async function POST(req: Request, { params }: Params) {
  return handle(async () => {
    const session = await requireSession();
    const { id } = await params;
    await requireRole(session.userId, id, "owner");
    const body = inviteSchema.parse(await req.json());

    // Keep only environment ids that actually belong to this project.
    const validEnvs = await prisma.environment.findMany({
      where: { projectId: id, id: { in: body.environmentIds } },
      select: { id: true },
    });
    const envIds = validEnvs.map((e) => e.id);
    if (envIds.length === 0) {
      return error("Select at least one valid environment.", 422);
    }

    // Already a member?
    const existingUser = await prisma.user.findUnique({
      where: { email: body.email },
    });
    if (existingUser) {
      const membership = await prisma.membership.findUnique({
        where: { userId_projectId: { userId: existingUser.id, projectId: id } },
      });
      if (membership) return error("That user is already a member.", 409);
    }

    // Reuse an existing pending invite for the same email (idempotent link).
    const pending = await prisma.invitation.findFirst({
      where: { projectId: id, email: body.email, acceptedAt: null },
    });

    const invitation = pending
      ? await prisma.invitation.update({
          where: { id: pending.id },
          data: { role: body.role, environmentIds: envIds },
        })
      : await prisma.invitation.create({
          data: {
            projectId: id,
            email: body.email,
            role: body.role,
            environmentIds: envIds,
            token: generateInviteToken(),
          },
        });

    return json(
      {
        id: invitation.id,
        email: invitation.email,
        role: invitation.role,
        token: invitation.token,
        environmentIds: invitation.environmentIds,
        inviteUrl: inviteUrl(req, invitation.token),
      },
      201
    );
  });
}
