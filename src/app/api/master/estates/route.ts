import { NextRequest, NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { eq, sql } from "drizzle-orm";
import { getDb } from "@/db";
import { blocks, estates, pumps } from "@/db/schema";
import { requireApiSession } from "@/lib/auth";
import {
  deleteByIdSchema,
  estateBatchOrdersSchema,
  estateCreateSchema,
  estatePatchSchema,
  extractDeleteId,
} from "@/lib/master-validation";
import { MASTER_TREE_TAG } from "@/lib/queries/master";

export async function POST(request: NextRequest) {
  const auth = await requireApiSession("admin");
  if ("error" in auth) return auth.error;

  const body = await request.json();
  const parsed = estateCreateSchema.safeParse(body);
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
        sortOrder: parsed.data.sortOrder ?? 0,
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

  if (body && typeof body === "object" && "orders" in body) {
    const batchParsed = estateBatchOrdersSchema.safeParse(body);
    if (!batchParsed.success) {
      return NextResponse.json({ error: "Data urutan Estate tidak valid." }, { status: 400 });
    }

    const db = getDb();
    for (const entry of batchParsed.data.orders) {
      await db
        .update(estates)
        .set({ sortOrder: entry.sortOrder })
        .where(eq(estates.id, entry.id));
    }
    revalidateTag(MASTER_TREE_TAG);
    return NextResponse.json({ updatedCount: batchParsed.data.orders.length });
  }

  const parsed = estatePatchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Data pembaruan Estate tidak valid." }, { status: 400 });
  }

  const updates: Record<string, unknown> = {};
  if (parsed.data.regionId !== undefined) updates.regionId = parsed.data.regionId;
  if (parsed.data.code !== undefined) updates.code = parsed.data.code.trim().toUpperCase();
  if (parsed.data.name !== undefined) updates.name = parsed.data.name.trim();
  if (parsed.data.sortOrder !== undefined) updates.sortOrder = parsed.data.sortOrder;
  if (parsed.data.isActive !== undefined) updates.isActive = parsed.data.isActive;

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "Tidak ada data Estate yang diperbarui." }, { status: 400 });
  }

  const db = getDb();
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
    return NextResponse.json(
      { error: "Kode Estate bentrok pada Region yang dipilih." },
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
    return NextResponse.json({ error: "ID Estate tidak valid." }, { status: 400 });
  }

  const db = getDb();
  const [[{ blockCount }], [{ pumpCount }]] = await Promise.all([
    db
      .select({ blockCount: sql<number>`count(*)::int` })
      .from(blocks)
      .where(eq(blocks.estateId, parsed.data.id)),
    db
      .select({ pumpCount: sql<number>`count(*)::int` })
      .from(pumps)
      .where(eq(pumps.estateId, parsed.data.id)),
  ]);

  if (blockCount > 0 || pumpCount > 0) {
    const refs: string[] = [];
    if (blockCount > 0) refs.push(`${blockCount} Block`);
    if (pumpCount > 0) refs.push(`${pumpCount} unit Pompa`);
    return NextResponse.json(
      {
        error: `Estate tidak dapat dihapus karena masih dipakai oleh ${refs.join(" dan ")}. Hapus/pindahkan data terkait terlebih dahulu atau gunakan Nonaktifkan.`,
      },
      { status: 409 }
    );
  }

  const [deleted] = await db
    .delete(estates)
    .where(eq(estates.id, parsed.data.id))
    .returning({ id: estates.id });

  if (!deleted) {
    return NextResponse.json({ error: "Estate tidak ditemukan." }, { status: 404 });
  }

  revalidateTag(MASTER_TREE_TAG);
  return NextResponse.json({ deletedId: deleted.id });
}
