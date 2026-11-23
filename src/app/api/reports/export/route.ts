import { NextRequest, NextResponse } from "next/server";
import { and, asc, desc, eq, sql } from "drizzle-orm";
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
import { requireApiSession } from "@/lib/auth";
import {
  generateOperatingHoursWorkbook,
  generateRecapWorkbook,
  generateSinglePumpWorkbook,
} from "@/lib/excel/exporter";
import { queryOperatingHoursMonitoring } from "@/lib/queries/operating-hours";
import { queryFilteredPumps, queryLatestIssuesForPumps } from "@/lib/queries/pumps";
import { getStorageProvider } from "@/lib/storage";
import { generatePumpReportDocx } from "@/lib/word/pump-report-docx";

async function loadSinglePumpExportData(pumpId: number, inspectionIdParam?: number) {
  const db = getDb();
  const [pump] = await db
    .select({
      id: pumps.id,
      pumpCode: pumps.pumpCode,
      currentUnitStatus: pumps.currentUnitStatus,
      blockCode: blocks.code,
      estateCode: estates.code,
      regionName: regions.name,
      companyName: companies.name,
      pumpTypeName: pumpTypes.name,
      engineBrandName: engineBrands.name,
    })
    .from(pumps)
    .leftJoin(blocks, eq(pumps.blockId, blocks.id))
    .leftJoin(estates, sql`COALESCE(${blocks.estateId}, ${pumps.estateId}) = ${estates.id}`)
    .leftJoin(regions, eq(estates.regionId, regions.id))
    .leftJoin(companies, eq(regions.companyId, companies.id))
    .innerJoin(pumpTypes, eq(pumps.pumpTypeId, pumpTypes.id))
    .innerJoin(engineBrands, eq(pumps.engineBrandId, engineBrands.id))
    .where(eq(pumps.id, pumpId))
    .limit(1);

  if (!pump) return null;

  const [inspection] = inspectionIdParam
    ? await db
        .select()
        .from(inspections)
        .where(and(eq(inspections.id, inspectionIdParam), eq(inspections.pumpId, pumpId)))
        .limit(1)
    : await db
        .select()
        .from(inspections)
        .where(eq(inspections.pumpId, pumpId))
        .orderBy(desc(inspections.inspectedAt), desc(inspections.id))
        .limit(1);

  const [items, photoRows] = inspection
    ? await Promise.all([
        db
          .select({
            sectionCode: inspectionItems.sectionCode,
            sectionName: inspectionItems.sectionName,
            itemNo: inspectionItems.itemNo,
            partName: inspectionItems.partName,
            expectedQty: inspectionItems.expectedQty,
            availability: inspectionItems.availability,
            condition: inspectionItems.condition,
            issueLabel: issuePresets.label,
            notes: inspectionItems.notes,
          })
          .from(inspectionItems)
          .leftJoin(issuePresets, eq(inspectionItems.issuePresetId, issuePresets.id))
          .where(eq(inspectionItems.inspectionId, inspection.id))
          .orderBy(asc(inspectionItems.sortOrder)),
        db
          .select()
          .from(inspectionPhotos)
          .where(eq(inspectionPhotos.inspectionId, inspection.id))
          .orderBy(asc(inspectionPhotos.id)),
      ])
    : [[], []];

  return { pump, inspection: inspection ?? null, items, photoRows };
}

