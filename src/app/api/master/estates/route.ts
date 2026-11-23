import { NextRequest, NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/db";
import { estates } from "@/db/schema";
import { requireApiSession } from "@/lib/auth";
import { MASTER_TREE_TAG } from "@/lib/queries/master";

const createSchema = z.object({
  regionId: z.number().int().positive(),
  code: z.string().min(2).max(20),
  name: z.string().min(2).max(120),
});

const patchSchema = z.object({
  id: z.number().int().positive(),
  regionId: z.number().int().positive().optional(),
  code: z.string().min(2).max(20).optional(),
  name: z.string().min(2).max(120).optional(),
  isActive: z.boolean().optional(),
});

export async function POST(request: NextRequest) {
  const auth = await requireApiSession("admin");
  if ("error" in auth) return auth.error;

  const body = await request.json();
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Data Estate tidak valid." }, { status: 400 });
  }

  const db = getDb();
  try {
    const [created] = await db
      .insert(estates)
      .values({
        regionId: parsed.data.regionId,
        code: parsed.data.code.trim().toUpperCase(),
        name: parsed.data.name.trim(),
      })
      .returning();
    revalidateTag(MASTER_TREE_TAG);
    return NextResponse.json({ item: created }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Kode Estate sudah ada pada Region ini." }, { status: 409 });
  }
}

export async function PATCH(request: NextRequest) {
  const auth = await requireApiSession("admin");
  if ("error" in auth) return auth.error;

  const body = await request.json();
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Data pembaruan Estate tidak valid." }, { status: 400 });
  }

  const db = getDb();
  const updates: Record<string, unknown> = {};
  if (parsed.data.regionId !== undefined) updates.regionId = parsed.data.regionId;
  if (parsed.data.code !== undefined) updates.code = parsed.data.code.trim().toUpperCase();
  if (parsed.data.name !== undefined) updates.name = parsed.data.name.trim();
  if (parsed.data.isActive !== undefined) updates.isActive = parsed.data.isActive;

  try {
    const [updated] = await db
      .update(estates)
      .set(updates)
      .where(eq(estates.id, parsed.data.id))
      .returning();
    if (!updated) return NextResponse.json({ error: "Estate tidak ditemukan." }, { status: 404 });
    revalidateTag(MASTER_TREE_TAG);
    return NextResponse.json({ item: updated });
  } catch {
    return NextResponse.json({ error: "Kode Estate bentrok pada Region yang dipilih." }, { status: 409 });
  }
}
