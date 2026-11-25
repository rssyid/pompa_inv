import { describe, expect, it } from "vitest";
import {
  BreakdownPumpInput,
  PumpTypeColumn,
  buildSummaryBreakdowns,
  comparePumpTypeOrder,
  formatReadinessPercent,
} from "../src/lib/summary-breakdown";

const PUMP_TYPES: PumpTypeColumn[] = [
  { id: 4, code: "axial_triple", name: "Axial Triple" },
  { id: 7, code: "ebara", name: "Ebara" },
  { id: 1, code: "axial_single", name: "Axial Single" },
  { id: 13, code: "axial_double", name: "Axial Double" },
];

function makePump(overrides: Partial<BreakdownPumpInput> = {}): BreakdownPumpInput {
  return {
    estateId: 1,
    estateCode: "MER",
    estateSortOrder: 1,
    regionId: 15,
    regionCode: "R1-W1",
    regionName: "Region 1 / Wilayah 1",
    pumpTypeId: 1,
    pumpTypeCode: "axial_single",
    pumpTypeName: "Axial Single",
    currentUnitStatus: "aktif",
    issueCount: 0,
    ...overrides,
  };
}

describe("summary-breakdown", () => {
  it("orders pump type columns canonically then alphabetically", () => {
    const sorted = [
      ...PUMP_TYPES,
      { id: 99, code: "custom_b", name: "Beta Pump" },
      { id: 98, code: "custom_a", name: "Alpha Pump" },
    ].sort(comparePumpTypeOrder);

    expect(sorted.map((t) => t.code)).toEqual([
      "axial_single",
      "axial_double",
      "axial_triple",
      "ebara",
      "custom_a",
      "custom_b",
    ]);
  });

  it("computes readiness percentage safely", () => {
    expect(formatReadinessPercent(0, 0)).toBe(0);
    expect(formatReadinessPercent(2, 35)).toBe(6);
    expect(formatReadinessPercent(5, 5)).toBe(100);
  });

  it("groups estates by region with accurate subtotals, pump type cells, and grand total", () => {
    const pumps: BreakdownPumpInput[] = [
      // Region 1 / Wilayah 1 - MER (order 1)
      makePump({
        estateId: 10,
        estateCode: "MER",
        estateSortOrder: 1,
        regionId: 15,
        regionCode: "R1-W1",
        regionName: "Region 1 / Wilayah 1",
        pumpTypeId: 1,
        pumpTypeCode: "axial_single",
        pumpTypeName: "Axial Single",
        currentUnitStatus: "aktif",
        issueCount: 0,
      }),
      // Region 1 / Wilayah 1 - EBO (order 4)
      makePump({
        estateId: 11,
        estateCode: "EBO",
        estateSortOrder: 4,
        regionId: 15,
        regionCode: "R1-W1",
        regionName: "Region 1 / Wilayah 1",
        pumpTypeId: 1,
        pumpTypeCode: "axial_single",
        pumpTypeName: "Axial Single",
        currentUnitStatus: "perlu_perbaikan",
        issueCount: 3,
      }),
      makePump({
        estateId: 11,
        estateCode: "EBO",
        estateSortOrder: 4,
        regionId: 15,
        regionCode: "R1-W1",
        regionName: "Region 1 / Wilayah 1",
        pumpTypeId: 13,
        pumpTypeCode: "axial_double",
        pumpTypeName: "Axial Double",
        currentUnitStatus: "rusak_total",
        issueCount: 5,
      }),
      // Region 1 / Wilayah 2 - NAS (order 7)
      makePump({
        estateId: 20,
        estateCode: "NAS",
        estateSortOrder: 7,
        regionId: 1,
        regionCode: "R1-W2",
        regionName: "Region 1 / Wilayah 2",
        pumpTypeId: 7,
        pumpTypeCode: "ebara",
        pumpTypeName: "Ebara",
        currentUnitStatus: "perlu_perbaikan",
        issueCount: 2,
      }),
    ];

    const res = buildSummaryBreakdowns(pumps, PUMP_TYPES);

    expect(res.pumpTypeColumns.map((c) => c.code)).toEqual([
      "axial_single",
      "axial_double",
      "axial_triple",
      "ebara",
    ]);

    expect(res.byRegion).toHaveLength(2);
    expect(res.byRegion[0].regionCode).toBe("R1-W1");
    expect(res.byRegion[0].estates.map((e) => e.estateCode)).toEqual(["MER", "EBO"]);
    expect(res.byRegion[0].subtotal).toMatchObject({
      total: 3,
      aktif: 1,
      perluPerbaikan: 1,
      rusakTotal: 1,
      issueCount: 8,
    });
    expect(res.byRegion[0].subtotal.byPumpType[1]).toMatchObject({
      total: 2,
      aktif: 1,
      perluPerbaikan: 1,
      rusakTotal: 0,
    });
    expect(res.byRegion[0].subtotal.byPumpType[13]).toMatchObject({
      total: 1,
      aktif: 0,
      perluPerbaikan: 0,
      rusakTotal: 1,
    });
    expect(res.byRegion[0].subtotal.byPumpType[4].total).toBe(0);

    expect(res.byRegion[1].regionCode).toBe("R1-W2");
    expect(res.byRegion[1].subtotal).toMatchObject({
      total: 1,
      aktif: 0,
      perluPerbaikan: 1,
      rusakTotal: 0,
      issueCount: 2,
    });

    expect(res.grandTotal).toMatchObject({
      total: 4,
      aktif: 1,
      perluPerbaikan: 2,
      rusakTotal: 1,
      issueCount: 10,
    });
    expect(res.grandTotal.byPumpType[1].total).toBe(2);
    expect(res.grandTotal.byPumpType[13].total).toBe(1);
    expect(res.grandTotal.byPumpType[4].total).toBe(0);
    expect(res.grandTotal.byPumpType[7].total).toBe(1);
  });

  it("places unassigned location pumps into a trailing fallback region group", () => {
    const pumps: BreakdownPumpInput[] = [
      makePump({
        estateId: null,
        estateCode: null,
        estateSortOrder: null,
        regionId: null,
        regionCode: null,
        regionName: null,
        pumpTypeId: 4,
        pumpTypeCode: "axial_triple",
        pumpTypeName: "Axial Triple",
        currentUnitStatus: "perlu_perbaikan",
        issueCount: 4,
      }),
      makePump({
        estateId: 10,
        estateCode: "MER",
        estateSortOrder: 1,
        regionId: 15,
        regionCode: "R1-W1",
        regionName: "Region 1 / Wilayah 1",
      }),
    ];

    const res = buildSummaryBreakdowns(pumps, PUMP_TYPES);
    expect(res.byRegion).toHaveLength(2);
    expect(res.byRegion[0].regionCode).toBe("R1-W1");
    expect(res.byRegion[1].regionId).toBe(0);
    expect(res.byRegion[1].regionName).toBe("Belum Assign Lokasi");
    expect(res.byRegion[1].estates[0].estateCode).toBe("Belum Assign");
    expect(res.grandTotal.total).toBe(2);
  });

  it("handles empty pump list cleanly", () => {
    const res = buildSummaryBreakdowns([], PUMP_TYPES);
    expect(res.byEstate).toEqual([]);
    expect(res.byRegion).toEqual([]);
    expect(res.grandTotal.total).toBe(0);
    expect(res.grandTotal.byPumpType[1].total).toBe(0);
  });
});
