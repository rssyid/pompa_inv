import { asc, eq, sql } from "drizzle-orm";
import { unstable_cache } from "next/cache";
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
import { compareEstateOrder } from "@/lib/estate-order";

export const MASTER_TREE_TAG = "master-tree";

async function fetchMasterTreeFromDb(includeInactive: boolean, includeParts: boolean) {
  const db = getDb();
  const estateOrderBy = [
    sql`CASE WHEN ${estates.sortOrder} > 0 THEN 0 ELSE 1 END ASC`,
    asc(estates.sortOrder),
    asc(estates.code),
  ];

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
      ? db.select().from(estates).orderBy(...estateOrderBy)
      : db
          .select()
          .from(estates)
          .where(eq(estates.isActive, true))
          .orderBy(...estateOrderBy),
    includeInactive
      ? db.select().from(blocks).orderBy(asc(blocks.code))
      : db.select().from(blocks).where(eq(blocks.isActive, true)).orderBy(asc(blocks.code)),
    includeInactive
      ? db.select().from(pumpTypes).orderBy(asc(pumpTypes.name))
      : db.select().from(pumpTypes).where(eq(pumpTypes.isActive, true)).orderBy(asc(pumpTypes.name)),
    includeParts
      ? includeInactive
        ? db.select().from(pumpTypeParts).orderBy(asc(pumpTypeParts.sortOrder))
        : db
            .select()
            .from(pumpTypeParts)
            .where(eq(pumpTypeParts.isActive, true))
            .orderBy(asc(pumpTypeParts.sortOrder))
      : Promise.resolve([]),
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

  const estateById = new Map(estateRows.map((es) => [es.id, es]));
  const sortedBlocks = [...blockRows].sort((a, b) => {
    const estA = estateById.get(a.estateId);
    const estB = estateById.get(b.estateId);
    if (estA && estB) {
      const estDiff = compareEstateOrder(estA, estB);
      if (estDiff !== 0) return estDiff;
    } else if (estA !== estB) {
      return estA ? -1 : 1;
    }
    return a.code.localeCompare(b.code);
  });

  return {
    companies: companyRows,
    regions: regionRows,
    estates: estateRows,
    blocks: sortedBlocks,
    pumpTypes: pumpTypeRows,
    pumpTypeParts: partRows,
    engineBrands: engineBrandRows,
    issuePresets: issuePresetRows,
  };
}

const getCachedActiveSlim = unstable_cache(
  () => fetchMasterTreeFromDb(false, false),
  ["master-tree-active-slim"],
  { tags: [MASTER_TREE_TAG], revalidate: 300 }
);

const getCachedActiveFull = unstable_cache(
  () => fetchMasterTreeFromDb(false, true),
  ["master-tree-active-full"],
  { tags: [MASTER_TREE_TAG], revalidate: 300 }
);

const getCachedAdminFull = unstable_cache(
  () => fetchMasterTreeFromDb(true, true),
  ["master-tree-admin-full"],
  { tags: [MASTER_TREE_TAG], revalidate: 300 }
);

export async function getCachedMasterTree(options: {
  includeInactive: boolean;
  includeParts: boolean;
}) {
  if (options.includeInactive) {
    return getCachedAdminFull();
  }
  if (options.includeParts) {
    return getCachedActiveFull();
  }
  return getCachedActiveSlim();
}
