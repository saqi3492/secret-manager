import crypto from "crypto";

/** A URL-safe random token for invitation links. */
export function generateInviteToken(): string {
  return crypto.randomBytes(24).toString("hex");
}

/** Reconstruct the app's base URL from the incoming request headers. */
export function baseUrl(req: Request): string {
  const proto = req.headers.get("x-forwarded-proto") ?? "http";
  const host = req.headers.get("host") ?? "localhost:3000";
  return `${proto}://${host}`;
}

/** Build the shareable invite link for a token. */
export function inviteUrl(req: Request, token: string): string {
  return `${baseUrl(req)}/invite/${token}`;
}
