import { prisma } from "@/lib/db";
import { handle, error, requireSession } from "@/lib/api";
import { requireEnvironmentAccess } from "@/lib/authz";
import { decrypt } from "@/lib/crypto";
import { formatEnv } from "@/lib/env-format";

type Params = { params: Promise<{ id: string }> };

// GET /api/environments/[id]/export — return the environment as .env text (viewer+ with access).
export async function GET(_req: Request, { params }: Params) {
  return handle(async () => {
    const session = await requireSession();
    const { id } = await params;
    await requireEnvironmentAccess(session.userId, id, "viewer");

    const env = await prisma.environment.findUnique({
      where: { id },
      include: { secrets: { orderBy: { key: "asc" } } },
    });
    if (!env) return error("Not found", 404);

    const text = formatEnv(
      env.secrets.map((s) => ({
        key: s.key,
        value: decrypt({ ciphertext: s.ciphertext, iv: s.iv, authTag: s.authTag }),
      }))
    );

    return new Response(text + (text ? "\n" : ""), {
      status: 200,
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Content-Disposition": `attachment; filename=".env.${env.name}"`,
      },
    });
  });
}
