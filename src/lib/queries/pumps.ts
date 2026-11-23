import { and, asc, desc, eq, ilike, inArray, or, sql } from "drizzle-orm";
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
  pumps,
  pumpTypes,
  regions,
} from "@/db/schema";

export interface PumpFilterParams {
  companyId?: number;
  regionId?: number;
  estateId?: number;
  blockId?: number;
  pumpTypeId?: number;
  status?: string;
  search?: string;
  includeInactive?: boolean;
}

export interface EnrichedPumpRow {
  id: number;
  pumpCode: string;
  currentUnitStatus: string;
  lastInspectedAt: Date | null;
  isActive: boolean;
  blockId: number;
  blockCode: string;
  blockName: string;
  estateId: number;
  estateCode: string;
  estateName: string;
  regionId: number;
  regionCode: string;
  regionName: string;
  companyId: number;
  companyCode: string;
  companyName: string;
  pumpTypeId: number;
  pumpTypeCode: string;
  pumpTypeName: string;
  engineBrandId: number;
  engineBrandName: string;
  latestInspectionId: number | null;
  latestInspectedDate: string | null;
  latestInspectorName: string | null;
  issueCount: number;
  photoCount: number;
}

export async function queryFilteredPumps(filters: PumpFilterParams): Promise<EnrichedPumpRow[]> {
  const db = getDb();

  const conditions = [];
  if (!filters.includeInactive) {
    conditions.push(eq(pumps.isActive, true));
  }
  if (filters.companyId) conditions.push(eq(companies.id, filters.companyId));
  if (filters.regionId) conditions.push(eq(regions.id, filters.regionId));
  if (filters.estateId) conditions.push(eq(estates.id, filters.estateId));
  if (filters.blockId) conditions.push(eq(blocks.id, filters.blockId));
  if (filters.pumpTypeId) conditions.push(eq(pumpTypes.id, filters.pumpTypeId));
  if (filters.status && ["aktif", "perlu_perbaikan", "rusak_total"].includes(filters.status)) {
    conditions.push(eq(pumps.currentUnitStatus, filters.status));
  }
  if (filters.search?.trim()) {
    const q = `%${filters.search.trim()}%`;
    conditions.push(or(ilike(pumps.pumpCode, q), ilike(blocks.code, q), ilike(estates.code, q)));
  }

  const rows = await db
    .select({
      id: pumps.id,
      pumpCode: pumps.pumpCode,
      currentUnitStatus: pumps.currentUnitStatus,
      lastInspectedAt: pumps.lastInspectedAt,
      isActive: pumps.isActive,
      blockId: blocks.id,
      blockCode: blocks.code,
      blockName: blocks.name,
      estateId: estates.id,
      estateCode: estates.code,
      estateName: estates.name,
      regionId: regions.id,
      regionCode: regions.code,
      regionName: regions.name,
      companyId: companies.id,
      companyCode: companies.code,
      companyName: companies.name,
      pumpTypeId: pumpTypes.id,
      pumpTypeCode: pumpTypes.code,
      pumpTypeName: pumpTypes.name,
      engineBrandId: engineBrands.id,
      engineBrandName: engineBrands.name,
    })
    .from(pumps)
    .innerJoin(blocks, eq(pumps.blockId, blocks.id))
    .innerJoin(estates, eq(blocks.estateId, estates.id))
    .innerJoin(regions, eq(estates.regionId, regions.id))
    .innerJoin(companies, eq(regions.companyId, companies.id))
    .innerJoin(pumpTypes, eq(pumps.pumpTypeId, pumpTypes.id))
    .innerJoin(engineBrands, eq(pumps.engineBrandId, engineBrands.id))
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(asc(estates.code), asc(pumps.pumpCode));

  if (rows.length === 0) return [];

  const pumpIds = rows.map((r) => r.id);
  const allInspections = await db
    .select({
      id: inspections.id,
      pumpId: inspections.pumpId,
      inspectedAt: inspections.inspectedAt,
      inspectorName: inspections.inspectorName,
    })
    .from(inspections)
    .where(inArray(inspections.pumpId, pumpIds))
    .orderBy(desc(inspections.inspectedAt), desc(inspections.id));

  const latestByPump = new Map<
    number,
    { id: number; inspectedAt: string; inspectorName: string }
  >();
  for (const ins of allInspections) {
    if (!latestByPump.has(ins.pumpId)) {
      latestByPump.set(ins.pumpId, {
        id: ins.id,
        inspectedAt: ins.inspectedAt,
        inspectorName: ins.inspectorName,
      });
    }
  }

  const latestIds = Array.from(latestByPump.values()).map((v) => v.id);
  const issueCountMap = new Map<number, number>();
  const photoCountMap = new Map<number, number>();

  if (latestIds.length > 0) {
    const issueCounts = await db
      .select({
        inspectionId: inspectionItems.inspectionId,
        count: sql<number>`count(*)::int`,
      })
      .from(inspectionItems)
      .where(
        and(
          inArray(inspectionItems.inspectionId, latestIds),
          sql`(${inspectionItems.availability} != 'ada' OR ${inspectionItems.condition} = 'rusak')`
        )
      )
      .groupBy(inspectionItems.inspectionId);

    for (const ic of issueCounts) {
      issueCountMap.set(ic.inspectionId, ic.count);
    }

    const photoCounts = await db
      .select({
        inspectionId: inspectionPhotos.inspectionId,
        count: sql<number>`count(*)::int`,
      })
      .from(inspectionPhotos)
      .where(inArray(inspectionPhotos.inspectionId, latestIds))
      .groupBy(inspectionPhotos.inspectionId);

    for (const pc of photoCounts) {
      photoCountMap.set(pc.inspectionId, pc.count);
    }
  }

  return rows.map((row) => {
    const latest = latestByPump.get(row.id);
    return {
      ...row,
      latestInspectionId: latest?.id ?? null,
      latestInspectedDate: latest?.inspectedAt ?? null,
      latestInspectorName: latest?.inspectorName ?? null,
      issueCount: latest ? issueCountMap.get(latest.id) ?? 0 : 0,
      photoCount: latest ? photoCountMap.get(latest.id) ?? 0 : 0,
    };
  });
}

