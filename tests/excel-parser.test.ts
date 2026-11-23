import { describe, it, expect } from "vitest";
import fs from "node:fs/promises";
import path from "node:path";
import { parsePumpWorkbook } from "../src/lib/excel/parser";
import { generateRecapWorkbook, generateSinglePumpWorkbook } from "../src/lib/excel/exporter";
import ExcelJS from "exceljs";

describe("Excel Pump Parser & Exporter", () => {
  it("parses Region 1 workbook including ctrlProps checkboxes and 115 richData photos", async () => {
    const filePath = path.resolve(process.cwd(), "data", "Form Pemeriksaan Pompa Region 1.xlsx");
    const buf = await fs.readFile(filePath);
    const records = await parsePumpWorkbook(buf, { fileName: "Form Pemeriksaan Pompa Region 1.xlsx" });

    expect(records.length).toBeGreaterThanOrEqual(30);

    const estates = new Set(records.map((r) => r.estateCode));
    expect(estates).toContain("MHO");
    expect(estates).toContain("CEN");
    expect(estates).toContain("NAS");
    expect(estates).toContain("TEM");
    expect(estates).toContain("MER");
    expect(estates).toContain("EBO");

    const totalPhotos = records.reduce((sum, r) => sum + r.photos.length, 0);
    expect(totalPhotos).toBe(119);

    const r1At42 = records.find((r) => r.pumpCode === "R1-AT-42");
    expect(r1At42).toBeDefined();
    expect(r1At42?.pumpTypeCode).toBe("axial_triple");
    expect(r1At42?.parts.length).toBe(51);
    expect(r1At42?.photos.length).toBeGreaterThan(0);
  }, 15000);

  it("parses Wilayah 2 workbook with 24 photos", async () => {
    const filePath = path.resolve(process.cwd(), "data", "Form Pemeriksaan Pompa Wilayah 2.xlsx");
    const buf = await fs.readFile(filePath);
    const records = await parsePumpWorkbook(buf, { fileName: "Form Pemeriksaan Pompa Wilayah 2.xlsx" });

    expect(records.length).toBe(6);
    const totalPhotos = records.reduce((sum, r) => sum + r.photos.length, 0);
    expect(totalPhotos).toBe(24);
  });

  it("parses PUL workbook assigning estateCode PUL and deduplicating sheet codes", async () => {
    const filePath = path.resolve(process.cwd(), "data", "Form Pemeriksaan Pompa PUL.xlsx");
    const buf = await fs.readFile(filePath);
    const records = await parsePumpWorkbook(buf, { fileName: "Form Pemeriksaan Pompa PUL.xlsx" });

    expect(records.length).toBe(5);
    for (const r of records) {
      expect(r.estateCode).toBe("PUL");
    }
    const r1Ad17 = records.find((r) => r.pumpCode === "R1-AD-17");
    expect(r1Ad17?.parts.length).toBe(39);
    const codes = new Set(records.map((r) => r.pumpCode));
    expect(codes.has("R1-AD-17")).toBe(true);
    expect(codes.has("R1-AD1-026")).toBe(true);
    expect(codes.has("R1-AD-01")).toBe(true);
    expect(codes.has("R1-AD-05")).toBe(true);
  });

  it("generates valid recap and single-pump xlsx workbooks", async () => {
    const recapBuf = await generateRecapWorkbook({
      filterSummary: "Semua Estate",
      pumps: [
        {
          companyName: "PT TH Indoplantation",
          regionName: "Region 1 / Wilayah 2",
          estateCode: "PUL",
          blockCode: "28-17",
          pumpCode: "R1-AD-17",
          pumpTypeName: "Axial Double",
          engineBrandName: "Donfeng",
          unitStatus: "perlu_perbaikan",
          lastInspectedAt: "2026-11-23",
          inspectorName: "Admin",
          issueCount: 2,
        },
      ],
      issues: [
        {
          regionName: "Region 1 / Wilayah 2",
          estateCode: "PUL",
          blockCode: "28-17",
          pumpCode: "R1-AD-17",
          pumpTypeName: "Axial Double",
          sectionName: "POMPA 1",
          partName: "Pipa buang 6m",
          expectedQty: 1,
          availability: "ada",
          condition: "rusak",
          issueLabel: "Bocor",
          notes: "",
          inspectedAt: "2026-11-23",
        },
      ],
    });

    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(recapBuf as unknown as ArrayBuffer);
    expect(wb.worksheets.map((s) => s.name)).toEqual([
      "Ringkasan Estate",
      "Kondisi Semua Pompa",
      "Part Bermasalah & Hilang",
    ]);

    const singleBuf = await generateSinglePumpWorkbook({
      companyName: "PT TH Indoplantation",
      regionName: "Region 1 / Wilayah 2",
      estateCode: "PUL",
      blockCode: "28-17",
      pumpCode: "R1-AD-17",
      pumpTypeName: "Axial Double",
      engineBrandName: "Donfeng",
      unitStatus: "perlu_perbaikan",
      inspectedAt: "2026-11-23",
      inspectorName: "Admin",
      notes: "",
      items: [
        {
          sectionCode: "A",
          sectionName: "RUMAH POMPA",
          itemNo: 0,
          partName: "RUMAH POMPA",
          expectedQty: 1,
          availability: "ada",
          condition: "rusak",
          issueLabel: "Perlu Perbaikan",
          notes: "",
        },
      ],
    });
    const wbSingle = new ExcelJS.Workbook();
    await wbSingle.xlsx.load(singleBuf as unknown as ArrayBuffer);
    expect(wbSingle.worksheets[0]?.name).toBe("R1-AD-17");
  });
});
