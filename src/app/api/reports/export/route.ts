import { NextRequest, NextResponse } from "next/server";
import { asc, desc, eq } from "drizzle-orm";
import { getDb } from "@/db";
import {
  blocks,
  companies,
  engineBrands,
  estates,
  inspectionItems,
  inspections,
  issuePresets,
  pumps,
  pumpTypes,
  regions,
} from "@/db/schema";
import { requireApiSession } from "@/lib/auth";
import { generateRecapWorkbook, generateSinglePumpWorkbook } from "@/lib/excel/exporter";
import { queryFilteredPumps, queryLatestIssuesForPumps } from "@/lib/queries/pumps";

export async function GET(request: NextRequest) {
  const auth = await requireApiSession();
  if ("error" in auth) return auth.error;

  const sp = request.nextUrl.searchParams;
  const exportType = sp.get("type") ?? "recap";

  if (exportType === "pump") {
    const pumpId = Number(sp.get("pumpId"));
    if (!Number.isInteger(pumpId) || pumpId <= 0) {
      return NextResponse.json({ error: "ID pompa tidak valid." }, { status: 400 });
    }

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
      .innerJoin(blocks, eq(pumps.blockId, blocks.id))
      .innerJoin(estates, eq(blocks.estateId, estates.id))
      .innerJoin(regions, eq(estates.regionId, regions.id))
      .innerJoin(companies, eq(regions.companyId, companies.id))
      .innerJoin(pumpTypes, eq(pumps.pumpTypeId, pumpTypes.id))
      .innerJoin(engineBrands, eq(pumps.engineBrandId, engineBrands.id))
      .where(eq(pumps.id, pumpId))
      .limit(1);

    if (!pump) {
      return NextResponse.json({ error: "Pompa tidak ditemukan." }, { status: 404 });
    }

    const [latest] = await db
      .select()
      .from(inspections)
      .where(eq(inspections.pumpId, pumpId))
      .orderBy(desc(inspections.inspectedAt), desc(inspections.id))
      .limit(1);

    const items = latest
      ? await db
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
          .where(eq(inspectionItems.inspectionId, latest.id))
          .orderBy(asc(inspectionItems.sortOrder))
      : [];

    const buffer = await generateSinglePumpWorkbook({
      companyName: pump.companyName,
      regionName: pump.regionName,
      estateCode: pump.estateCode,
      blockCode: pump.blockCode,
      pumpCode: pump.pumpCode,
      pumpTypeName: pump.pumpTypeName,
      engineBrandName: pump.engineBrandName,
      unitStatus: latest?.unitStatus ?? pump.currentUnitStatus,
      inspectedAt: latest?.inspectedAt ?? "-",
      inspectorName: latest?.inspectorName ?? "-",
      notes: latest?.notes ?? "",
      items: items.map((item) => ({
        ...item,
        issueLabel: item.issueLabel ?? "",
        notes: item.notes ?? "",
      })),
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
  const buffer = await generateRecapWorkbook({
    filterSummary: `${filteredPumps.length} unit pompa`,
    pumps: filteredPumps.map((p) => ({
      companyName: p.companyName,
      regionName: p.regionName,
      estateCode: p.estateCode,
      blockCode: p.blockCode,
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
