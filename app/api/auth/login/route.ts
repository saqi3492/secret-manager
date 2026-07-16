import { z } from "zod";
import { prisma } from "@/lib/db";
import { verifyPassword, createSession } from "@/lib/auth";
import { handle, json, error } from "@/lib/api";

const schema = z.object({
  email: z.string().trim().toLowerCase().email("A valid email is required"),
  password: z.string().min(1, "Password is required"),
});

export async function POST(req: Request) {
  return handle(async () => {
    const body = schema.parse(await req.json());

    const user = await prisma.user.findUnique({ where: { email: body.email } });
    if (!user || !user.passwordHash) {
      return error("Invalid email or password.", 401);
    }

    const ok = await verifyPassword(body.password, user.passwordHash);
    if (!ok) return error("Invalid email or password.", 401);

    await createSession({ userId: user.id, email: user.email, name: user.name });
    return json({ id: user.id, email: user.email, name: user.name });
  });
}
