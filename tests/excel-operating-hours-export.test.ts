import { describe, expect, it } from "vitest";
import ExcelJS from "exceljs";
import { generateOperatingHoursWorkbook } from "../src/lib/excel/exporter";

describe("Excel (.xlsx) Operating Hours Monitoring Exporter", () => {
  it("generates grouped monitoring sheet with R-day cells, PRE ORDER merge, and subtotals", async () => {
    const buffer = await generateOperatingHoursWorkbook({
      title: "MONITORING POMPA REGION 1",
      report: {
        month: "2026-11",
        monthName: "November",
        year: 2026,
        monthLabel: "November 2026",
        dateFrom: "2026-11-12",
        dateTo: "2026-11-15",
        updateDate: "2026-11-15",
        dates: [
          { date: "2026-11-12", day: 12, isSunday: false },
          { date: "2026-11-13", day: 13, isSunday: false },
          { date: "2026-11-14", day: 14, isSunday: false },
          { date: "2026-11-15", day: 15, isSunday: true },
        ],
        regions: [
          {
            regionId: 1,
            regionCode: "R1-W1",
            regionName: "Wilayah 1",
            regionTotalHoursMonth: 37,
            pumps: [
              {
                no: 1,
                pumpId: 1,
                pumpCode: "R1-AD-36",
                estateId: 1,
                estateCode: "MRT",
                estateName: "Meranti",
                blockId: 10,
                blockCode: "73-02",
                isLocationAssigned: true,
                pumpTypeName: "Axial Double",
                pumpTypeShort: "AXIAL A-D",
                kondisi: "Rusak",
                currentUnitStatus: "rusak_total",
                isPreOrder: false,
                totalHoursMonth: 0,
                operationalNote: "Rusak mesin, harus ganti gasket",
                operationalCategory: "none",
                repairStatus: "",
                breakdownStartDate: "2026-09-25",
                cells: [
                  { date: "2026-11-12", type: "rusak", value: "R49", hours: 0 },
                  { date: "2026-11-13", type: "rusak", value: "R50", hours: 0 },
                  { date: "2026-11-14", type: "rusak", value: "R51", hours: 0 },
                  { date: "2026-11-15", type: "rusak", value: "R52", hours: 0 },
                ],
              },
              {
                no: 2,
                pumpId: 2,
                pumpCode: "R1-AT-43",
                estateId: 2,
                estateCode: "EBN",
                estateName: "Eboni",
                blockId: 11,
                blockCode: "74-10",
                isLocationAssigned: true,
                pumpTypeName: "Axial Triple",
                pumpTypeShort: "AXIAL A-T",
                kondisi: "Baik",
                currentUnitStatus: "aktif",
                isPreOrder: false,
                totalHoursMonth: 37,
                operationalNote: "Aktif, lokasi rawan banjir (TBM)",
                operationalCategory: "tbm",
                repairStatus: "Perbaikan Tim Traksi",
                breakdownStartDate: null,
                cells: [
                  { date: "2026-11-12", type: "standby", value: "-", hours: 0 },
                  { date: "2026-11-13", type: "hours", value: "6", hours: 6 },
                  { date: "2026-11-14", type: "hours", value: "5", hours: 5 },
                  { date: "2026-11-15", type: "standby", value: "-", hours: 0 },
                ],
              },
            ],
          },
        ],
        grandTotalHoursMonth: 37,
        totalPumps: 2,
      },
    });

    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(buffer as unknown as ArrayBuffer);

    const ws = wb.getWorksheet("Monitoring Jam Pompa")!;
    expect(ws).toBeDefined();
    expect(ws.getCell("A1").value).toBe("MONITORING POMPA REGION 1");
    expect(ws.getCell("G6").value).toBe(12);
    expect(ws.getCell("J6").value).toBe(15);

    // Row 7 is Wilayah 1 banner, Row 8 is R1-AD-36, Row 9 is R1-AT-43, Row 10 is subtotal
    expect(ws.getCell("A7").value).toBe("Wilayah 1");
    expect(ws.getCell("G8").value).toBe("R49");
    expect(ws.getCell("H9").value).toBe(6);
    expect(ws.getCell("K9").value).toBe(37);
    expect(ws.getCell("K10").value).toBe(37);
    expect(ws.getCell("K11").value).toBe(37);
  });
});
