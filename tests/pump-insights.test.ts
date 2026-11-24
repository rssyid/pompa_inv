import { describe, expect, it } from "vitest";
import type { EnrichedPump } from "../src/lib/client-fetch";
import {
  computeFleetInsights,
  formatRelativeDaysId,
  formatShortDateId,
  getBreakdownDays,
  getInspectionAgeDays,
  getMonthBoundsFromDate,
  isInspectionStale,
  matchesInsightFilter,
  matchesPumpSearch,
  sortPumps,
} from "../src/lib/pump-insights";

function makePump(overrides: Partial<EnrichedPump> & { id: number; pumpCode: string }): EnrichedPump {
  return {
    id: overrides.id,
    pumpCode: overrides.pumpCode,
    currentUnitStatus: overrides.currentUnitStatus ?? "aktif",
    lastInspectedAt: overrides.lastInspectedAt ?? "2026-11-20T00:00:00.000Z",
    isActive: overrides.isActive ?? true,
    blockId: overrides.blockId !== undefined ? overrides.blockId : 10,
    blockCode: overrides.blockCode !== undefined ? overrides.blockCode : "52-09",
    blockName: overrides.blockName ?? "52-09",
    estateId: overrides.estateId !== undefined ? overrides.estateId : 1,
    estateCode: overrides.estateCode !== undefined ? overrides.estateCode : "EBO",
    estateName: overrides.estateName ?? "Estate Eboni",
    estateSortOrder: overrides.estateSortOrder ?? 1,
    regionId: overrides.regionId ?? 1,
    regionCode: overrides.regionCode ?? "R1",
    regionName: overrides.regionName ?? "Region 1",
    companyId: overrides.companyId ?? 1,
    companyCode: overrides.companyCode ?? "THIP",
    companyName: overrides.companyName ?? "PT TH Indoplantation",
    pumpTypeId: overrides.pumpTypeId ?? 1,
    pumpTypeCode: overrides.pumpTypeCode ?? "AX-D",
    pumpTypeName: overrides.pumpTypeName ?? "Axial Double",
    engineBrandId: overrides.engineBrandId ?? 1,
    engineBrandName: overrides.engineBrandName ?? "Mitsubishi",
    latestInspectionId:
      overrides.latestInspectionId !== undefined ? overrides.latestInspectionId : 100,
    latestInspectedDate:
      overrides.latestInspectedDate !== undefined ? overrides.latestInspectedDate : "2026-11-20",
    latestInspectorName: overrides.latestInspectorName ?? "Budi",
    issueCount: overrides.issueCount ?? 0,
    photoCount: overrides.photoCount ?? 1,
    isLocationAssigned: overrides.isLocationAssigned ?? true,
    operationalNote: overrides.operationalNote ?? null,
    operationalCategory: overrides.operationalCategory ?? "none",
    repairStatus: overrides.repairStatus ?? null,
    isPreOrder: overrides.isPreOrder ?? false,
    breakdownStartDate: overrides.breakdownStartDate ?? null,
    locationUpdatedAt: overrides.locationUpdatedAt ?? null,
    latestIssues: overrides.latestIssues ?? [],
    monthTotalHours: overrides.monthTotalHours ?? 0,
    lastOperatingDate: overrides.lastOperatingDate ?? null,
  };
}

