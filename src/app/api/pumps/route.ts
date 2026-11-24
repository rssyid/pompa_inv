import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/db";
import { blocks, pumps } from "@/db/schema";
import { requireApiSession } from "@/lib/auth";
import { getMonthBoundsFromDate, getTodayIsoDate } from "@/lib/pump-insights";
import { queryFilteredPumps } from "@/lib/queries/pumps";

const createPumpSchema = z.object({
  pumpCode: z.string().min(2, "Kode pompa wajib diisi.").max(40),
  estateId: z.number().int().positive().nullable().optional(),
  blockId: z.number().int().positive().nullable().optional(),
  pumpTypeId: z.number().int().positive(),
  engineBrandId: z.number().int().positive(),
  currentUnitStatus: z.enum(["aktif", "perlu_perbaikan", "rusak_total"]).default("aktif"),
  operationalNote: z.string().max(240).nullable().optional(),
  operationalCategory: z
    .enum(["none", "tbm", "pasang_surut", "wsc_selesai", "discharge", "rusak_po"])
    .default("none"),
  repairStatus: z.string().max(120).nullable().optional(),
  isPreOrder: z.boolean().default(false),
});

export async function GET(request: NextRequest) {
  const auth = await requireApiSession();
  if ("error" in auth) return auth.error;

  const sp = request.nextUrl.searchParams;
  const includeInsights = sp.get("includeInsights") === "true";
  const referenceDate = includeInsights ? getTodayIsoDate() : undefined;
  const monthBounds = referenceDate ? getMonthBoundsFromDate(referenceDate) : undefined;

  const rows = await queryFilteredPumps({
    companyId: Number(sp.get("companyId")) || undefined,
    regionId: Number(sp.get("regionId")) || undefined,
    estateId: Number(sp.get("estateId")) || undefined,
    blockId: Number(sp.get("blockId")) || undefined,
    pumpTypeId: Number(sp.get("pumpTypeId")) || undefined,
    status: sp.get("status") ?? undefined,
    search: sp.get("search") ?? undefined,
    includeInactive: sp.get("includeInactive") === "true" && auth.user.role === "admin",
    includeInsights,
    insightsMonthStart: monthBounds?.monthStart,
    insightsMonthEnd: monthBounds?.monthEnd,
  });

  if (includeInsights && monthBounds && referenceDate) {
    return NextResponse.json({
      pumps: rows,
      monthLabel: monthBounds.monthLabel,
      referenceDate,
    });
  }

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

  let resolvedEstateId: number | null = parsed.data.estateId ?? null;
  const resolvedBlockId: number | null = parsed.data.blockId ?? null;
  if (resolvedBlockId) {
    const [blk] = await db
      .select({ estateId: blocks.estateId })
      .from(blocks)
      .where(eq(blocks.id, resolvedBlockId))
      .limit(1);
    if (!blk) {
      return NextResponse.json({ error: "Blok lokasi tidak ditemukan." }, { status: 404 });
    }
    resolvedEstateId = blk.estateId;
  }

  const [created] = await db
    .insert(pumps)
    .values({
      pumpCode,
      estateId: resolvedEstateId,
      blockId: resolvedBlockId,
      pumpTypeId: parsed.data.pumpTypeId,
      engineBrandId: parsed.data.engineBrandId,
      currentUnitStatus: parsed.data.currentUnitStatus,
      operationalNote: parsed.data.operationalNote?.trim() || null,
      operationalCategory: parsed.data.operationalCategory,
      repairStatus: parsed.data.repairStatus?.trim() || null,
      isPreOrder: parsed.data.isPreOrder,
      breakdownStartDate:
        parsed.data.currentUnitStatus === "aktif"
          ? null
          : new Date().toISOString().slice(0, 10),
      locationUpdatedAt: resolvedBlockId || resolvedEstateId ? new Date() : null,
    })
    .returning();

  return NextResponse.json({ pump: created }, { status: 201 });
}
