import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/db";
import { pumpTypeParts } from "@/db/schema";
import { requireApiSession } from "@/lib/auth";

const createPartSchema = z.object({
  sectionCode: z.string().min(1).max(10),
  sectionName: z.string().min(1).max(80),
  itemNo: z.number().int().min(0),
  partName: z.string().min(1).max(160),
  defaultQty: z.number().int().min(1).default(1),
  sortOrder: z.number().int().min(0).default(100),
});

const patchPartSchema = z.object({
  partId: z.number().int().positive(),
  sectionCode: z.string().min(1).max(10).optional(),
  sectionName: z.string().min(1).max(80).optional(),
  itemNo: z.number().int().min(0).optional(),
  partName: z.string().min(1).max(160).optional(),
  defaultQty: z.number().int().min(1).optional(),
  sortOrder: z.number().int().min(0).optional(),
  isActive: z.boolean().optional(),
});

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
  const parsed = createPartSchema.safeParse(body);
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

  return NextResponse.json({ item: created }, { status: 201 });
}

export async function PATCH(request: NextRequest) {
  const auth = await requireApiSession("admin");
  if ("error" in auth) return auth.error;

  const body = await request.json();
  const parsed = patchPartSchema.safeParse(body);
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

  const db = getDb();
  const [updated] = await db
    .update(pumpTypeParts)
    .set(updates)
    .where(eq(pumpTypeParts.id, parsed.data.partId))
    .returning();

  if (!updated) return NextResponse.json({ error: "Komponen tidak ditemukan." }, { status: 404 });
  return NextResponse.json({ item: updated });
}
