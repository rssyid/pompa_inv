import { NextRequest, NextResponse } from "next/server";
import { asc, eq } from "drizzle-orm";
import { getDb } from "@/db";
import {
  blocks,
  companies,
  engineBrands,
  estates,
  issuePresets,
  pumpTypeParts,
  pumpTypes,
  regions,
} from "@/db/schema";
import { requireApiSession } from "@/lib/auth";

export async function GET(request: NextRequest) {
  const auth = await requireApiSession();
  if ("error" in auth) return auth.error;

  const includeInactive =
    request.nextUrl.searchParams.get("includeInactive") === "true" &&
    auth.user.role === "admin";

  const db = getDb();

  const [
    companyRows,
    regionRows,
    estateRows,
    blockRows,
    pumpTypeRows,
    partRows,
    engineBrandRows,
    issuePresetRows,
  ] = await Promise.all([
    includeInactive
      ? db.select().from(companies).orderBy(asc(companies.name))
      : db.select().from(companies).where(eq(companies.isActive, true)).orderBy(asc(companies.name)),
    includeInactive
      ? db.select().from(regions).orderBy(asc(regions.name))
      : db.select().from(regions).where(eq(regions.isActive, true)).orderBy(asc(regions.name)),
    includeInactive
      ? db.select().from(estates).orderBy(asc(estates.code))
      : db.select().from(estates).where(eq(estates.isActive, true)).orderBy(asc(estates.code)),
    includeInactive
      ? db.select().from(blocks).orderBy(asc(blocks.code))
      : db.select().from(blocks).where(eq(blocks.isActive, true)).orderBy(asc(blocks.code)),
    includeInactive
      ? db.select().from(pumpTypes).orderBy(asc(pumpTypes.name))
      : db.select().from(pumpTypes).where(eq(pumpTypes.isActive, true)).orderBy(asc(pumpTypes.name)),
    includeInactive
      ? db.select().from(pumpTypeParts).orderBy(asc(pumpTypeParts.sortOrder))
      : db
          .select()
          .from(pumpTypeParts)
          .where(eq(pumpTypeParts.isActive, true))
          .orderBy(asc(pumpTypeParts.sortOrder)),
    includeInactive
      ? db.select().from(engineBrands).orderBy(asc(engineBrands.name))
      : db
          .select()
          .from(engineBrands)
          .where(eq(engineBrands.isActive, true))
          .orderBy(asc(engineBrands.name)),
    includeInactive
      ? db.select().from(issuePresets).orderBy(asc(issuePresets.sortOrder))
      : db
          .select()
          .from(issuePresets)
          .where(eq(issuePresets.isActive, true))
          .orderBy(asc(issuePresets.sortOrder)),
  ]);

  return NextResponse.json({
    companies: companyRows,
    regions: regionRows,
    estates: estateRows,
    blocks: blockRows,
    pumpTypes: pumpTypeRows,
    pumpTypeParts: partRows,
    engineBrands: engineBrandRows,
    issuePresets: issuePresetRows,
  });
}
