import { compareEstateOrder } from "./estate-order";

export interface PumpTypeColumn {
  id: number;
  code: string;
  name: string;
}

export interface ConditionCounts {
  total: number;
  aktif: number;
  perluPerbaikan: number;
  rusakTotal: number;
  issueCount: number;
}

export interface ConditionCountsWithTypes extends ConditionCounts {
  byPumpType: Record<number, ConditionCounts>;
}

export interface EstateBreakdownRow extends ConditionCountsWithTypes {
  estateId: number;
  estateCode: string;
  regionId: number;
  regionCode: string;
  regionName: string;
  sortOrder: number;
}

export interface RegionBreakdownGroup {
  regionId: number;
  regionCode: string;
  regionName: string;
  estates: EstateBreakdownRow[];
  subtotal: ConditionCountsWithTypes;
}

export interface SummaryBreakdownPayload {
  pumpTypeColumns: PumpTypeColumn[];
  byEstate: EstateBreakdownRow[];
  byRegion: RegionBreakdownGroup[];
  grandTotal: ConditionCountsWithTypes;
}

export interface BreakdownPumpInput {
  estateId: number | null;
  estateCode: string | null;
  estateSortOrder?: number | null;
  regionId: number | null;
  regionCode: string | null;
  regionName: string | null;
  pumpTypeId: number;
  pumpTypeCode: string;
  pumpTypeName: string;
  currentUnitStatus: string;
  issueCount: number;
}

const PUMP_TYPE_ORDER: Record<string, number> = {
  axial_single: 0,
  axial_double: 1,
  axial_triple: 2,
  ebara: 3,
};

/** Sort pump types in operational sequence (Axial Single -> Double -> Triple -> Ebara -> alphabetical). */
export function comparePumpTypeOrder(a: PumpTypeColumn, b: PumpTypeColumn): number {
  const rankA = PUMP_TYPE_ORDER[a.code.toLowerCase()] ?? 100;
  const rankB = PUMP_TYPE_ORDER[b.code.toLowerCase()] ?? 100;
  if (rankA !== rankB) return rankA - rankB;
  return a.name.localeCompare(b.name);
}

/** Return rounded readiness percentage (aktif / total * 100), or 0 when fleet is empty. */
export function formatReadinessPercent(aktif: number, total: number): number {
  if (total <= 0) return 0;
  return Math.round((aktif / total) * 100);
}

function emptyCounts(): ConditionCounts {
  return {
    total: 0,
    aktif: 0,
    perluPerbaikan: 0,
    rusakTotal: 0,
    issueCount: 0,
  };
}

function emptyTypeMap(columns: PumpTypeColumn[]): Record<number, ConditionCounts> {
  const map: Record<number, ConditionCounts> = {};
  for (const col of columns) {
    map[col.id] = emptyCounts();
  }
  return map;
}

function addPumpCounts(target: ConditionCounts, status: string, issueCount: number): void {
  target.total += 1;
  if (status === "aktif") target.aktif += 1;
  else if (status === "perlu_perbaikan") target.perluPerbaikan += 1;
  else target.rusakTotal += 1;
  target.issueCount += issueCount;
}

function mergeCounts(target: ConditionCounts, source: ConditionCounts): void {
  target.total += source.total;
  target.aktif += source.aktif;
  target.perluPerbaikan += source.perluPerbaikan;
  target.rusakTotal += source.rusakTotal;
  target.issueCount += source.issueCount;
}

/** Build Estate, Region subtotal, Grand Total (All), and Pump Type matrix breakdowns. */
export function buildSummaryBreakdowns(
  pumps: BreakdownPumpInput[],
  masterPumpTypes: PumpTypeColumn[] = []
): SummaryBreakdownPayload {
  const colMap = new Map<number, PumpTypeColumn>();
  for (const pt of masterPumpTypes) {
    colMap.set(pt.id, { id: pt.id, code: pt.code, name: pt.name });
  }
  for (const p of pumps) {
    if (!colMap.has(p.pumpTypeId)) {
      colMap.set(p.pumpTypeId, {
        id: p.pumpTypeId,
        code: p.pumpTypeCode,
        name: p.pumpTypeName,
      });
    }
  }
  const pumpTypeColumns = Array.from(colMap.values()).sort(comparePumpTypeOrder);

  const estateMap = new Map<number, EstateBreakdownRow>();
  for (const p of pumps) {
    const estateId = p.estateId ?? 0;
    let row = estateMap.get(estateId);
    if (!row) {
      row = {
        estateId,
        estateCode: p.estateCode ?? "Belum Assign",
        regionId: p.regionId ?? 0,
        regionCode: p.regionCode ?? "-",
        regionName: p.regionName ?? (p.estateId ? "-" : "Belum Assign Lokasi"),
        sortOrder: p.estateSortOrder ?? 0,
        ...emptyCounts(),
        byPumpType: emptyTypeMap(pumpTypeColumns),
      };
      estateMap.set(estateId, row);
    }

    addPumpCounts(row, p.currentUnitStatus, p.issueCount);
    if (!row.byPumpType[p.pumpTypeId]) {
      row.byPumpType[p.pumpTypeId] = emptyCounts();
    }
    addPumpCounts(row.byPumpType[p.pumpTypeId], p.currentUnitStatus, p.issueCount);
  }

  const byEstate = Array.from(estateMap.values()).sort((a, b) =>
    compareEstateOrder(
      { sortOrder: a.sortOrder, code: a.estateId ? a.estateCode : null },
      { sortOrder: b.sortOrder, code: b.estateId ? b.estateCode : null }
    )
  );

  const regionMap = new Map<number, RegionBreakdownGroup>();
  for (const estate of byEstate) {
    let group = regionMap.get(estate.regionId);
    if (!group) {
      group = {
        regionId: estate.regionId,
        regionCode: estate.regionCode,
        regionName: estate.regionName,
        estates: [],
        subtotal: {
          ...emptyCounts(),
          byPumpType: emptyTypeMap(pumpTypeColumns),
        },
      };
      regionMap.set(estate.regionId, group);
    }
    group.estates.push(estate);
    mergeCounts(group.subtotal, estate);
    for (const col of pumpTypeColumns) {
      const cell = estate.byPumpType[col.id];
      if (cell) {
        mergeCounts(group.subtotal.byPumpType[col.id], cell);
      }
    }
  }

  const byRegion = Array.from(regionMap.values()).sort((a, b) => {
    if ((a.regionId === 0) !== (b.regionId === 0)) {
      return a.regionId === 0 ? 1 : -1;
    }
    const firstA = a.estates[0];
    const firstB = b.estates[0];
    if (firstA && firstB) {
      const estDiff = compareEstateOrder(
        { sortOrder: firstA.sortOrder, code: firstA.estateId ? firstA.estateCode : null },
        { sortOrder: firstB.sortOrder, code: firstB.estateId ? firstB.estateCode : null }
      );
      if (estDiff !== 0) return estDiff;
    }
    return a.regionName.localeCompare(b.regionName);
  });

  const grandTotal: ConditionCountsWithTypes = {
    ...emptyCounts(),
    byPumpType: emptyTypeMap(pumpTypeColumns),
  };

  for (const region of byRegion) {
    mergeCounts(grandTotal, region.subtotal);
    for (const col of pumpTypeColumns) {
      const cell = region.subtotal.byPumpType[col.id];
      if (cell) {
        mergeCounts(grandTotal.byPumpType[col.id], cell);
      }
    }
  }

  return {
    pumpTypeColumns,
    byEstate,
    byRegion,
    grandTotal,
  };
}
