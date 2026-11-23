import { NextRequest, NextResponse } from "next/server";
import { requireApiSession } from "@/lib/auth";
import { queryOperatingHoursMonitoring } from "@/lib/queries/operating-hours";

export async function GET(request: NextRequest) {
  const auth = await requireApiSession();
  if ("error" in auth) return auth.error;

  const sp = request.nextUrl.searchParams;
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

  return NextResponse.json(report);
}
