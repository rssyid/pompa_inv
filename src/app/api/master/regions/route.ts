import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/db";
import { regions } from "@/db/schema";
import { requireApiSession } from "@/lib/auth";

const createSchema = z.object({
  companyId: z.number().int().positive(),
  code: z.string().min(2).max(20),
  name: z.string().min(2).max(120),
});

const patchSchema = z.object({
  id: z.number().int().positive(),
  companyId: z.number().int().positive().optional(),
  code: z.string().min(2).max(20).optional(),
  name: z.string().min(2).max(120).optional(),
  isActive: z.boolean().optional(),
});

export async function POST(request: NextRequest) {
  const auth = await requireApiSession("admin");
  if ("error" in auth) return auth.error;

  const body = await request.json();
  const parsed = createSchema.safeParse(body);
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
    return NextResponse.json({ item: created }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Kode Region sudah ada pada PT ini." }, { status: 409 });
  }
}

export async function PATCH(request: NextRequest) {
  const auth = await requireApiSession("admin");
  if ("error" in auth) return auth.error;

  const body = await request.json();
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Data pembaruan Region tidak valid." }, { status: 400 });
  }

  const db = getDb();
  const updates: Record<string, unknown> = {};
  if (parsed.data.companyId !== undefined) updates.companyId = parsed.data.companyId;
  if (parsed.data.code !== undefined) updates.code = parsed.data.code.trim().toUpperCase();
  if (parsed.data.name !== undefined) updates.name = parsed.data.name.trim();
  if (parsed.data.isActive !== undefined) updates.isActive = parsed.data.isActive;

  try {
    const [updated] = await db
      .update(regions)
      .set(updates)
      .where(eq(regions.id, parsed.data.id))
      .returning();
    if (!updated) return NextResponse.json({ error: "Region tidak ditemukan." }, { status: 404 });
    return NextResponse.json({ item: updated });
  } catch {
    return NextResponse.json({ error: "Kode Region bentrok pada PT yang dipilih." }, { status: 409 });
  }
}
