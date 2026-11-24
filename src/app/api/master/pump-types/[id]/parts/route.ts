import { NextRequest, NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { and, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { pumpTypeParts } from "@/db/schema";
import { requireApiSession } from "@/lib/auth";
import {
  deletePartSchema,
  extractDeleteId,
  pumpTypePartCreateSchema,
  pumpTypePartPatchSchema,
} from "@/lib/master-validation";
import { MASTER_TREE_TAG } from "@/lib/queries/master";

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const auth = await requireApiSession("admin");
  if ("error" in auth) return auth.error;

  const { id } = await context.params;
  const pumpTypeId = Number(id);
  if (!Number.isInteger(pumpTypeId) || pumpTypeId <= 0) {
    return NextResponse.json({ error: "ID Jenis Pompa tidak valid." }, { status: 400 });
  }

  const body = await request.json();
  const parsed = pumpTypePartCreateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Data komponen tidak valid." }, { status: 400 });
  }

  const db = getDb();
  const [created] = await db
    .insert(pumpTypeParts)
    .values({
      pumpTypeId,
      sectionCode: parsed.data.sectionCode.trim().toUpperCase(),
      sectionName: parsed.data.sectionName.trim().toUpperCase(),
      itemNo: parsed.data.itemNo,
      partName: parsed.data.partName.trim(),
      defaultQty: parsed.data.defaultQty,
      sortOrder: parsed.data.sortOrder,
    })
    .returning();

  revalidateTag(MASTER_TREE_TAG);
  return NextResponse.json({ item: created }, { status: 201 });
}

export async function PATCH(request: NextRequest) {
  const auth = await requireApiSession("admin");
  if ("error" in auth) return auth.error;

  const body = await request.json();
  const parsed = pumpTypePartPatchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Data pembaruan komponen tidak valid." }, { status: 400 });
  }

  const updates: Record<string, unknown> = {};
  if (parsed.data.sectionCode !== undefined)
    updates.sectionCode = parsed.data.sectionCode.trim().toUpperCase();
  if (parsed.data.sectionName !== undefined)
    updates.sectionName = parsed.data.sectionName.trim().toUpperCase();
  if (parsed.data.itemNo !== undefined) updates.itemNo = parsed.data.itemNo;
  if (parsed.data.partName !== undefined) updates.partName = parsed.data.partName.trim();
  if (parsed.data.defaultQty !== undefined) updates.defaultQty = parsed.data.defaultQty;
  if (parsed.data.sortOrder !== undefined) updates.sortOrder = parsed.data.sortOrder;
  if (parsed.data.isActive !== undefined) updates.isActive = parsed.data.isActive;

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "Tidak ada data komponen yang diperbarui." }, { status: 400 });
  }

  const db = getDb();
  const [updated] = await db
    .update(pumpTypeParts)
    .set(updates)
    .where(eq(pumpTypeParts.id, parsed.data.partId))
    .returning();

  if (!updated) return NextResponse.json({ error: "Komponen tidak ditemukan." }, { status: 404 });
  revalidateTag(MASTER_TREE_TAG);
  return NextResponse.json({ item: updated });
}

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const auth = await requireApiSession("admin");
  if ("error" in auth) return auth.error;

  const { id } = await context.params;
  const pumpTypeId = Number(id);
  if (!Number.isInteger(pumpTypeId) || pumpTypeId <= 0) {
    return NextResponse.json({ error: "ID Jenis Pompa tidak valid." }, { status: 400 });
  }

  const rawPartId = await extractDeleteId(request, "partId");
  const parsed = deletePartSchema.safeParse({ partId: rawPartId });
  if (!parsed.success) {
    return NextResponse.json({ error: "ID Komponen tidak valid." }, { status: 400 });
  }

  const db = getDb();
  const [deleted] = await db
    .delete(pumpTypeParts)
    .where(
      and(eq(pumpTypeParts.id, parsed.data.partId), eq(pumpTypeParts.pumpTypeId, pumpTypeId))
    )
    .returning({ id: pumpTypeParts.id });

  if (!deleted) {
    return NextResponse.json({ error: "Komponen tidak ditemukan." }, { status: 404 });
  }

  revalidateTag(MASTER_TREE_TAG);
  return NextResponse.json({ deletedId: deleted.id });
}
