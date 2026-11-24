import { NextRequest, NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { eq, sql } from "drizzle-orm";
import { getDb } from "@/db";
import { pumps, pumpTypes } from "@/db/schema";
import { requireApiSession } from "@/lib/auth";
import {
  deleteByIdSchema,
  extractDeleteId,
  normalizePumpTypeCode,
  pumpTypeCreateSchema,
  pumpTypePatchSchema,
} from "@/lib/master-validation";
import { MASTER_TREE_TAG } from "@/lib/queries/master";

export async function POST(request: NextRequest) {
  const auth = await requireApiSession("admin");
  if ("error" in auth) return auth.error;

  const body = await request.json();
  const parsed = pumpTypeCreateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Data Jenis Pompa tidak valid." }, { status: 400 });
  }

  const db = getDb();
  const code = normalizePumpTypeCode(parsed.data.code);
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
  const parsed = pumpTypePatchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Data pembaruan Jenis Pompa tidak valid." }, { status: 400 });
  }

  const updates: Record<string, unknown> = {};
  if (parsed.data.code !== undefined) updates.code = normalizePumpTypeCode(parsed.data.code);
  if (parsed.data.name !== undefined) updates.name = parsed.data.name.trim();
  if (parsed.data.description !== undefined)
    updates.description = parsed.data.description ? parsed.data.description.trim() || null : null;
  if (parsed.data.isActive !== undefined) updates.isActive = parsed.data.isActive;

  if (Object.keys(updates).length === 0) {
    return NextResponse.json(
      { error: "Tidak ada data Jenis Pompa yang diperbarui." },
      { status: 400 }
    );
  }

  const db = getDb();
  try {
    const [updated] = await db
      .update(pumpTypes)
      .set(updates)
      .where(eq(pumpTypes.id, parsed.data.id))
      .returning();

    if (!updated) {
      return NextResponse.json({ error: "Jenis Pompa tidak ditemukan." }, { status: 404 });
    }
    revalidateTag(MASTER_TREE_TAG);
    return NextResponse.json({ item: updated });
  } catch {
    return NextResponse.json(
      { error: "Kode Jenis Pompa bentrok dengan data lain." },
      { status: 409 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  const auth = await requireApiSession("admin");
  if ("error" in auth) return auth.error;

  const rawId = await extractDeleteId(request);
  const parsed = deleteByIdSchema.safeParse({ id: rawId });
  if (!parsed.success) {
    return NextResponse.json({ error: "ID Jenis Pompa tidak valid." }, { status: 400 });
  }

  const db = getDb();
  const [{ count }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(pumps)
    .where(eq(pumps.pumpTypeId, parsed.data.id));

  if (count > 0) {
    return NextResponse.json(
      {
        error: `Jenis Pompa tidak dapat dihapus karena masih dipakai oleh ${count} unit Pompa. Ubah jenis pompa pada unit terkait terlebih dahulu atau gunakan Nonaktifkan.`,
      },
      { status: 409 }
    );
  }

  const [deleted] = await db
    .delete(pumpTypes)
    .where(eq(pumpTypes.id, parsed.data.id))
    .returning({ id: pumpTypes.id });

  if (!deleted) {
    return NextResponse.json({ error: "Jenis Pompa tidak ditemukan." }, { status: 404 });
  }

  revalidateTag(MASTER_TREE_TAG);
  return NextResponse.json({ deletedId: deleted.id });
}
