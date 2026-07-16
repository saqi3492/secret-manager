import { z } from "zod";
import { prisma } from "@/lib/db";
import { handle, json, error, requireSession } from "@/lib/api";
import { requireRole, projectIdForEnvironment } from "@/lib/authz";
import { encrypt } from "@/lib/crypto";
import { parseEnv } from "@/lib/env-format";

type Params = { params: Promise<{ id: string }> };

const schema = z.object({
  content: z.string().min(1, "Paste some .env content to import"),
  overwrite: z.boolean().optional().default(true),
});

// POST /api/environments/[id]/import — parse pasted .env text and upsert secrets
// (editor+). `overwrite` controls whether existing keys are updated.
export async function POST(req: Request, { params }: Params) {
  return handle(async () => {
    const session = await requireSession();
    const { id } = await params;
    const projectId = await projectIdForEnvironment(id);
    if (!projectId) return error("Not found", 404);
    await requireRole(session.userId, projectId, "editor");

    const body = schema.parse(await req.json());
    const pairs = parseEnv(body.content);
    if (pairs.length === 0) {
      return error("No valid KEY=value lines found.", 422);
    }

    let created = 0;
    let updated = 0;
    let skipped = 0;

    for (const { key, value } of pairs) {
      const enc = encrypt(value);
      const existing = await prisma.secret.findUnique({
        where: { environmentId_key: { environmentId: id, key } },
      });
      if (existing) {
        if (body.overwrite) {
          await prisma.secret.update({ where: { id: existing.id }, data: enc });
          updated++;
        } else {
          skipped++;
        }
      } else {
        await prisma.secret.create({ data: { environmentId: id, key, ...enc } });
        created++;
      }
    }

    return json({ created, updated, skipped, total: pairs.length });
  });
}
