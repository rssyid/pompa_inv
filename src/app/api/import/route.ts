import { NextRequest, NextResponse } from "next/server";
import { requireApiSession } from "@/lib/auth";
import { parsePumpWorkbook } from "@/lib/excel/parser";
import { importParsedPumpRecords } from "@/lib/import-service";

export async function POST(request: NextRequest) {
  const auth = await requireApiSession("admin");
  if ("error" in auth) return auth.error;

  try {
    const formData = await request.formData();
    const file = formData.get("file");
    const mode = String(formData.get("mode") ?? "preview");
    const defaultEstateCode = String(formData.get("defaultEstateCode") ?? "").trim() || undefined;
    const companyName = String(formData.get("companyName") ?? "PT TH Indoplantation").trim();

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "File Excel (.xlsx) wajib dipilih." }, { status: 400 });
    }

    if (!file.name.toLowerCase().endsWith(".xlsx")) {
      return NextResponse.json({ error: "Format file harus .xlsx." }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const parsed = await parsePumpWorkbook(buffer, {
      fileName: file.name,
      defaultEstateCode,
    });

    if (mode === "preview") {
      return NextResponse.json({
        preview: parsed.map((p) => ({
          pumpCode: p.pumpCode,
          pumpTypeName: p.pumpTypeName,
          regionName: p.regionName,
          estateCode: p.estateCode,
          blockCode: p.blockCode,
          engineBrand: p.engineBrand,
          unitStatus: p.unitStatus,
          partCount: p.parts.length,
          photoCount: p.photos.length,
        })),
      });
    }

    const summary = await importParsedPumpRecords({
      records: parsed,
      companyCode: "THIP",
      companyName,
      inspectorId: auth.user.userId,
      inspectorName: auth.user.name,
      source: "excel_import",
      skipExistingPumps: false,
    });

    return NextResponse.json({ summary });
  } catch (err) {
    console.error("Excel import error:", err);
    return NextResponse.json(
      { error: "Gagal memproses file Excel. Pastikan format sheet sesuai template pompa." },
      { status: 500 }
    );
  }
}
