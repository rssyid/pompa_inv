import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/db";
import { engineBrands } from "@/db/schema";
import { requireApiSession } from "@/lib/auth";

const createSchema = z.object({
  name: z.string().min(2).max(80),
});

const patchSchema = z.object({
  id: z.number().int().positive(),
  name: z.string().min(2).max(80).optional(),
  isActive: z.boolean().optional(),
});

export async function POST(request: NextRequest) {
  const auth = await requireApiSession("admin");
  if ("error" in auth) return auth.error;

  const body = await request.json();
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Nama Merek Mesin wajib diisi." }, { status: 400 });
  }

  const db = getDb();
  try {
    const [created] = await db
      .insert(engineBrands)
      .values({ name: parsed.data.name.trim() })
      .returning();
    return NextResponse.json({ item: created }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Merek Mesin sudah ada." }, { status: 409 });
  }
}

export async function PATCH(request: NextRequest) {
  const auth = await requireApiSession("admin");
  if ("error" in auth) return auth.error;

  const body = await request.json();
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Data pembaruan Merek Mesin tidak valid." }, { status: 400 });
  }

  const updates: Record<string, unknown> = {};
  if (parsed.data.name !== undefined) updates.name = parsed.data.name.trim();
  if (parsed.data.isActive !== undefined) updates.isActive = parsed.data.isActive;

  const db = getDb();
  const [updated] = await db
    .update(engineBrands)
    .set(updates)
    .where(eq(engineBrands.id, parsed.data.id))
    .returning();
  if (!updated) return NextResponse.json({ error: "Merek Mesin tidak ditemukan." }, { status: 404 });
  return NextResponse.json({ item: updated });
}
