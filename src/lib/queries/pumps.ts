import { and, asc, eq, inArray, sql } from "drizzle-orm";
import { getDb } from "@/db";
import { inspectionItems, issuePresets } from "@/db/schema";

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

  const whereClauses = [];
  if (!filters.includeInactive) {
    whereClauses.push(sql`p.is_active = true`);
  }
  if (filters.companyId) whereClauses.push(sql`c.id = ${filters.companyId}`);
  if (filters.regionId) whereClauses.push(sql`r.id = ${filters.regionId}`);
  if (filters.estateId) whereClauses.push(sql`e.id = ${filters.estateId}`);
  if (filters.blockId) whereClauses.push(sql`b.id = ${filters.blockId}`);
  if (filters.pumpTypeId) whereClauses.push(sql`pt.id = ${filters.pumpTypeId}`);
  if (filters.status && ["aktif", "perlu_perbaikan", "rusak_total"].includes(filters.status)) {
    whereClauses.push(sql`p.current_unit_status = ${filters.status}`);
  }
  if (filters.search?.trim()) {
    const q = `%${filters.search.trim()}%`;
    whereClauses.push(sql`(p.pump_code ILIKE ${q} OR b.code ILIKE ${q} OR e.code ILIKE ${q})`);
  }

  const whereSql =
    whereClauses.length > 0
      ? sql`WHERE ${sql.join(whereClauses, sql` AND `)}`
      : sql``;

  const result = await db.execute(sql`
    WITH filtered_pumps AS (
      SELECT
        p.id,
        p.pump_code AS "pumpCode",
        p.current_unit_status AS "currentUnitStatus",
        p.last_inspected_at AS "lastInspectedAt",
        p.is_active AS "isActive",
        b.id AS "blockId",
        b.code AS "blockCode",
        b.name AS "blockName",
        e.id AS "estateId",
        e.code AS "estateCode",
        e.name AS "estateName",
        r.id AS "regionId",
        r.code AS "regionCode",
        r.name AS "regionName",
        c.id AS "companyId",
        c.code AS "companyCode",
        c.name AS "companyName",
        pt.id AS "pumpTypeId",
        pt.code AS "pumpTypeCode",
        pt.name AS "pumpTypeName",
        eb.id AS "engineBrandId",
        eb.name AS "engineBrandName"
      FROM pumps p
      INNER JOIN blocks b ON p.block_id = b.id
      INNER JOIN estates e ON b.estate_id = e.id
      INNER JOIN regions r ON e.region_id = r.id
      INNER JOIN companies c ON r.company_id = c.id
      INNER JOIN pump_types pt ON p.pump_type_id = pt.id
      INNER JOIN engine_brands eb ON p.engine_brand_id = eb.id
      ${whereSql}
    ),
    latest_inspections AS (
      SELECT DISTINCT ON (i.pump_id)
        i.id,
        i.pump_id,
        i.inspected_at::text AS "inspectedAt",
        i.inspector_name AS "inspectorName"
      FROM inspections i
      INNER JOIN filtered_pumps fp ON fp.id = i.pump_id
      ORDER BY i.pump_id, i.inspected_at DESC, i.id DESC
    ),
    issue_counts AS (
      SELECT
        ii.inspection_id,
        COUNT(*)::int AS "issueCount"
      FROM inspection_items ii
      INNER JOIN latest_inspections li ON li.id = ii.inspection_id
      WHERE ii.availability <> 'ada' OR ii.condition = 'rusak'
      GROUP BY ii.inspection_id
    ),
    photo_counts AS (
      SELECT
        ip.inspection_id,
        COUNT(*)::int AS "photoCount"
      FROM inspection_photos ip
      INNER JOIN latest_inspections li ON li.id = ip.inspection_id
      GROUP BY ip.inspection_id
    )
    SELECT
      fp.*,
      li.id AS "latestInspectionId",
      li."inspectedAt" AS "latestInspectedDate",
      li."inspectorName" AS "latestInspectorName",
      COALESCE(ic."issueCount", 0)::int AS "issueCount",
      COALESCE(pc."photoCount", 0)::int AS "photoCount"
    FROM filtered_pumps fp
    LEFT JOIN latest_inspections li ON li.pump_id = fp.id
    LEFT JOIN issue_counts ic ON ic.inspection_id = li.id
    LEFT JOIN photo_counts pc ON pc.inspection_id = li.id
    ORDER BY fp."estateCode" ASC, fp."pumpCode" ASC
  `);

  return (result.rows as unknown as EnrichedPumpRow[]).map((row) => ({
    ...row,
    issueCount: Number(row.issueCount ?? 0),
    photoCount: Number(row.photoCount ?? 0),
  }));
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
