import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/db";
import { pumps } from "@/db/schema";
import { requireApiSession } from "@/lib/auth";
import { queryFilteredPumps } from "@/lib/queries/pumps";

const createPumpSchema = z.object({
  pumpCode: z.string().min(2, "Kode pompa wajib diisi.").max(40),
  blockId: z.number().int().positive(),
  pumpTypeId: z.number().int().positive(),
  engineBrandId: z.number().int().positive(),
  currentUnitStatus: z.enum(["aktif", "perlu_perbaikan", "rusak_total"]).default("aktif"),
});

export async function GET(request: NextRequest) {
  const auth = await requireApiSession();
  if ("error" in auth) return auth.error;

  const sp = request.nextUrl.searchParams;
  const rows = await queryFilteredPumps({
    companyId: Number(sp.get("companyId")) || undefined,
    regionId: Number(sp.get("regionId")) || undefined,
    estateId: Number(sp.get("estateId")) || undefined,
    blockId: Number(sp.get("blockId")) || undefined,
    pumpTypeId: Number(sp.get("pumpTypeId")) || undefined,
    status: sp.get("status") ?? undefined,
    search: sp.get("search") ?? undefined,
    includeInactive: sp.get("includeInactive") === "true" && auth.user.role === "admin",
  });

  return NextResponse.json({ pumps: rows });
}

export async function POST(request: NextRequest) {
  const auth = await requireApiSession("admin");
  if ("error" in auth) return auth.error;

  const body = await request.json();
  const parsed = createPumpSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Data pompa tidak valid." },
      { status: 400 }
    );
  }

  const db = getDb();
  const pumpCode = parsed.data.pumpCode.trim().toUpperCase();
  const [existing] = await db
    .select({ id: pumps.id })
    .from(pumps)
    .where(eq(pumps.pumpCode, pumpCode))
    .limit(1);

  if (existing) {
    return NextResponse.json(
      { error: `Kode pompa "${pumpCode}" sudah terdaftar.` },
      { status: 409 }
    );
  }

  const [created] = await db
    .insert(pumps)
    .values({
      pumpCode,
      blockId: parsed.data.blockId,
      pumpTypeId: parsed.data.pumpTypeId,
      engineBrandId: parsed.data.engineBrandId,
      currentUnitStatus: parsed.data.currentUnitStatus,
    })
    .returning();

  return NextResponse.json({ pump: created }, { status: 201 });
}
