import { NextRequest, NextResponse } from "next/server";
import { and, asc, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { pumpTypes } from "@/db/schema";
import { requireApiSession } from "@/lib/auth";
import { queryFilteredPumps, queryLatestIssuesForPumps } from "@/lib/queries/pumps";
import { buildSummaryBreakdowns } from "@/lib/summary-breakdown";

export async function GET(request: NextRequest) {
  const auth = await requireApiSession();
  if ("error" in auth) return auth.error;

  const sp = request.nextUrl.searchParams;
  const dateFrom = sp.get("dateFrom") || undefined;
  const dateTo = sp.get("dateTo") || undefined;
  const pumpTypeIdFilter = Number(sp.get("pumpTypeId")) || undefined;

  const db = getDb();
  const [allMatchingPumps, activePumpTypeRows] = await Promise.all([
    queryFilteredPumps({
      companyId: Number(sp.get("companyId")) || undefined,
      regionId: Number(sp.get("regionId")) || undefined,
      estateId: Number(sp.get("estateId")) || undefined,
      blockId: Number(sp.get("blockId")) || undefined,
      pumpTypeId: pumpTypeIdFilter,
      status: sp.get("status") ?? undefined,
      search: sp.get("search") ?? undefined,
    }),
    db
      .select({
        id: pumpTypes.id,
        code: pumpTypes.code,
        name: pumpTypes.name,
      })
      .from(pumpTypes)
      .where(
        pumpTypeIdFilter
          ? and(eq(pumpTypes.isActive, true), eq(pumpTypes.id, pumpTypeIdFilter))
          : eq(pumpTypes.isActive, true)
      )
      .orderBy(asc(pumpTypes.name)),
  ]);

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

  const breakdowns = buildSummaryBreakdowns(pumps, activePumpTypeRows);

  return NextResponse.json({
    totals,
    byEstate: breakdowns.byEstate,
    byRegion: breakdowns.byRegion,
    pumpTypeColumns: breakdowns.pumpTypeColumns,
    grandTotal: breakdowns.grandTotal,
    pumps,
    issues,
  });
}
