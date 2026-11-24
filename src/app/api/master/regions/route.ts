import { NextRequest, NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { eq, sql } from "drizzle-orm";
import { getDb } from "@/db";
import { estates, regions } from "@/db/schema";
import { requireApiSession } from "@/lib/auth";
import {
  deleteByIdSchema,
  extractDeleteId,
  regionCreateSchema,
  regionPatchSchema,
} from "@/lib/master-validation";
import { MASTER_TREE_TAG } from "@/lib/queries/master";

export async function POST(request: NextRequest) {
  const auth = await requireApiSession("admin");
  if ("error" in auth) return auth.error;

  const body = await request.json();
  const parsed = regionCreateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Data Region tidak valid." }, { status: 400 });
  }

  const db = getDb();
  try {
    const [created] = await db
      .insert(regions)
      .values({
        companyId: parsed.data.companyId,
        code: parsed.data.code.trim().toUpperCase(),
        name: parsed.data.name.trim(),
      })
      .returning();
    revalidateTag(MASTER_TREE_TAG);
    return NextResponse.json({ item: created }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Kode Region sudah ada pada PT ini." }, { status: 409 });
  }
}

export async function PATCH(request: NextRequest) {
  const auth = await requireApiSession("admin");
  if ("error" in auth) return auth.error;

  const body = await request.json();
  const parsed = regionPatchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Data pembaruan Region tidak valid." }, { status: 400 });
  }

  const updates: Record<string, unknown> = {};
  if (parsed.data.companyId !== undefined) updates.companyId = parsed.data.companyId;
  if (parsed.data.code !== undefined) updates.code = parsed.data.code.trim().toUpperCase();
  if (parsed.data.name !== undefined) updates.name = parsed.data.name.trim();
  if (parsed.data.isActive !== undefined) updates.isActive = parsed.data.isActive;

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "Tidak ada data Region yang diperbarui." }, { status: 400 });
  }

  const db = getDb();
  try {
    const [updated] = await db
      .update(regions)
      .set(updates)
      .where(eq(regions.id, parsed.data.id))
      .returning();
    if (!updated) return NextResponse.json({ error: "Region tidak ditemukan." }, { status: 404 });
    revalidateTag(MASTER_TREE_TAG);
    return NextResponse.json({ item: updated });
  } catch {
    return NextResponse.json(
      { error: "Kode Region bentrok pada PT yang dipilih." },
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
    return NextResponse.json({ error: "ID Region tidak valid." }, { status: 400 });
  }

  const db = getDb();
  const [{ count }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(estates)
    .where(eq(estates.regionId, parsed.data.id));

  if (count > 0) {
    return NextResponse.json(
      {
        error: `Region tidak dapat dihapus karena masih memiliki ${count} Estate. Hapus Estate terkait terlebih dahulu atau gunakan Nonaktifkan.`,
      },
      { status: 409 }
    );
  }

  const [deleted] = await db
    .delete(regions)
    .where(eq(regions.id, parsed.data.id))
    .returning({ id: regions.id });

  if (!deleted) {
    return NextResponse.json({ error: "Region tidak ditemukan." }, { status: 404 });
  }

  revalidateTag(MASTER_TREE_TAG);
  return NextResponse.json({ deletedId: deleted.id });
}
