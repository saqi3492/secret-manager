import { z } from "zod";
import { prisma } from "@/lib/db";
import { hashPassword, createSession } from "@/lib/auth";
import { handle, json, error } from "@/lib/api";

const schema = z.object({
  name: z.string().trim().min(1, "Name is required"),
  email: z.string().trim().toLowerCase().email("A valid email is required"),
  password: z.string().min(8, "Password must be at least 8 characters"),
});

export async function POST(req: Request) {
  return handle(async () => {
    const body = schema.parse(await req.json());

    const existing = await prisma.user.findUnique({
      where: { email: body.email },
    });

    // A placeholder user (invited but never signed up) has no passwordHash —
    // signing up "claims" that account so pending memberships carry over.
    if (existing && existing.passwordHash) {
      return error("An account with this email already exists.", 409);
    }

    const passwordHash = await hashPassword(body.password);

    const user = existing
      ? await prisma.user.update({
          where: { id: existing.id },
          data: { name: body.name, passwordHash },
        })
      : await prisma.user.create({
          data: { name: body.name, email: body.email, passwordHash },
        });

    await createSession({ userId: user.id, email: user.email, name: user.name });
    return json({ id: user.id, email: user.email, name: user.name }, 201);
  });
}
