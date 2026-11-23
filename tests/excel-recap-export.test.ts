import { describe, expect, it } from "vitest";
import ExcelJS from "exceljs";
import { generateRecapWorkbook } from "../src/lib/excel/exporter";

describe("Excel (.xlsx) Recap Report Exporter", () => {
  it("generates summary, pumps, and issues sheets with accurate TOTAL row", async () => {
    const buffer = await generateRecapWorkbook({
      filterSummary: "3 unit pompa | Status: perlu_perbaikan",
      pumps: [
        {
          companyName: "PT TH Indoplantation",
          regionName: "Region 1",
          estateCode: "PUL",
          blockCode: "28-17",
          pumpCode: "R1-AD-17",
          pumpTypeName: "Axial Double",
          engineBrandName: "Dongfeng",
          unitStatus: "aktif",
          lastInspectedAt: "2026-11-20",
          inspectorName: "Budi",
          issueCount: 0,
        },
        {
          companyName: "PT TH Indoplantation",
          regionName: "Region 1",
          estateCode: "PUL",
          blockCode: "28-18",
          pumpCode: "R1-AD-18",
          pumpTypeName: "Axial Double",
          engineBrandName: "Dongfeng",
          unitStatus: "perlu_perbaikan",
          lastInspectedAt: "2026-11-21",
          inspectorName: "Budi",
          issueCount: 2,
        },
        {
          companyName: "PT TH Indoplantation",
          regionName: "Region 2",
          estateCode: "KBL",
          blockCode: "10-02",
          pumpCode: "R2-AS-02",
          pumpTypeName: "Axial Single",
          engineBrandName: "Yanmar",
          unitStatus: "rusak_total",
          lastInspectedAt: "2026-11-22",
          inspectorName: "Andi",
          issueCount: 1,
        },
      ],
      issues: [
        {
          regionName: "Region 1",
          estateCode: "PUL",
          blockCode: "28-18",
          pumpCode: "R1-AD-18",
          pumpTypeName: "Axial Double",
          sectionName: "MESIN",
          partName: "Accu 12V",
          expectedQty: 1,
          availability: "hilang",
          condition: "rusak",
          issueLabel: "Hilang",
          notes: "Perlu pengadaan",
          inspectedAt: "2026-11-21",
        },
      ],
    });

    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(buffer as unknown as ArrayBuffer);

    expect(wb.worksheets.map((ws) => ws.name)).toEqual([
      "Ringkasan Estate",
      "Kondisi Semua Pompa",
      "Part Bermasalah & Hilang",
    ]);

    const summarySheet = wb.getWorksheet("Ringkasan Estate")!;
    expect(String(summarySheet.getCell("A2").value)).toContain("3 unit pompa");

    // Row 5 is header, rows 6-7 are estates, row 8 is TOTAL
    expect(summarySheet.getCell("A8").value).toBe("TOTAL");
    expect(summarySheet.getCell("C8").value).toBe(3);
    expect(summarySheet.getCell("D8").value).toBe(1);
    expect(summarySheet.getCell("E8").value).toBe(1);
    expect(summarySheet.getCell("F8").value).toBe(1);
    expect(summarySheet.getCell("G8").value).toBe(3);

    const pumpsSheet = wb.getWorksheet("Kondisi Semua Pompa")!;
    expect(pumpsSheet.rowCount).toBe(4);

    const issuesSheet = wb.getWorksheet("Part Bermasalah & Hilang")!;
    expect(issuesSheet.rowCount).toBe(2);
    expect(issuesSheet.getCell("G2").value).toBe("Accu 12V");
  });
});