describe("Pump Insights Domain Helpers", () => {
  const refDate = "2026-11-24";

  it("evaluates inspection age and 30-day staleness boundary accurately", () => {
    expect(getInspectionAgeDays("2026-11-24", refDate)).toBe(0);
    expect(getInspectionAgeDays("2026-10-25", refDate)).toBe(30);
    expect(getInspectionAgeDays("2026-10-24", refDate)).toBe(31);
    expect(getInspectionAgeDays(null, refDate)).toBeNull();

    expect(isInspectionStale("2026-10-25", refDate)).toBe(false);
    expect(isInspectionStale("2026-10-24", refDate)).toBe(true);
    expect(isInspectionStale(null, refDate)).toBe(true);

    expect(formatRelativeDaysId(0)).toBe("Hari ini");
    expect(formatRelativeDaysId(1)).toBe("Kemarin");
    expect(formatRelativeDaysId(12)).toBe("12 hari lalu");
    expect(formatRelativeDaysId(null)).toBe("Belum pernah");
    expect(formatShortDateId("2026-11-24")).toBe("24 Nov 2026");
  });

  it("computes breakdown days only for non-active units with a real start date", () => {
    expect(getBreakdownDays("2026-11-20", "aktif", refDate)).toBeNull();
    expect(getBreakdownDays(null, "rusak_total", refDate)).toBeNull();
    expect(getBreakdownDays("2026-11-24", "perlu_perbaikan", refDate)).toBe(1);
    expect(getBreakdownDays("2026-11-20", "rusak_total", refDate)).toBe(5);
  });

  it("computes month bounds in Indonesian format", () => {
    expect(getMonthBoundsFromDate("2026-11-24")).toEqual({
      month: "2026-11",
      monthLabel: "November 2026",
      monthStart: "2026-11-01",
      monthEnd: "2026-11-30",
    });
  });

  it("aggregates fleet readiness and insight counts safely including empty fleet", () => {
    expect(computeFleetInsights([], refDate)).toEqual({
      total: 0,
      aktif: 0,
      perluPerbaikan: 0,
      rusakTotal: 0,
      attentionCount: 0,
      readinessPct: 0,
      preOrderCount: 0,
      unassignedOrWscCount: 0,
      staleInspectionCount: 0,
      totalIssues: 0,
      totalMonthHours: 0,
      operatingUnitsCount: 0,
    });

    const fleet = [
      makePump({ id: 1, pumpCode: "R1-AD-01", currentUnitStatus: "aktif", monthTotalHours: 42.5 }),
      makePump({
        id: 2,
        pumpCode: "R1-AD-02",
        currentUnitStatus: "perlu_perbaikan",
        issueCount: 2,
        latestInspectedDate: "2026-10-01",
        isLocationAssigned: false,
        monthTotalHours: 10,
      }),
      makePump({
        id: 3,
        pumpCode: "R1-AD-03",
        currentUnitStatus: "rusak_total",
        issueCount: 4,
        isPreOrder: true,
        latestInspectedDate: null,
        latestInspectionId: null,
      }),
    ];

    expect(computeFleetInsights(fleet, refDate)).toEqual({
      total: 3,
      aktif: 1,
      perluPerbaikan: 1,
      rusakTotal: 1,
      attentionCount: 2,
      readinessPct: 33,
      preOrderCount: 1,
      unassignedOrWscCount: 1,
      staleInspectionCount: 2,
      totalIssues: 6,
      totalMonthHours: 52.5,
      operatingUnitsCount: 2,
    });
  });

  it("filters pumps by insight categories and rich search including failing part names", () => {
    const p1 = makePump({
      id: 1,
      pumpCode: "R1-AD-02",
      currentUnitStatus: "aktif",
      operationalNote: "Lokasi rawan banjir TBM",
    });
    const p2 = makePump({
      id: 2,
      pumpCode: "R1-AD-10",
      currentUnitStatus: "rusak_total",
      operationalCategory: "rusak_po",
      isLocationAssigned: false,
      latestInspectedDate: "2026-09-15",
      issueCount: 2,
      latestIssues: [
        {
          partName: "Seal Mekanis",
          sectionName: "Pompa Utama",
          availability: "ada",
          condition: "rusak",
          issueLabel: "Bocor",
          notes: null,
        },
      ],
    });

    expect(matchesInsightFilter(p1, "attention", refDate)).toBe(false);
    expect(matchesInsightFilter(p2, "attention", refDate)).toBe(true);
    expect(matchesInsightFilter(p2, "rusak_total", refDate)).toBe(true);
    expect(matchesInsightFilter(p2, "pre_order", refDate)).toBe(true);
    expect(matchesInsightFilter(p2, "unassigned_or_wsc", refDate)).toBe(true);
    expect(matchesInsightFilter(p2, "stale_inspection", refDate)).toBe(true);

    expect(matchesPumpSearch(p2, "seal mekanis")).toBe(true);
    expect(matchesPumpSearch(p2, "bocor")).toBe(true);
    expect(matchesPumpSearch(p1, "banjir")).toBe(true);
    expect(matchesPumpSearch(p1, "seal")).toBe(false);
  });

  it("sorts pumps across all sort modes while keeping estate order intact by default", () => {
    const a = makePump({
      id: 1,
      pumpCode: "R1-AD-10",
      currentUnitStatus: "aktif",
      issueCount: 0,
      latestInspectedDate: "2026-11-23",
      monthTotalHours: 12,
    });
    const b = makePump({
      id: 2,
      pumpCode: "R1-AD-2",
      currentUnitStatus: "rusak_total",
      issueCount: 3,
      latestInspectedDate: null,
      latestInspectionId: null,
      monthTotalHours: 0,
    });
    const c = makePump({
      id: 3,
      pumpCode: "R1-AD-5",
      currentUnitStatus: "perlu_perbaikan",
      issueCount: 5,
      latestInspectedDate: "2026-10-10",
      monthTotalHours: 64,
    });

    const list = [a, b, c];

    expect(sortPumps(list, "estate_order", "asc", refDate).map((p) => p.id)).toEqual([1, 2, 3]);
    expect(sortPumps(list, "estate_order", "desc", refDate).map((p) => p.id)).toEqual([3, 2, 1]);
    expect(sortPumps(list, "priority", "asc", refDate).map((p) => p.id)).toEqual([2, 3, 1]);
    expect(sortPumps(list, "issues_desc", "asc", refDate).map((p) => p.id)).toEqual([3, 2, 1]);
    expect(sortPumps(list, "inspection_oldest", "asc", refDate).map((p) => p.id)).toEqual([
      2,
      3,
      1,
    ]);
    expect(sortPumps(list, "hours_desc", "asc", refDate).map((p) => p.id)).toEqual([3, 1, 2]);
    expect(sortPumps(list, "code_asc", "asc", refDate).map((p) => p.pumpCode)).toEqual([
      "R1-AD-2",
      "R1-AD-5",
      "R1-AD-10",
    ]);
  });
});
