import { NextRequest, NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { eq, sql } from "drizzle-orm";
import { getDb } from "@/db";
import { companies, regions } from "@/db/schema";
import { requireApiSession } from "@/lib/auth";
import {
  companyCreateSchema,
  companyPatchSchema,
  deleteByIdSchema,
  extractDeleteId,
} from "@/lib/master-validation";
import { MASTER_TREE_TAG } from "@/lib/queries/master";

export async function POST(request: NextRequest) {
  const auth = await requireApiSession("admin");
  if ("error" in auth) return auth.error;

  const body = await request.json();
  const parsed = companyCreateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Data PT tidak valid." },
      { status: 400 }
    );
  }

  const db = getDb();
  try {
    const [created] = await db
      .insert(companies)
      .values({ code: parsed.data.code.trim().toUpperCase(), name: parsed.data.name.trim() })
      .returning();
    revalidateTag(MASTER_TREE_TAG);
    return NextResponse.json({ item: created }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Kode PT sudah terdaftar." }, { status: 409 });
  }
}

export async function PATCH(request: NextRequest) {
  const auth = await requireApiSession("admin");
  if ("error" in auth) return auth.error;

  const body = await request.json();
  const parsed = companyPatchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Data pembaruan PT tidak valid." }, { status: 400 });
  }

  const updates: Record<string, unknown> = {};
  if (parsed.data.code !== undefined) updates.code = parsed.data.code.trim().toUpperCase();
  if (parsed.data.name !== undefined) updates.name = parsed.data.name.trim();
  if (parsed.data.isActive !== undefined) updates.isActive = parsed.data.isActive;

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "Tidak ada data PT yang diperbarui." }, { status: 400 });
  }

  const db = getDb();
  try {
    const [updated] = await db
      .update(companies)
      .set(updates)
      .where(eq(companies.id, parsed.data.id))
      .returning();
    if (!updated) return NextResponse.json({ error: "PT tidak ditemukan." }, { status: 404 });
    revalidateTag(MASTER_TREE_TAG);
    return NextResponse.json({ item: updated });
  } catch {
    return NextResponse.json({ error: "Kode PT bentrok dengan data lain." }, { status: 409 });
  }
}

export async function DELETE(request: NextRequest) {
  const auth = await requireApiSession("admin");
  if ("error" in auth) return auth.error;

  const rawId = await extractDeleteId(request);
  const parsed = deleteByIdSchema.safeParse({ id: rawId });
  if (!parsed.success) {
    return NextResponse.json({ error: "ID PT tidak valid." }, { status: 400 });
  }

  const db = getDb();
  const [{ count }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(regions)
    .where(eq(regions.companyId, parsed.data.id));

  if (count > 0) {
    return NextResponse.json(
      {
        error: `PT tidak dapat dihapus karena masih memiliki ${count} Region. Hapus Region terkait terlebih dahulu atau gunakan Nonaktifkan.`,
      },
      { status: 409 }
    );
  }

  const [deleted] = await db
    .delete(companies)
    .where(eq(companies.id, parsed.data.id))
    .returning({ id: companies.id });

  if (!deleted) {
    return NextResponse.json({ error: "PT tidak ditemukan." }, { status: 404 });
  }

  revalidateTag(MASTER_TREE_TAG);
  return NextResponse.json({ deletedId: deleted.id });
}