export async function queryLatestIssuesForPumps(
  enrichedPumps: EnrichedPumpRow[],
  dateFrom?: string,
  dateTo?: string
) {
  const db = getDb();
  const latestPairs = enrichedPumps
    .filter((p) => p.latestInspectionId !== null)
    .filter((p) => {
      if (!dateFrom && !dateTo) return true;
      const d = p.latestInspectedDate ?? "";
      if (dateFrom && d < dateFrom) return false;
      if (dateTo && d > dateTo) return false;
      return true;
    });

  if (latestPairs.length === 0) return [];

  const pumpByInspection = new Map<number, EnrichedPumpRow>();
  for (const p of latestPairs) {
    if (p.latestInspectionId) pumpByInspection.set(p.latestInspectionId, p);
  }

  const inspectionIds = Array.from(pumpByInspection.keys());
  const badItems = await db
    .select({
      id: inspectionItems.id,
      inspectionId: inspectionItems.inspectionId,
      sectionName: inspectionItems.sectionName,
      partName: inspectionItems.partName,
      expectedQty: inspectionItems.expectedQty,
      availability: inspectionItems.availability,
      condition: inspectionItems.condition,
      notes: inspectionItems.notes,
      issueLabel: issuePresets.label,
    })
    .from(inspectionItems)
    .leftJoin(issuePresets, eq(inspectionItems.issuePresetId, issuePresets.id))
    .where(
      and(
        inArray(inspectionItems.inspectionId, inspectionIds),
        sql`(${inspectionItems.availability} != 'ada' OR ${inspectionItems.condition} = 'rusak')`
      )
    )
    .orderBy(asc(inspectionItems.inspectionId), asc(inspectionItems.sortOrder));

  return badItems.map((item) => {
    const p = pumpByInspection.get(item.inspectionId)!;
    return {
      id: item.id,
      pumpId: p.id,
      pumpCode: p.pumpCode,
      regionName: p.regionName,
      estateCode: p.estateCode,
      blockCode: p.blockCode,
      pumpTypeName: p.pumpTypeName,
      sectionName: item.sectionName,
      partName: item.partName,
      expectedQty: item.expectedQty,
      availability: item.availability,
      condition: item.condition,
      issueLabel: item.issueLabel ?? (item.availability === "hilang" ? "Hilang" : "Rusak"),
      notes: item.notes ?? "",
      inspectedAt: p.latestInspectedDate ?? "",
    };
  });
}
