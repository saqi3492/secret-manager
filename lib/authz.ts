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

/** Resolve the environmentId that owns a secret, or null if missing. */
export async function environmentIdForSecret(
  secretId: string
): Promise<string | null> {
  const secret = await prisma.secret.findUnique({
    where: { id: secretId },
    select: { environmentId: true },
  });
  return secret?.environmentId ?? null;
}

/**
 * Ensure `userId` can act on `environmentId` with at least `minRole`.
 *
 * - Owners implicitly have access to every environment in their project.
 * - Editors/viewers must additionally have an explicit EnvironmentAccess grant
 *   for this environment; without it we return 404 so the environment's
 *   existence isn't leaked.
 *
 * Returns { projectId, role } or throws AuthzError (403/404).
 */
export async function requireEnvironmentAccess(
  userId: string,
  environmentId: string,
  minRole: Role
): Promise<{ projectId: string; role: Role }> {
  const env = await prisma.environment.findUnique({
    where: { id: environmentId },
    select: { projectId: true },
  });
  if (!env) throw new AuthzError("Not found", 404);

  const membership = await prisma.membership.findUnique({
    where: { userId_projectId: { userId, projectId: env.projectId } },
  });
  if (!membership) throw new AuthzError("Not found", 404);

  const role = membership.role as Role;

  // Existence/visibility check first: a member without access to this specific
  // environment gets a uniform 404, so we never leak that it exists — regardless
  // of the action being attempted.
  if (role !== "owner") {
    const access = await prisma.environmentAccess.findUnique({
      where: { userId_environmentId: { userId, environmentId } },
    });
    if (!access) throw new AuthzError("Not found", 404);
  }

  // Then the permission check: they can see the environment but their role may
  // be too low for this action (e.g. a viewer trying to write).
  if (RANK[role] < RANK[minRole]) {
    throw new AuthzError("You do not have permission to perform this action.");
  }

  return { projectId: env.projectId, role };
}

/**
 * The set of environment ids (within a project) a user may see.
 * Owners see all; others see only their granted environments.
 */
export async function accessibleEnvironmentIds(
  userId: string,
  projectId: string,
  role: Role
): Promise<Set<string>> {
  if (role === "owner") {
    const envs = await prisma.environment.findMany({
      where: { projectId },
      select: { id: true },
    });
    return new Set(envs.map((e) => e.id));
  }

  const rows = await prisma.environmentAccess.findMany({
    where: { userId, environment: { projectId } },
    select: { environmentId: true },
  });
  return new Set(rows.map((r) => r.environmentId));
}
