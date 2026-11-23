import { describe, it, expect } from "vitest";
import JSZip from "jszip";
import { generatePumpReportDocx } from "../src/lib/word/pump-report-docx";

// 1x1 transparent PNG pixel for testing embedded image support
const TINY_PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
  "base64"
);

describe("Word (.docx) Pump Report Generator", () => {
  it("generates a valid .docx with blank signature names/titles and embedded photos", async () => {
    const buffer = await generatePumpReportDocx({
      companyName: "PT TH Indoplantation",
      regionName: "Region 1 / Wilayah 2",
      estateCode: "PUL",
      blockCode: "28-17",
      pumpCode: "R1-AD-17",
      pumpTypeName: "Axial Double",
      engineBrandName: "Donfeng",
      unitStatus: "perlu_perbaikan",
      inspectedAt: "2026-11-23",
      inspectorName: "Admin Pompa THIP",
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
        {
          sectionCode: "B",
          sectionName: "MESIN",
          itemNo: 1,
          partName: "Batery/Accu 12V",
          expectedQty: 1,
          availability: "hilang",
          condition: "rusak",
          issueLabel: "Hilang",
          notes: "",
        },
      ],
      photos: [
        {
          buffer: TINY_PNG,
          mimeType: "image/png",
          caption: "Dokumentasi R1-AD-17 #1",
        },
      ],
    });

    expect(buffer.subarray(0, 2).toString("utf-8")).toBe("PK");

    const zip = await JSZip.loadAsync(buffer);
    const docXml = await zip.file("word/document.xml")?.async("string");
    expect(docXml).toBeDefined();
    expect(docXml).toContain("R1-AD-17");
    expect(docXml).toContain("Batery/Accu 12V");
    expect(docXml).toContain("Diperiksa Oleh,");
    expect(docXml).toContain("Diketahui Oleh,");
    expect(docXml).toContain("Disetujui Oleh,");
    expect(docXml).not.toContain("Workshop / Kepala Mekanik");
    expect(docXml).not.toContain("Estate Manager");

    const mediaFiles = Object.keys(zip.files).filter((f) => f.startsWith("word/media/"));
    expect(mediaFiles.length).toBe(1);
  });
});
