import { NextResponse } from "next/server";
import { getSession, destroySession, type SessionPayload } from "@/lib/auth";
import { AuthzError } from "@/lib/authz";
import { prisma } from "@/lib/db";

export function json(data: unknown, status = 200) {
  return NextResponse.json(data, { status });
}

export function error(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

/**
 * Return the current session, or throw AuthzError(401).
 * Also verifies the session's user still exists — a valid-but-stale token
 * (e.g. after the user was deleted or the database was reset) is cleared and
 * treated as logged out instead of causing a foreign-key crash downstream.
 */
export async function requireSession(): Promise<SessionPayload> {
  const session = await getSession();
  if (!session) throw new AuthzError("Not authenticated", 401);

  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    select: { id: true },
  });
  if (!user) {
    await destroySession();
    throw new AuthzError("Your session has expired. Please log in again.", 401);
  }

  return session;
}

/**
 * Wrap a route handler so thrown AuthzErrors / ZodErrors / generic errors
 * become clean JSON responses.
 */
export function handle(
  fn: () => Promise<Response>
): Promise<Response> {
  return fn().catch((err: unknown) => {
    if (err instanceof AuthzError) return error(err.message, err.status);
    if (err && typeof err === "object" && "issues" in err) {
      // ZodError
      const issues = (err as { issues: { message: string }[] }).issues;
      return error(issues.map((i) => i.message).join("; "), 422);
    }
    console.error(err);
    return error("Internal server error", 500);
  });
}
