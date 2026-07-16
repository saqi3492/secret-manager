import { prisma } from "@/lib/db";

export type Role = "owner" | "editor" | "viewer";

// Ordered least → most privileged. A role satisfies a requirement if its rank
// is >= the required rank.
const RANK: Record<Role, number> = { viewer: 0, editor: 1, owner: 2 };

export function isRole(value: string): value is Role {
  return value === "owner" || value === "editor" || value === "viewer";
}

export class AuthzError extends Error {
  status: number;
  constructor(message: string, status = 403) {
    super(message);
    this.status = status;
  }
}

/**
 * Ensure `userId` is a member of `projectId` with at least `minRole`.
 * Returns the membership (with role) or throws AuthzError (403/404).
 */
export async function requireRole(
  userId: string,
  projectId: string,
  minRole: Role
) {
  const membership = await prisma.membership.findUnique({
    where: { userId_projectId: { userId, projectId } },
  });

  if (!membership) {
    // Don't leak project existence to non-members.
    throw new AuthzError("Not found", 404);
  }

  const role = membership.role as Role;
  if (RANK[role] < RANK[minRole]) {
    throw new AuthzError("You do not have permission to perform this action.");
  }

  return membership;
}

/** Resolve the projectId that owns an environment, or null if missing. */
export async function projectIdForEnvironment(
  environmentId: string
): Promise<string | null> {
  const env = await prisma.environment.findUnique({
    where: { id: environmentId },
    select: { projectId: true },
  });
  return env?.projectId ?? null;
}

/** Resolve the projectId that owns a secret, or null if missing. */
export async function projectIdForSecret(
  secretId: string
): Promise<string | null> {
  const secret = await prisma.secret.findUnique({
    where: { id: secretId },
    select: { environment: { select: { projectId: true } } },
  });
  return secret?.environment.projectId ?? null;
}
