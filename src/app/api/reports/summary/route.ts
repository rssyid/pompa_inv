import { NextRequest, NextResponse } from "next/server";
import { requireApiSession } from "@/lib/auth";
import { compareEstateOrder } from "@/lib/estate-order";
import { queryFilteredPumps, queryLatestIssuesForPumps } from "@/lib/queries/pumps";

export async function GET(request: NextRequest) {
  const auth = await requireApiSession();
  if ("error" in auth) return auth.error;

  const sp = request.nextUrl.searchParams;
  const dateFrom = sp.get("dateFrom") || undefined;
  const dateTo = sp.get("dateTo") || undefined;

  const allMatchingPumps = await queryFilteredPumps({
    companyId: Number(sp.get("companyId")) || undefined,
    regionId: Number(sp.get("regionId")) || undefined,
    estateId: Number(sp.get("estateId")) || undefined,
    blockId: Number(sp.get("blockId")) || undefined,
    pumpTypeId: Number(sp.get("pumpTypeId")) || undefined,
    status: sp.get("status") ?? undefined,
    search: sp.get("search") ?? undefined,
  });

  const pumps = allMatchingPumps.filter((p) => {
    if (!dateFrom && !dateTo) return true;
    const d = p.latestInspectedDate ?? "";
    if (!d) return false;
    if (dateFrom && d < dateFrom) return false;
    if (dateTo && d > dateTo) return false;
    return true;
  });

  const issues = await queryLatestIssuesForPumps(pumps, dateFrom, dateTo);

  const totals = {
    total: pumps.length,
    aktif: pumps.filter((p) => p.currentUnitStatus === "aktif").length,
    perluPerbaikan: pumps.filter((p) => p.currentUnitStatus === "perlu_perbaikan").length,
    rusakTotal: pumps.filter((p) => p.currentUnitStatus === "rusak_total").length,
    totalIssues: issues.length,
  };

  const estateMap = new Map<
    string,
    {
      estateId: number;
      estateCode: string;
      regionName: string;
      sortOrder: number;
      total: number;
      aktif: number;
      perluPerbaikan: number;
      rusakTotal: number;
      issueCount: number;
    }
  >();

  for (const p of pumps) {
    const key = `${p.estateId ?? 0}`;
    const entry = estateMap.get(key) ?? {
      estateId: p.estateId ?? 0,
      estateCode: p.estateCode ?? "Belum Assign",
      regionName: p.regionName ?? "-",
      sortOrder: p.estateSortOrder ?? 0,
      total: 0,
      aktif: 0,
      perluPerbaikan: 0,
      rusakTotal: 0,
      issueCount: 0,
    };
    entry.total += 1;
    if (p.currentUnitStatus === "aktif") entry.aktif += 1;
    else if (p.currentUnitStatus === "perlu_perbaikan") entry.perluPerbaikan += 1;
    else entry.rusakTotal += 1;
    entry.issueCount += p.issueCount;
    estateMap.set(key, entry);
  }

  const byEstate = Array.from(estateMap.values()).sort((a, b) =>
    compareEstateOrder(
      { sortOrder: a.sortOrder, code: a.estateId ? a.estateCode : null },
      { sortOrder: b.sortOrder, code: b.estateId ? b.estateCode : null }
    )
  );

  return NextResponse.json({
    totals,
    byEstate,
    pumps,
    issues,
  });
}