export async function GET(request: NextRequest) {
  const auth = await requireApiSession();
  if ("error" in auth) return auth.error;

  const sp = request.nextUrl.searchParams;
  const exportType = sp.get("type") ?? "recap";

  if (exportType === "pump" || exportType === "pump-docx") {
    const pumpId = Number(sp.get("pumpId"));
    const inspectionId = Number(sp.get("inspectionId")) || undefined;
    if (!Number.isInteger(pumpId) || pumpId <= 0) {
      return NextResponse.json({ error: "ID pompa tidak valid." }, { status: 400 });
    }

    const data = await loadSinglePumpExportData(pumpId, inspectionId);
    if (!data) {
      return NextResponse.json({ error: "Pompa tidak ditemukan." }, { status: 404 });
    }

    const { pump, inspection, items, photoRows } = data;
    const mappedItems = items.map((item) => ({
      ...item,
      issueLabel: item.issueLabel ?? "",
      notes: item.notes ?? "",
    }));

    if (exportType === "pump-docx") {
      const photos = (
        await Promise.all(
          photoRows.map(async (p) => {
            try {
              const provider = getStorageProvider(
                p.storageProvider === "local" ? "local" : "gdrive"
              );
              const res = await provider.read(p.storageKey, p.mimeType);
              return {
                buffer: res.buffer,
                mimeType: p.mimeType || res.mimeType,
                caption: p.caption || p.fileName,
              };
            } catch {
              return null;
            }
          })
        )
      ).filter((p): p is NonNullable<typeof p> => p !== null);

      const docBuffer = await generatePumpReportDocx({
        companyName: pump.companyName ?? "PT TH Indoplantation",
        regionName: pump.regionName ?? "-",
        estateCode: pump.estateCode ?? "-",
        blockCode: pump.blockCode ?? "Belum Assign",
        pumpCode: pump.pumpCode,
        pumpTypeName: pump.pumpTypeName,
        engineBrandName: pump.engineBrandName,
        unitStatus: inspection?.unitStatus ?? pump.currentUnitStatus,
        inspectedAt: inspection?.inspectedAt ?? "-",
        inspectorName: inspection?.inspectorName ?? "-",
        notes: inspection?.notes ?? "",
        items: mappedItems,
        photos,
      });

      const safeCode = pump.pumpCode.replace(/[^a-zA-Z0-9_-]/g, "_");
      return new NextResponse(new Uint8Array(docBuffer), {
        status: 200,
        headers: {
          "Content-Type":
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
          "Content-Disposition": `attachment; filename="Laporan_${safeCode}.docx"`,
        },
      });
    }

    const buffer = await generateSinglePumpWorkbook({
      companyName: pump.companyName ?? "PT TH Indoplantation",
      regionName: pump.regionName ?? "-",
      estateCode: pump.estateCode ?? "-",
      blockCode: pump.blockCode ?? "Belum Assign",
      pumpCode: pump.pumpCode,
      pumpTypeName: pump.pumpTypeName,
      engineBrandName: pump.engineBrandName,
      unitStatus: inspection?.unitStatus ?? pump.currentUnitStatus,
      inspectedAt: inspection?.inspectedAt ?? "-",
      inspectorName: inspection?.inspectorName ?? "-",
      notes: inspection?.notes ?? "",
      items: mappedItems,
    });

    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="Form_${pump.pumpCode}.xlsx"`,
      },
    });
  }

  if (exportType === "operating-hours") {
    const report = await queryOperatingHoursMonitoring({
      month: sp.get("month") || undefined,
      dateFrom: sp.get("dateFrom") || undefined,
      dateTo: sp.get("dateTo") || undefined,
      windowPreset: sp.get("windowPreset") || undefined,
      companyId: Number(sp.get("companyId")) || undefined,
      regionId: Number(sp.get("regionId")) || undefined,
      estateId: Number(sp.get("estateId")) || undefined,
      blockId: Number(sp.get("blockId")) || undefined,
      pumpTypeId: Number(sp.get("pumpTypeId")) || undefined,
      status: sp.get("status") ?? undefined,
      search: sp.get("search") ?? undefined,
    });

    const buffer = await generateOperatingHoursWorkbook({ report });
    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="Monitoring_Jam_Pompa_${report.month}.xlsx"`,
      },
    });
  }

  const dateFrom = sp.get("dateFrom") || undefined;
  const dateTo = sp.get("dateTo") || undefined;

  const matched = await queryFilteredPumps({
    companyId: Number(sp.get("companyId")) || undefined,
    regionId: Number(sp.get("regionId")) || undefined,
    estateId: Number(sp.get("estateId")) || undefined,
    blockId: Number(sp.get("blockId")) || undefined,
    pumpTypeId: Number(sp.get("pumpTypeId")) || undefined,
    status: sp.get("status") ?? undefined,
    search: sp.get("search") ?? undefined,
  });

  const filteredPumps = matched.filter((p) => {
    if (!dateFrom && !dateTo) return true;
    const d = p.latestInspectedDate ?? "";
    if (!d) return false;
    if (dateFrom && d < dateFrom) return false;
    if (dateTo && d > dateTo) return false;
    return true;
  });

  const issues = await queryLatestIssuesForPumps(filteredPumps, dateFrom, dateTo);
  const filterParts: string[] = [`${filteredPumps.length} unit pompa`];
  const statusFilter = sp.get("status");
  if (statusFilter) {
    filterParts.push(`Status: ${statusFilter}`);
  }
  if (dateFrom || dateTo) {
    filterParts.push(`Periode: ${dateFrom || "Awal"} s/d ${dateTo || "Sekarang"}`);
  }
  const searchFilter = sp.get("search")?.trim();
  if (searchFilter) {
    filterParts.push(`Cari: ${searchFilter}`);
  }

  const buffer = await generateRecapWorkbook({
    filterSummary: filterParts.join(" | "),
    pumps: filteredPumps.map((p) => ({
      companyName: p.companyName ?? "PT TH Indoplantation",
      regionName: p.regionName ?? "-",
      estateCode: p.estateCode ?? "-",
      blockCode: p.blockCode ?? "Belum Assign",
      pumpCode: p.pumpCode,
      pumpTypeName: p.pumpTypeName,
      engineBrandName: p.engineBrandName,
      unitStatus: p.currentUnitStatus,
      lastInspectedAt: p.latestInspectedDate ?? "",
      inspectorName: p.latestInspectorName ?? "",
      issueCount: p.issueCount,
    })),
    issues,
  });

  const dateTag = new Date().toISOString().slice(0, 10);
  return new NextResponse(new Uint8Array(buffer), {
    status: 200,
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="Rekap_Pompa_THIP_${dateTag}.xlsx"`,
    },
  });
}
