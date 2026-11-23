import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/db";
import { users } from "@/db/schema";
import { hashPassword, requireApiSession } from "@/lib/auth";

const updateUserSchema = z.object({
  name: z.string().min(2).max(80).optional(),
  role: z.enum(["admin", "petugas"]).optional(),
  defaultEstateId: z.number().int().positive().nullable().optional(),
  isActive: z.boolean().optional(),
  newPassword: z.string().min(6, "Kata sandi baru minimal 6 karakter.").optional(),
});

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const auth = await requireApiSession("admin");
  if ("error" in auth) return auth.error;

  const { id } = await context.params;
  const userId = Number(id);
  if (!Number.isInteger(userId) || userId <= 0) {
    return NextResponse.json({ error: "ID user tidak valid." }, { status: 400 });
  }

  try {
    const body = await request.json();
    const parsed = updateUserSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Data pembaruan tidak valid." },
        { status: 400 }
      );
    }

    if (userId === auth.user.userId && parsed.data.isActive === false) {
      return NextResponse.json(
        { error: "Anda tidak dapat menonaktifkan akun yang sedang dipakai login." },
        { status: 400 }
      );
    }

    const updates: Record<string, unknown> = {};
    if (parsed.data.name !== undefined) updates.name = parsed.data.name.trim();
    if (parsed.data.role !== undefined) updates.role = parsed.data.role;
    if (parsed.data.defaultEstateId !== undefined)
      updates.defaultEstateId = parsed.data.defaultEstateId;
    if (parsed.data.isActive !== undefined) updates.isActive = parsed.data.isActive;
    if (parsed.data.newPassword) {
      updates.passwordHash = await hashPassword(parsed.data.newPassword);
    }

    const db = getDb();
    const [updated] = await db
      .update(users)
      .set(updates)
      .where(eq(users.id, userId))
      .returning({
        id: users.id,
        username: users.username,
        name: users.name,
        role: users.role,
        defaultEstateId: users.defaultEstateId,
        isActive: users.isActive,
      });

    if (!updated) {
      return NextResponse.json({ error: "User tidak ditemukan." }, { status: 404 });
    }

    return NextResponse.json({ user: updated });
  } catch (err) {
    console.error("Update user error:", err);
    return NextResponse.json({ error: "Gagal memperbarui data user." }, { status: 500 });
  }
}
