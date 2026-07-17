import { z } from "zod";
import { prisma } from "@/lib/db";
import { handle, json, error, requireSession } from "@/lib/api";
import { requireEnvironmentAccess, environmentIdForSecret } from "@/lib/authz";
import { encrypt } from "@/lib/crypto";

type Params = { params: Promise<{ id: string }> };

const patchSchema = z.object({
  key: z
    .string()
    .trim()
    .min(1)
    .regex(/^[A-Za-z_][A-Za-z0-9_]*$/, "Key must be a valid env variable name")
    .optional(),
  value: z.string().optional(),
});

// PATCH /api/secrets/[id] — update key and/or value (editor+).
export async function PATCH(req: Request, { params }: Params) {
  return handle(async () => {
    const session = await requireSession();
    const { id } = await params;
    const environmentId = await environmentIdForSecret(id);
    if (!environmentId) return error("Not found", 404);
    await requireEnvironmentAccess(session.userId, environmentId, "editor");

    const body = patchSchema.parse(await req.json());
    const data: Record<string, string> = {};
    if (body.key !== undefined) data.key = body.key;
    if (body.value !== undefined) Object.assign(data, encrypt(body.value));

    try {
      const secret = await prisma.secret.update({ where: { id }, data });
      return json({ id: secret.id, key: secret.key });
    } catch {
      return error("A secret with that key already exists in this environment.", 409);
    }
  });
}

// DELETE /api/secrets/[id] — remove a secret (editor+).
export async function DELETE(_req: Request, { params }: Params) {
  return handle(async () => {
    const session = await requireSession();
    const { id } = await params;
    const environmentId = await environmentIdForSecret(id);
    if (!environmentId) return error("Not found", 404);
    await requireEnvironmentAccess(session.userId, environmentId, "editor");

    await prisma.secret.delete({ where: { id } });
    return json({ ok: true });
  });
}
