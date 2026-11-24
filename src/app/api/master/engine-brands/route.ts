import { NextRequest, NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { eq, sql } from "drizzle-orm";
import { getDb } from "@/db";
import { engineBrands, pumps } from "@/db/schema";
import { requireApiSession } from "@/lib/auth";
import {
  deleteByIdSchema,
  engineBrandCreateSchema,
  engineBrandPatchSchema,
  extractDeleteId,
} from "@/lib/master-validation";
import { MASTER_TREE_TAG } from "@/lib/queries/master";

export async function POST(request: NextRequest) {
  const auth = await requireApiSession("admin");
  if ("error" in auth) return auth.error;

  const body = await request.json();
  const parsed = engineBrandCreateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Nama Merek Mesin wajib diisi." }, { status: 400 });
  }

  const db = getDb();
  try {
    const [created] = await db
      .insert(engineBrands)
      .values({ name: parsed.data.name.trim() })
      .returning();
    revalidateTag(MASTER_TREE_TAG);
    return NextResponse.json({ item: created }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Merek Mesin sudah ada." }, { status: 409 });
  }
}

export async function PATCH(request: NextRequest) {
  const auth = await requireApiSession("admin");
  if ("error" in auth) return auth.error;

  const body = await request.json();
  const parsed = engineBrandPatchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Data pembaruan Merek Mesin tidak valid." }, { status: 400 });
  }

  const updates: Record<string, unknown> = {};
  if (parsed.data.name !== undefined) updates.name = parsed.data.name.trim();
  if (parsed.data.isActive !== undefined) updates.isActive = parsed.data.isActive;

  if (Object.keys(updates).length === 0) {
    return NextResponse.json(
      { error: "Tidak ada data Merek Mesin yang diperbarui." },
      { status: 400 }
    );
  }

  const db = getDb();
  try {
    const [updated] = await db
      .update(engineBrands)
      .set(updates)
      .where(eq(engineBrands.id, parsed.data.id))
      .returning();
    if (!updated) {
      return NextResponse.json({ error: "Merek Mesin tidak ditemukan." }, { status: 404 });
    }
    revalidateTag(MASTER_TREE_TAG);
    return NextResponse.json({ item: updated });
  } catch {
    return NextResponse.json({ error: "Nama Merek Mesin sudah terdaftar." }, { status: 409 });
  }
}

export async function DELETE(request: NextRequest) {
  const auth = await requireApiSession("admin");
  if ("error" in auth) return auth.error;

  const rawId = await extractDeleteId(request);
  const parsed = deleteByIdSchema.safeParse({ id: rawId });
  if (!parsed.success) {
    return NextResponse.json({ error: "ID Merek Mesin tidak valid." }, { status: 400 });
  }

  const db = getDb();
  const [{ count }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(pumps)
    .where(eq(pumps.engineBrandId, parsed.data.id));

  if (count > 0) {
    return NextResponse.json(
      {
        error: `Merek Mesin tidak dapat dihapus karena masih dipakai oleh ${count} unit Pompa. Ubah merek mesin pada unit terkait terlebih dahulu atau gunakan Nonaktifkan.`,
      },
      { status: 409 }
    );
  }

  const [deleted] = await db
    .delete(engineBrands)
    .where(eq(engineBrands.id, parsed.data.id))
    .returning({ id: engineBrands.id });

  if (!deleted) {
    return NextResponse.json({ error: "Merek Mesin tidak ditemukan." }, { status: 404 });
  }

  revalidateTag(MASTER_TREE_TAG);
  return NextResponse.json({ deletedId: deleted.id });
}
