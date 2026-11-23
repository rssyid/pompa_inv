import { eq, and } from "drizzle-orm";
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
  pumpTypeParts,
  pumpTypes,
  regions,
} from "@/db/schema";
import { DEFAULT_ISSUE_PRESETS } from "./excel/normalizer";
import { ParsedPumpRecord } from "./excel/parser";
import { getStorageProvider } from "./storage";
import { buildPumpFolderPath, buildPumpPhotoFileName } from "./storage/naming";

export interface ImportSummary {
  pumpsCreated: number;
  pumpsSkippedDuplicate: number;
  inspectionsCreated: number;
  photosUploaded: number;
  blocksCreated: number;
}

async function uploadAndSavePumpPhotos(params: {
  inspectionId: number;
  companyCode: string;
  rec: ParsedPumpRecord;
  inspectedAt: string;
  storage: ReturnType<typeof getStorageProvider>;
}): Promise<number> {
  const db = getDb();
  const folderPath = buildPumpFolderPath({
    companyCode: params.companyCode,
    regionCode: params.rec.regionCode,
    estateCode: params.rec.estateCode,
    pumpCode: params.rec.pumpCode,
  });

  let uploadedCount = 0;
  for (let i = 0; i < params.rec.photos.length; i++) {
    const photo = params.rec.photos[i];
    const renamedFile = buildPumpPhotoFileName({
      estateCode: params.rec.estateCode,
      blockCode: params.rec.blockCode,
      pumpCode: params.rec.pumpCode,
      inspectedAt: params.inspectedAt,
      sequence: i + 1,
      mimeType: photo.mimeType,
    });

    const uploaded = await params.storage.upload({
      buffer: photo.buffer,
      fileName: renamedFile,
      mimeType: photo.mimeType,
      folderPath,
    });

    await db.insert(inspectionPhotos).values({
      inspectionId: params.inspectionId,
      storageProvider: uploaded.storageProvider,
      storageKey: uploaded.storageKey,
      fileName: renamedFile,
      mimeType: photo.mimeType,
      caption: `Dokumentasi ${params.rec.pumpCode} #${i + 1}`,
    });
    uploadedCount += 1;
  }
  return uploadedCount;
}

export async function ensureBasePresets() {
  const db = getDb();
  for (const preset of DEFAULT_ISSUE_PRESETS) {
    await db
      .insert(issuePresets)
      .values(preset)
      .onConflictDoNothing({ target: issuePresets.label });
  }
}

