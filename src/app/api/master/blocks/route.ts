import { NextRequest, NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { eq, sql } from "drizzle-orm";
import { getDb } from "@/db";
import { blocks, pumps } from "@/db/schema";
import { requireApiSession } from "@/lib/auth";
import {
  blockCreateSchema,
  blockPatchSchema,
  deleteByIdSchema,
  extractDeleteId,
} from "@/lib/master-validation";
import { MASTER_TREE_TAG } from "@/lib/queries/master";

export async function POST(request: NextRequest) {
  const auth = await requireApiSession("admin");
  if ("error" in auth) return auth.error;

  const body = await request.json();
  const parsed = blockCreateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Data Block tidak valid." }, { status: 400 });
  }

  const db = getDb();
  try {
    const [created] = await db
      .insert(blocks)
      .values({
        estateId: parsed.data.estateId,
        code: parsed.data.code.trim(),
        name: parsed.data.name.trim(),
      })
      .returning();
    revalidateTag(MASTER_TREE_TAG);
    return NextResponse.json({ item: created }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Kode Block sudah ada pada Estate ini." }, { status: 409 });
  }
}

export async function PATCH(request: NextRequest) {
  const auth = await requireApiSession("admin");
  if ("error" in auth) return auth.error;

  const body = await request.json();
  const parsed = blockPatchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Data pembaruan Block tidak valid." }, { status: 400 });
  }

  const updates: Record<string, unknown> = {};
  if (parsed.data.estateId !== undefined) updates.estateId = parsed.data.estateId;
  if (parsed.data.code !== undefined) updates.code = parsed.data.code.trim();
  if (parsed.data.name !== undefined) updates.name = parsed.data.name.trim();
  if (parsed.data.isActive !== undefined) updates.isActive = parsed.data.isActive;

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "Tidak ada data Block yang diperbarui." }, { status: 400 });
  }

  const db = getDb();
  try {
    const [updated] = await db
      .update(blocks)
      .set(updates)
      .where(eq(blocks.id, parsed.data.id))
      .returning();
    if (!updated) return NextResponse.json({ error: "Block tidak ditemukan." }, { status: 404 });
    revalidateTag(MASTER_TREE_TAG);
    return NextResponse.json({ item: updated });
  } catch {
    return NextResponse.json(
      { error: "Kode Block bentrok pada Estate yang dipilih." },
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
    return NextResponse.json({ error: "ID Block tidak valid." }, { status: 400 });
  }

  const db = getDb();
  const [{ count }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(pumps)
    .where(eq(pumps.blockId, parsed.data.id));

  if (count > 0) {
    return NextResponse.json(
      {
        error: `Block tidak dapat dihapus karena masih dipakai oleh ${count} unit Pompa. Pindahkan lokasi pompa terlebih dahulu atau gunakan Nonaktifkan.`,
      },
      { status: 409 }
    );
  }

  const [deleted] = await db
    .delete(blocks)
    .where(eq(blocks.id, parsed.data.id))
    .returning({ id: blocks.id });

  if (!deleted) {
    return NextResponse.json({ error: "Block tidak ditemukan." }, { status: 404 });
  }

  revalidateTag(MASTER_TREE_TAG);
  return NextResponse.json({ deletedId: deleted.id });
}
