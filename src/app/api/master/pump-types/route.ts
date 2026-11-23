import { NextRequest, NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/db";
import { pumpTypes } from "@/db/schema";
import { requireApiSession } from "@/lib/auth";
import { MASTER_TREE_TAG } from "@/lib/queries/master";

const createSchema = z.object({
  code: z.string().min(2).max(40),
  name: z.string().min(2).max(100),
  description: z.string().max(240).optional(),
});

const patchSchema = z.object({
  id: z.number().int().positive(),
  name: z.string().min(2).max(100).optional(),
  description: z.string().max(240).nullable().optional(),
  isActive: z.boolean().optional(),
});

export async function POST(request: NextRequest) {
  const auth = await requireApiSession("admin");
  if ("error" in auth) return auth.error;

  const body = await request.json();
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Data Jenis Pompa tidak valid." }, { status: 400 });
  }

  const db = getDb();
  const code = parsed.data.code.trim().toLowerCase().replace(/\s+/g, "_");
  try {
    const [created] = await db
      .insert(pumpTypes)
      .values({
        code,
        name: parsed.data.name.trim(),
        description: parsed.data.description?.trim() || null,
      })
      .returning();
    revalidateTag(MASTER_TREE_TAG);
    return NextResponse.json({ item: created }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Kode Jenis Pompa sudah terdaftar." }, { status: 409 });
  }
}

export async function PATCH(request: NextRequest) {
  const auth = await requireApiSession("admin");
  if ("error" in auth) return auth.error;

  const body = await request.json();
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Data pembaruan Jenis Pompa tidak valid." }, { status: 400 });
  }

  const db = getDb();
  const updates: Record<string, unknown> = {};
  if (parsed.data.name !== undefined) updates.name = parsed.data.name.trim();
  if (parsed.data.description !== undefined) updates.description = parsed.data.description;
  if (parsed.data.isActive !== undefined) updates.isActive = parsed.data.isActive;

  const [updated] = await db
    .update(pumpTypes)
    .set(updates)
    .where(eq(pumpTypes.id, parsed.data.id))
    .returning();

  if (!updated) return NextResponse.json({ error: "Jenis Pompa tidak ditemukan." }, { status: 404 });
  revalidateTag(MASTER_TREE_TAG);
  return NextResponse.json({ item: updated });
}
