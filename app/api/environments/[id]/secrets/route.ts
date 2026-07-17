import { z } from "zod";
import { prisma } from "@/lib/db";
import { handle, json, error, requireSession } from "@/lib/api";
import { requireEnvironmentAccess } from "@/lib/authz";
import { encrypt, decrypt } from "@/lib/crypto";

type Params = { params: Promise<{ id: string }> };

// GET /api/environments/[id]/secrets — decrypted key/value list (viewer+ with access).
export async function GET(_req: Request, { params }: Params) {
  return handle(async () => {
    const session = await requireSession();
    const { id } = await params;
    await requireEnvironmentAccess(session.userId, id, "viewer");

    const secrets = await prisma.secret.findMany({
      where: { environmentId: id },
      orderBy: { key: "asc" },
    });

    return json(
      secrets.map((s) => ({
        id: s.id,
        key: s.key,
        value: decrypt({ ciphertext: s.ciphertext, iv: s.iv, authTag: s.authTag }),
        updatedAt: s.updatedAt,
      }))
    );
  });
}

const createSchema = z.object({
  key: z
    .string()
    .trim()
    .min(1, "Key is required")
    .regex(/^[A-Za-z_][A-Za-z0-9_]*$/, "Key must be a valid env variable name"),
  value: z.string(),
});

// POST /api/environments/[id]/secrets — create one secret (editor+ with access).
export async function POST(req: Request, { params }: Params) {
  return handle(async () => {
    const session = await requireSession();
    const { id } = await params;
    await requireEnvironmentAccess(session.userId, id, "editor");

    const body = createSchema.parse(await req.json());
    const existing = await prisma.secret.findUnique({
      where: { environmentId_key: { environmentId: id, key: body.key } },
    });
    if (existing) return error(`A secret named "${body.key}" already exists.`, 409);

    const enc = encrypt(body.value);
    const secret = await prisma.secret.create({
      data: { environmentId: id, key: body.key, ...enc },
    });

    return json({ id: secret.id, key: secret.key, value: body.value }, 201);
  });
}
