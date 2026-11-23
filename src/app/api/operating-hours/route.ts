import { NextRequest, NextResponse } from "next/server";
import { and, eq, gte, inArray, lte } from "drizzle-orm";
import { z } from "zod";
import { getDb, getTxDb } from "@/db";
import { blocks, pumpOperatingLogs, pumps } from "@/db/schema";
import { requireApiSession } from "@/lib/auth";
import { isPumpLocationAssigned } from "@/lib/pump-location";
import { getMonthBounds } from "@/lib/queries/operating-hours";
import { queryFilteredPumps } from "@/lib/queries/pumps";

const upsertOperatingHoursSchema = z.object({
  logDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Format tanggal harus YYYY-MM-DD."),
  entries: z
    .array(
      z.object({
        pumpId: z.number().int().positive(),
        operatingHours: z.number().min(0, "Jam minimal 0.").max(24, "Jam maksimal 24 jam/hari.").nullable(),
        notes: z.string().max(240).nullable().optional(),
      })
    )
    .min(1, "Minimal 1 unit pompa untuk disimpan."),
});

export async function GET(request: NextRequest) {
  const auth = await requireApiSession();
  if ("error" in auth) return auth.error;

  const sp = request.nextUrl.searchParams;
  const dateParam = sp.get("date") || new Date().toISOString().slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateParam)) {
    return NextResponse.json({ error: "Format tanggal tidak valid." }, { status: 400 });
  }

  const month = dateParam.slice(0, 7);
  const bounds = getMonthBounds(month);

  const matchedPumps = await queryFilteredPumps({
    companyId: Number(sp.get("companyId")) || undefined,
    regionId: Number(sp.get("regionId")) || undefined,
    estateId: Number(sp.get("estateId")) || undefined,
    blockId: Number(sp.get("blockId")) || undefined,
    pumpTypeId: Number(sp.get("pumpTypeId")) || undefined,
    status: sp.get("status") ?? undefined,
    search: sp.get("search") ?? undefined,
  });

  const locationFilter = sp.get("locationFilter") || "all";
  const filteredPumps = matchedPumps.filter((p) => {
    if (locationFilter === "assigned") return p.isLocationAssigned;
    if (locationFilter === "unassigned") return !p.isLocationAssigned;
    return true;
  });

  const db = getDb();
  const pumpIds = filteredPumps.map((p) => p.id);
  const dayHoursMap = new Map<number, { operatingHours: number; notes: string | null }>();
  const monthTotalMap = new Map<number, number>();

  if (pumpIds.length > 0) {
    const logs = await db
      .select({
        pumpId: pumpOperatingLogs.pumpId,
        logDate: pumpOperatingLogs.logDate,
        operatingHours: pumpOperatingLogs.operatingHours,
        dayStatus: pumpOperatingLogs.dayStatus,
        notes: pumpOperatingLogs.notes,
      })
      .from(pumpOperatingLogs)
      .where(
        and(
          inArray(pumpOperatingLogs.pumpId, pumpIds),
          gte(pumpOperatingLogs.logDate, bounds.monthStart),
          lte(pumpOperatingLogs.logDate, bounds.monthEnd)
        )
      );

    for (const log of logs) {
      const hrs = Number(log.operatingHours ?? 0);
      if (log.logDate === dateParam && log.dayStatus === "operasi") {
        dayHoursMap.set(log.pumpId, { operatingHours: hrs, notes: log.notes });
      }
      if (log.dayStatus === "operasi" && hrs > 0) {
        monthTotalMap.set(log.pumpId, (monthTotalMap.get(log.pumpId) ?? 0) + hrs);
      }
    }
  }

  return NextResponse.json({
    date: dateParam,
    monthLabel: bounds.monthLabel,
    items: filteredPumps.map((p) => {
      const dayEntry = dayHoursMap.get(p.id);
      return {
        ...p,
        dayOperatingHours: dayEntry ? dayEntry.operatingHours : null,
        dayLogNotes: dayEntry?.notes ?? null,
        monthTotalHours: Math.round((monthTotalMap.get(p.id) ?? 0) * 100) / 100,
      };
    }),
  });
}

export async function POST(request: NextRequest) {
  const auth = await requireApiSession();
  if ("error" in auth) return auth.error;

  const body = await request.json();
  const parsed = upsertOperatingHoursSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Data jam operasional tidak valid." },
      { status: 400 }
    );
  }

  const { logDate, entries } = parsed.data;
  const pumpIds = Array.from(new Set(entries.map((e) => e.pumpId)));
  const db = getTxDb();

  const pumpRows = await db
    .select({
      id: pumps.id,
      pumpCode: pumps.pumpCode,
      blockId: pumps.blockId,
      blockCode: blocks.code,
    })
    .from(pumps)
    .leftJoin(blocks, eq(pumps.blockId, blocks.id))
    .where(inArray(pumps.id, pumpIds));

  const pumpMap = new Map(pumpRows.map((p) => [p.id, p]));

  for (const entry of entries) {
    const pump = pumpMap.get(entry.pumpId);
    if (!pump) {
      return NextResponse.json(
        { error: `Pompa ID ${entry.pumpId} tidak ditemukan.` },
        { status: 404 }
      );
    }
    if (
      entry.operatingHours !== null &&
      entry.operatingHours > 0 &&
      !isPumpLocationAssigned({ blockId: pump.blockId, blockCode: pump.blockCode })
    ) {
      return NextResponse.json(
        {
          error: `Pompa ${pump.pumpCode} belum di-assign ke blok lokasi lapangan sehingga jam kerja belum dapat diinput.`,
        },
        { status: 400 }
      );
    }
  }

  let savedCount = 0;
  let clearedCount = 0;

  await db.transaction(async (tx) => {
    for (const entry of entries) {
      if (entry.operatingHours === null || entry.operatingHours <= 0) {
        await tx
          .delete(pumpOperatingLogs)
          .where(
            and(
              eq(pumpOperatingLogs.pumpId, entry.pumpId),
              eq(pumpOperatingLogs.logDate, logDate)
            )
          );
        clearedCount += 1;
      } else {
        const hrsStr = (Math.round(entry.operatingHours * 100) / 100).toFixed(2);
        await tx
          .insert(pumpOperatingLogs)
          .values({
            pumpId: entry.pumpId,
            logDate,
            operatingHours: hrsStr,
            dayStatus: "operasi",
            notes: entry.notes?.trim() || null,
            recordedById: auth.user.userId,
            recordedByName: auth.user.name,
            updatedAt: new Date(),
          })
          .onConflictDoUpdate({
            target: [pumpOperatingLogs.pumpId, pumpOperatingLogs.logDate],
            set: {
              operatingHours: hrsStr,
              dayStatus: "operasi",
              notes: entry.notes?.trim() || null,
              recordedById: auth.user.userId,
              recordedByName: auth.user.name,
              updatedAt: new Date(),
            },
          });
        savedCount += 1;
      }
    }
  });

  return NextResponse.json({
    ok: true,
    logDate,
    savedCount,
    clearedCount,
  });
}
