import { NextRequest, NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/db";
import { issuePresets } from "@/db/schema";
import { requireApiSession } from "@/lib/auth";
import { MASTER_TREE_TAG } from "@/lib/queries/master";

const createSchema = z.object({
  label: z.string().min(2).max(80),
  defaultAvailability: z.enum(["ada", "tidak_lengkap", "hilang"]),
  defaultCondition: z.enum(["baik", "rusak"]),
  sortOrder: z.number().int().min(0).default(50),
});

const patchSchema = z.object({
  id: z.number().int().positive(),
  label: z.string().min(2).max(80).optional(),
  defaultAvailability: z.enum(["ada", "tidak_lengkap", "hilang"]).optional(),
  defaultCondition: z.enum(["baik", "rusak"]).optional(),
  sortOrder: z.number().int().min(0).optional(),
  isActive: z.boolean().optional(),
});

export async function POST(request: NextRequest) {
  const auth = await requireApiSession("admin");
  if ("error" in auth) return auth.error;

  const body = await request.json();
  const parsed = createSchema.safeParse(body);
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
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Data pembaruan Temuan Standar tidak valid." }, { status: 400 });
  }

  const updates: Record<string, unknown> = {};
  if (parsed.data.label !== undefined) updates.label = parsed.data.label.trim();
  if (parsed.data.defaultAvailability !== undefined)
    updates.defaultAvailability = parsed.data.defaultAvailability;
  if (parsed.data.defaultCondition !== undefined)
    updates.defaultCondition = parsed.data.defaultCondition;
  if (parsed.data.sortOrder !== undefined) updates.sortOrder = parsed.data.sortOrder;
  if (parsed.data.isActive !== undefined) updates.isActive = parsed.data.isActive;

  const db = getDb();
  const [updated] = await db
    .update(issuePresets)
    .set(updates)
    .where(eq(issuePresets.id, parsed.data.id))
    .returning();
  if (!updated) return NextResponse.json({ error: "Temuan Standar tidak ditemukan." }, { status: 404 });
  revalidateTag(MASTER_TREE_TAG);
  return NextResponse.json({ item: updated });
}
