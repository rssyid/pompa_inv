import { NextRequest, NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { issuePresets } from "@/db/schema";
import { requireApiSession } from "@/lib/auth";
import {
  deleteByIdSchema,
  extractDeleteId,
  issuePresetCreateSchema,
  issuePresetPatchSchema,
} from "@/lib/master-validation";
import { MASTER_TREE_TAG } from "@/lib/queries/master";

export async function POST(request: NextRequest) {
  const auth = await requireApiSession("admin");
  if ("error" in auth) return auth.error;

  const body = await request.json();
  const parsed = issuePresetCreateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Data Temuan Standar tidak valid." }, { status: 400 });
  }

  const db = getDb();
  try {
    const [created] = await db
      .insert(issuePresets)
      .values({
        label: parsed.data.label.trim(),
        defaultAvailability: parsed.data.defaultAvailability,
        defaultCondition: parsed.data.defaultCondition,
        sortOrder: parsed.data.sortOrder,
      })
      .returning();
    revalidateTag(MASTER_TREE_TAG);
    return NextResponse.json({ item: created }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Temuan Standar sudah terdaftar." }, { status: 409 });
  }
}

export async function PATCH(request: NextRequest) {
  const auth = await requireApiSession("admin");
  if ("error" in auth) return auth.error;

  const body = await request.json();
  const parsed = issuePresetPatchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Data pembaruan Temuan Standar tidak valid." },
      { status: 400 }
    );
  }

  const updates: Record<string, unknown> = {};
  if (parsed.data.label !== undefined) updates.label = parsed.data.label.trim();
  if (parsed.data.defaultAvailability !== undefined)
    updates.defaultAvailability = parsed.data.defaultAvailability;
  if (parsed.data.defaultCondition !== undefined)
    updates.defaultCondition = parsed.data.defaultCondition;
  if (parsed.data.sortOrder !== undefined) updates.sortOrder = parsed.data.sortOrder;
  if (parsed.data.isActive !== undefined) updates.isActive = parsed.data.isActive;

  if (Object.keys(updates).length === 0) {
    return NextResponse.json(
      { error: "Tidak ada data Temuan Standar yang diperbarui." },
      { status: 400 }
    );
  }

  const db = getDb();
  try {
    const [updated] = await db
      .update(issuePresets)
      .set(updates)
      .where(eq(issuePresets.id, parsed.data.id))
      .returning();
    if (!updated) {
      return NextResponse.json({ error: "Temuan Standar tidak ditemukan." }, { status: 404 });
    }
    revalidateTag(MASTER_TREE_TAG);
    return NextResponse.json({ item: updated });
  } catch {
    return NextResponse.json({ error: "Label Temuan Standar sudah terdaftar." }, { status: 409 });
  }
}

export async function DELETE(request: NextRequest) {
  const auth = await requireApiSession("admin");
  if ("error" in auth) return auth.error;

  const rawId = await extractDeleteId(request);
  const parsed = deleteByIdSchema.safeParse({ id: rawId });
  if (!parsed.success) {
    return NextResponse.json({ error: "ID Temuan Standar tidak valid." }, { status: 400 });
  }

  const db = getDb();
  const [deleted] = await db
    .delete(issuePresets)
    .where(eq(issuePresets.id, parsed.data.id))
    .returning({ id: issuePresets.id });

  if (!deleted) {
    return NextResponse.json({ error: "Temuan Standar tidak ditemukan." }, { status: 404 });
  }

  revalidateTag(MASTER_TREE_TAG);
  return NextResponse.json({ deletedId: deleted.id });
}
