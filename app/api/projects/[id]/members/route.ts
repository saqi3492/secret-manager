import { z } from "zod";
import { prisma } from "@/lib/db";
import { handle, json, error, requireSession } from "@/lib/api";
import { requireRole } from "@/lib/authz";
import { generateInviteToken, inviteUrl } from "@/lib/invite";

type Params = { params: Promise<{ id: string }> };

// GET /api/projects/[id]/members — current members + pending invitations (owner only).
export async function GET(req: Request, { params }: Params) {
  return handle(async () => {
    const session = await requireSession();
    const { id } = await params;
    await requireRole(session.userId, id, "owner");

    const [members, invitations] = await Promise.all([
      prisma.membership.findMany({
        where: { projectId: id },
        include: { user: { select: { id: true, name: true, email: true } } },
        orderBy: { user: { email: "asc" } },
      }),
      prisma.invitation.findMany({
        where: { projectId: id, acceptedAt: null },
        orderBy: { createdAt: "desc" },
      }),
    ]);

    return json({
      members: members.map((m) => ({
        userId: m.user.id,
        name: m.user.name,
        email: m.user.email,
        role: m.role,
      })),
      invitations: invitations.map((inv) => ({
        id: inv.id,
        email: inv.email,
        role: inv.role,
        token: inv.token,
        inviteUrl: inviteUrl(req, inv.token),
        createdAt: inv.createdAt,
      })),
    });
  });
}

const inviteSchema = z.object({
  email: z.string().trim().toLowerCase().email("A valid email is required"),
  role: z.enum(["editor", "viewer"]),
});

// POST /api/projects/[id]/members — create an invitation and return a shareable
// link (owner only). No email is sent; the owner copies the link to the invitee.
export async function POST(req: Request, { params }: Params) {
  return handle(async () => {
    const session = await requireSession();
    const { id } = await params;
    await requireRole(session.userId, id, "owner");
    const body = inviteSchema.parse(await req.json());

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

    // Reuse an existing pending invite for the same email (idempotent link),
    // updating the role if it changed.
    const pending = await prisma.invitation.findFirst({
      where: { projectId: id, email: body.email, acceptedAt: null },
    });

    const invitation = pending
      ? await prisma.invitation.update({
          where: { id: pending.id },
          data: { role: body.role },
        })
      : await prisma.invitation.create({
          data: {
            projectId: id,
            email: body.email,
            role: body.role,
            token: generateInviteToken(),
          },
        });

    return json(
      {
        id: invitation.id,
        email: invitation.email,
        role: invitation.role,
        token: invitation.token,
        inviteUrl: inviteUrl(req, invitation.token),
      },
      201
    );
  });
}
