import { NextRequest, NextResponse } from "next/server";
import { and, asc, desc, eq, gte, inArray, lte, sql } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/db";
import {
  blocks,
  companies,
  engineBrands,
  estates,
  inspectionItems,
  inspectionPhotos,
  inspections,
  issuePresets,
  pumpOperatingLogs,
  pumps,
  pumpTypeParts,
  pumpTypes,
  regions,
} from "@/db/schema";
import { requireApiSession } from "@/lib/auth";
import { isPumpLocationAssigned } from "@/lib/pump-location";
import { getMonthBounds } from "@/lib/queries/operating-hours";

const updatePumpSchema = z.object({
  pumpCode: z.string().min(2).max(40).optional(),
  estateId: z.number().int().positive().nullable().optional(),
  blockId: z.number().int().positive().nullable().optional(),
  pumpTypeId: z.number().int().positive().optional(),
  engineBrandId: z.number().int().positive().optional(),
  isActive: z.boolean().optional(),
});

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const auth = await requireApiSession();
  if ("error" in auth) return auth.error;

  const { id } = await context.params;
  const pumpId = Number(id);
  if (!Number.isInteger(pumpId) || pumpId <= 0) {
    return NextResponse.json({ error: "ID pompa tidak valid." }, { status: 400 });
  }

  const db = getDb();
  const [pump] = await db
    .select({
      id: pumps.id,
      pumpCode: pumps.pumpCode,
      currentUnitStatus: pumps.currentUnitStatus,
      lastInspectedAt: pumps.lastInspectedAt,
      isActive: pumps.isActive,
      operationalNote: pumps.operationalNote,
      operationalCategory: pumps.operationalCategory,
      repairStatus: pumps.repairStatus,
      isPreOrder: pumps.isPreOrder,
      breakdownStartDate: pumps.breakdownStartDate,
      locationUpdatedAt: pumps.locationUpdatedAt,
      blockId: blocks.id,
      blockCode: blocks.code,
      estateId: estates.id,
      estateCode: estates.code,
      regionId: regions.id,
      regionCode: regions.code,
      regionName: regions.name,
      companyId: companies.id,
      companyName: companies.name,
      pumpTypeId: pumpTypes.id,
      pumpTypeCode: pumpTypes.code,
      pumpTypeName: pumpTypes.name,
      engineBrandId: engineBrands.id,
      engineBrandName: engineBrands.name,
    })
    .from(pumps)
    .leftJoin(blocks, eq(pumps.blockId, blocks.id))
    .leftJoin(estates, sql`COALESCE(${blocks.estateId}, ${pumps.estateId}) = ${estates.id}`)
    .leftJoin(regions, eq(estates.regionId, regions.id))
    .leftJoin(companies, eq(regions.companyId, companies.id))
    .innerJoin(pumpTypes, eq(pumps.pumpTypeId, pumpTypes.id))
    .innerJoin(engineBrands, eq(pumps.engineBrandId, engineBrands.id))
    .where(eq(pumps.id, pumpId))
    .limit(1);

  if (!pump) {
    return NextResponse.json({ error: "Pompa tidak ditemukan." }, { status: 404 });
  }

  const monthBounds = getMonthBounds();

  const [templateParts, historyRows, monthLogs] = await Promise.all([
    db
      .select()
      .from(pumpTypeParts)
      .where(eq(pumpTypeParts.pumpTypeId, pump.pumpTypeId))
      .orderBy(asc(pumpTypeParts.sortOrder)),
    db
      .select()
      .from(inspections)
      .where(eq(inspections.pumpId, pumpId))
      .orderBy(desc(inspections.inspectedAt), desc(inspections.id)),
    db
      .select({
        id: pumpOperatingLogs.id,
        logDate: pumpOperatingLogs.logDate,
        operatingHours: pumpOperatingLogs.operatingHours,
        dayStatus: pumpOperatingLogs.dayStatus,
        notes: pumpOperatingLogs.notes,
        recordedByName: pumpOperatingLogs.recordedByName,
      })
      .from(pumpOperatingLogs)
      .where(
        and(
          eq(pumpOperatingLogs.pumpId, pumpId),
          gte(pumpOperatingLogs.logDate, monthBounds.monthStart),
          lte(pumpOperatingLogs.logDate, monthBounds.monthEnd)
        )
      )
      .orderBy(desc(pumpOperatingLogs.logDate)),
  ]);

  const inspectionIds = historyRows.map((h) => h.id);
  const itemsByInspection = new Map<number, Array<Record<string, unknown>>>();
  const photosByInspection = new Map<number, Array<Record<string, unknown>>>();

  if (inspectionIds.length > 0) {
    const [allItems, allPhotos] = await Promise.all([
      db
        .select({
          id: inspectionItems.id,
          inspectionId: inspectionItems.inspectionId,
          partId: inspectionItems.partId,
          sectionCode: inspectionItems.sectionCode,
          sectionName: inspectionItems.sectionName,
          itemNo: inspectionItems.itemNo,
          partName: inspectionItems.partName,
          expectedQty: inspectionItems.expectedQty,
          availability: inspectionItems.availability,
          condition: inspectionItems.condition,
          issuePresetId: inspectionItems.issuePresetId,
          issueLabel: issuePresets.label,
          notes: inspectionItems.notes,
          sortOrder: inspectionItems.sortOrder,
        })
        .from(inspectionItems)
        .leftJoin(issuePresets, eq(inspectionItems.issuePresetId, issuePresets.id))
        .where(inArray(inspectionItems.inspectionId, inspectionIds))
        .orderBy(asc(inspectionItems.sortOrder)),
      db
        .select()
        .from(inspectionPhotos)
        .where(inArray(inspectionPhotos.inspectionId, inspectionIds))
        .orderBy(asc(inspectionPhotos.id)),
    ]);

    for (const item of allItems) {
      const list = itemsByInspection.get(item.inspectionId) ?? [];
      list.push(item);
      itemsByInspection.set(item.inspectionId, list);
    }

    for (const photo of allPhotos) {
      const list = photosByInspection.get(photo.inspectionId) ?? [];
      list.push(photo);
      photosByInspection.set(photo.inspectionId, list);
    }
  }

  const monthlyHoursTotal =
    Math.round(
      monthLogs.reduce(
        (acc, row) =>
          row.dayStatus === "operasi" ? acc + Number(row.operatingHours ?? 0) : acc,
        0
      ) * 100
    ) / 100;

  return NextResponse.json({
    pump: {
      ...pump,
      isLocationAssigned: isPumpLocationAssigned({
        blockId: pump.blockId,
        blockCode: pump.blockCode,
      }),
    },
    templateParts: templateParts.filter((p) => p.isActive),
    operatingLogs: monthLogs.map((row) => ({
      id: row.id,
      logDate: row.logDate,
      operatingHours: Number(row.operatingHours ?? 0),
      dayStatus: row.dayStatus,
      notes: row.notes,
      recordedByName: row.recordedByName,
    })),
    monthlyHoursTotal,
    monthLabel: monthBounds.monthLabel,
    inspections: historyRows.map((h) => ({
      ...h,
      items: itemsByInspection.get(h.id) ?? [],
      photos: photosByInspection.get(h.id) ?? [],
    })),
  });
}

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const auth = await requireApiSession("admin");
  if ("error" in auth) return auth.error;

  const { id } = await context.params;
  const pumpId = Number(id);
  if (!Number.isInteger(pumpId) || pumpId <= 0) {
    return NextResponse.json({ error: "ID pompa tidak valid." }, { status: 400 });
  }

  const body = await request.json();
  const parsed = updatePumpSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Data pembaruan pompa tidak valid." }, { status: 400 });
  }

  const updates: Record<string, unknown> = {};
  if (parsed.data.pumpCode !== undefined)
    updates.pumpCode = parsed.data.pumpCode.trim().toUpperCase();
  if (parsed.data.estateId !== undefined) updates.estateId = parsed.data.estateId;
  if (parsed.data.blockId !== undefined) updates.blockId = parsed.data.blockId;
  if (parsed.data.pumpTypeId !== undefined) updates.pumpTypeId = parsed.data.pumpTypeId;
  if (parsed.data.engineBrandId !== undefined) updates.engineBrandId = parsed.data.engineBrandId;
  if (parsed.data.isActive !== undefined) updates.isActive = parsed.data.isActive;

  const db = getDb();
  try {
    const [updated] = await db
      .update(pumps)
      .set(updates)
      .where(eq(pumps.id, pumpId))
      .returning();
    if (!updated) return NextResponse.json({ error: "Pompa tidak ditemukan." }, { status: 404 });
    return NextResponse.json({ pump: updated });
  } catch {
    return NextResponse.json({ error: "Kode pompa bentrok dengan data lain." }, { status: 409 });
  }
}