export async function importParsedPumpRecords(params: {
  records: ParsedPumpRecord[];
  companyCode?: string;
  companyName?: string;
  inspectorId: number | null;
  inspectorName: string;
  inspectedAt?: string;
  source?: "excel_import" | "manual";
  skipExistingPumps?: boolean;
}): Promise<ImportSummary> {
  const db = getDb();
  const storage = getStorageProvider();
  const companyCode = params.companyCode ?? "THIP";
  const companyName = params.companyName ?? "PT TH Indoplantation";
  const inspectedAt = params.inspectedAt ?? new Date().toISOString().slice(0, 10);

  await ensureBasePresets();

  // Ensure root PT exists
  await db
    .insert(companies)
    .values({ code: companyCode, name: companyName })
    .onConflictDoNothing({ target: companies.code });

  const [company] = await db
    .select()
    .from(companies)
    .where(eq(companies.code, companyCode))
    .limit(1);

  if (!company) {
    throw new Error("Gagal membuat atau membaca master PT.");
  }

  const allPresets = await db.select().from(issuePresets);
  const presetByLabel = new Map(allPresets.map((p) => [p.label.toLowerCase(), p.id]));

  const summary: ImportSummary = {
    pumpsCreated: 0,
    pumpsSkippedDuplicate: 0,
    inspectionsCreated: 0,
    photosUploaded: 0,
    blocksCreated: 0,
  };

  for (const rec of params.records) {
    // 1. Region
    await db
      .insert(regions)
      .values({ companyId: company.id, code: rec.regionCode, name: rec.regionName })
      .onConflictDoNothing();
    const [region] = await db
      .select()
      .from(regions)
      .where(and(eq(regions.companyId, company.id), eq(regions.code, rec.regionCode)))
      .limit(1);

    // 2. Estate
    await db
      .insert(estates)
      .values({ regionId: region.id, code: rec.estateCode, name: rec.estateCode })
      .onConflictDoNothing();
    const [estate] = await db
      .select()
      .from(estates)
      .where(and(eq(estates.regionId, region.id), eq(estates.code, rec.estateCode)))
      .limit(1);

    // 3. Block
    const existingBlocks = await db
      .select()
      .from(blocks)
      .where(and(eq(blocks.estateId, estate.id), eq(blocks.code, rec.blockCode)))
      .limit(1);

    let block = existingBlocks[0];
    if (!block) {
      const [insertedBlock] = await db
        .insert(blocks)
        .values({ estateId: estate.id, code: rec.blockCode, name: rec.blockCode })
        .returning();
      block = insertedBlock;
      summary.blocksCreated += 1;
    }

    // 4. Pump Type & its template parts
    await db
      .insert(pumpTypes)
      .values({ code: rec.pumpTypeCode, name: rec.pumpTypeName })
      .onConflictDoNothing({ target: pumpTypes.code });
    const [pumpType] = await db
      .select()
      .from(pumpTypes)
      .where(eq(pumpTypes.code, rec.pumpTypeCode))
      .limit(1);

    const existingTemplateParts = await db
      .select()
      .from(pumpTypeParts)
      .where(eq(pumpTypeParts.pumpTypeId, pumpType.id));

    if (existingTemplateParts.length === 0 && rec.parts.length > 0) {
      await db.insert(pumpTypeParts).values(
        rec.parts.map((part) => ({
          pumpTypeId: pumpType.id,
          sectionCode: part.sectionCode,
          sectionName: part.sectionName,
          itemNo: part.itemNo,
          partName: part.partName,
          defaultQty: part.expectedQty,
          sortOrder: part.sortOrder,
        }))
      );
    }

    const templateParts = await db
      .select()
      .from(pumpTypeParts)
      .where(eq(pumpTypeParts.pumpTypeId, pumpType.id));

    const templatePartMap = new Map(
      templateParts.map((tp) => [`${tp.sectionCode}:${tp.itemNo}:${tp.partName.toLowerCase()}`, tp.id])
    );

    // 5. Engine Brand
    await db
      .insert(engineBrands)
      .values({ name: rec.engineBrand })
      .onConflictDoNothing({ target: engineBrands.name });
    const [engineBrand] = await db
      .select()
      .from(engineBrands)
      .where(eq(engineBrands.name, rec.engineBrand))
      .limit(1);

    // 6. Pump (deduplicated by pumpCode)
    const [existingPump] = await db
      .select()
      .from(pumps)
      .where(eq(pumps.pumpCode, rec.pumpCode))
      .limit(1);

    let pump = existingPump;
    if (pump && params.skipExistingPumps) {
      // Recover missing parts or photos if an earlier seed run skipped/failed partway.
      const [latestInsp] = await db
        .select({ id: inspections.id })
        .from(inspections)
        .where(eq(inspections.pumpId, pump.id))
        .limit(1);

      if (latestInsp) {
        if (rec.parts.length > 0) {
          const existingItemRows = await db
            .select({ id: inspectionItems.id })
            .from(inspectionItems)
            .where(eq(inspectionItems.inspectionId, latestInsp.id))
            .limit(1);

          if (existingItemRows.length === 0) {
            await db.insert(inspectionItems).values(
              rec.parts.map((part) => ({
                inspectionId: latestInsp.id,
                partId:
                  templatePartMap.get(
                    `${part.sectionCode}:${part.itemNo}:${part.partName.toLowerCase()}`
                  ) ?? null,
                sectionCode: part.sectionCode,
                sectionName: part.sectionName,
                itemNo: part.itemNo,
                partName: part.partName,
                expectedQty: part.expectedQty,
                availability: part.availability,
                condition: part.condition,
                issuePresetId: presetByLabel.get(part.issuePresetLabel.toLowerCase()) ?? null,
                notes: part.notes,
                sortOrder: part.sortOrder,
              }))
            );
            await db
              .update(inspections)
              .set({ unitStatus: rec.unitStatus })
              .where(eq(inspections.id, latestInsp.id));
            await db
              .update(pumps)
              .set({ currentUnitStatus: rec.unitStatus })
              .where(eq(pumps.id, pump.id));
          }
        }

        if (rec.photos.length > 0) {
          const existingPhotoRows = await db
            .select({ id: inspectionPhotos.id })
            .from(inspectionPhotos)
            .where(eq(inspectionPhotos.inspectionId, latestInsp.id))
            .limit(1);

          if (existingPhotoRows.length === 0) {
            summary.photosUploaded += await uploadAndSavePumpPhotos({
              inspectionId: latestInsp.id,
              companyCode,
              rec,
              inspectedAt,
              storage,
            });
          }
        }
      }
      summary.pumpsSkippedDuplicate += 1;
      continue;
    }

    if (!pump) {
      const [insertedPump] = await db
        .insert(pumps)
        .values({
          pumpCode: rec.pumpCode,
          estateId: estate.id,
          blockId: block.id,
          pumpTypeId: pumpType.id,
          engineBrandId: engineBrand.id,
          currentUnitStatus: rec.unitStatus,
          lastInspectedAt: new Date(inspectedAt),
          breakdownStartDate: rec.unitStatus === "aktif" ? null : inspectedAt,
        })
        .returning();
      pump = insertedPump;
      summary.pumpsCreated += 1;
    } else {
      await db
        .update(pumps)
        .set({
          currentUnitStatus: rec.unitStatus,
          lastInspectedAt: new Date(inspectedAt),
        })
        .where(eq(pumps.id, pump.id));
    }

    // 7. Create inspection baseline record
    const [inspection] = await db
      .insert(inspections)
      .values({
        pumpId: pump.id,
        inspectorId: params.inspectorId,
        inspectorName: params.inspectorName,
        inspectedAt,
        unitStatus: rec.unitStatus,
        notes: `Import Excel (${rec.sheetName})`,
        source: params.source ?? "excel_import",
      })
      .returning();

    summary.inspectionsCreated += 1;

    if (rec.parts.length > 0) {
      await db.insert(inspectionItems).values(
        rec.parts.map((part) => ({
          inspectionId: inspection.id,
          partId:
            templatePartMap.get(
              `${part.sectionCode}:${part.itemNo}:${part.partName.toLowerCase()}`
            ) ?? null,
          sectionCode: part.sectionCode,
          sectionName: part.sectionName,
          itemNo: part.itemNo,
          partName: part.partName,
          expectedQty: part.expectedQty,
          availability: part.availability,
          condition: part.condition,
          issuePresetId: presetByLabel.get(part.issuePresetLabel.toLowerCase()) ?? null,
          notes: part.notes,
          sortOrder: part.sortOrder,
        }))
      );
    }

    // 8. Upload photos to active storage provider (Google Drive subfolders or local)
    summary.photosUploaded += await uploadAndSavePumpPhotos({
      inspectionId: inspection.id,
      companyCode,
      rec,
      inspectedAt,
      storage,
    });
  }

  return summary;
}
