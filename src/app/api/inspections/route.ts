import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { getTxDb } from "@/db";
import {
  blocks,
  inspectionItems,
  inspectionPhotos,
  inspections,
  pumpOperatingLogs,
  pumps,
} from "@/db/schema";
import { requireApiSession } from "@/lib/auth";
import { isPumpLocationAssigned } from "@/lib/pump-location";

const createInspectionSchema = z.object({
  pumpId: z.number().int().positive(),
  inspectedAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Format tanggal YYYY-MM-DD."),
  unitStatus: z.enum(["aktif", "perlu_perbaikan", "rusak_total"]),
  notes: z.string().max(500).nullable().optional(),
  operatingHours: z
    .number()
    .min(0, "Jam kerja minimal 0.")
    .max(24, "Jam kerja maksimal 24 jam/hari.")
    .nullable()
    .optional(),
  operationalNote: z.string().max(240).nullable().optional(),
  operationalCategory: z
    .enum(["none", "tbm", "pasang_surut", "wsc_selesai", "discharge", "rusak_po"])
    .optional(),
  repairStatus: z.string().max(120).nullable().optional(),
  isPreOrder: z.boolean().optional(),
  items: z
    .array(
      z.object({
        partId: z.number().int().positive().nullable().optional(),
        sectionCode: z.string().min(1).max(10),
        sectionName: z.string().min(1).max(80),
        itemNo: z.number().int().min(0),
        partName: z.string().min(1).max(160),
        expectedQty: z.number().int().min(1),
        availability: z.enum(["ada", "tidak_lengkap", "hilang"]),
        condition: z.enum(["baik", "rusak"]),
        issuePresetId: z.number().int().positive().nullable().optional(),
        notes: z.string().max(240).nullable().optional(),
        sortOrder: z.number().int().min(0),
      })
    )
    .min(1, "Minimal 1 item pemeriksaan wajib diisi."),
  photos: z
    .array(
      z.object({
        storageProvider: z.enum(["gdrive", "local"]),
        storageKey: z.string().min(1),
        fileName: z.string().min(1),
        mimeType: z.string().min(1),
        caption: z.string().max(160).nullable().optional(),
      })
    )
    .optional(),
});

export async function POST(request: NextRequest) {
  const auth = await requireApiSession();
  if ("error" in auth) return auth.error;

  const body = await request.json();
  const parsed = createInspectionSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Data pemeriksaan tidak valid." },
      { status: 400 }
    );
  }

  const db = getTxDb();
  const data = parsed.data;

  try {
    const created = await db.transaction(async (tx) => {
      const [pump] = await tx
        .select({
          id: pumps.id,
          pumpCode: pumps.pumpCode,
          blockId: pumps.blockId,
          blockCode: blocks.code,
          currentUnitStatus: pumps.currentUnitStatus,
          breakdownStartDate: pumps.breakdownStartDate,
        })
        .from(pumps)
        .leftJoin(blocks, eq(pumps.blockId, blocks.id))
        .where(eq(pumps.id, data.pumpId))
        .limit(1);

      if (!pump) {
        throw new Error("PUMP_NOT_FOUND");
      }

      if (
        data.operatingHours !== null &&
        data.operatingHours !== undefined &&
        data.operatingHours > 0 &&
        !isPumpLocationAssigned({ blockId: pump.blockId, blockCode: pump.blockCode })
      ) {
        throw new Error(`LOCATION_REQUIRED:${pump.pumpCode}`);
      }

      const [inspection] = await tx
        .insert(inspections)
        .values({
          pumpId: data.pumpId,
          inspectorId: auth.user.userId,
          inspectorName: auth.user.name,
          inspectedAt: data.inspectedAt,
          unitStatus: data.unitStatus,
          notes: data.notes?.trim() || null,
          source: "manual",
        })
        .returning();

      await tx.insert(inspectionItems).values(
        data.items.map((item) => ({
          inspectionId: inspection.id,
          partId: item.partId ?? null,
          sectionCode: item.sectionCode,
          sectionName: item.sectionName,
          itemNo: item.itemNo,
          partName: item.partName,
          expectedQty: item.expectedQty,
          availability: item.availability,
          condition: item.condition,
          issuePresetId: item.issuePresetId ?? null,
          notes: item.notes?.trim() || null,
          sortOrder: item.sortOrder,
        }))
      );

      if (data.photos && data.photos.length > 0) {
        await tx.insert(inspectionPhotos).values(
          data.photos.map((photo) => ({
            inspectionId: inspection.id,
            storageProvider: photo.storageProvider,
            storageKey: photo.storageKey,
            fileName: photo.fileName,
            mimeType: photo.mimeType,
            caption: photo.caption?.trim() || null,
          }))
        );
      }

      const pumpUpdates: Record<string, unknown> = {
        currentUnitStatus: data.unitStatus,
        lastInspectedAt: new Date(`${data.inspectedAt}T08:00:00Z`),
      };

      if (data.unitStatus === "aktif") {
        pumpUpdates.breakdownStartDate = null;
        if (data.isPreOrder === undefined) {
          pumpUpdates.isPreOrder = false;
        }
      } else if (!pump.breakdownStartDate) {
        pumpUpdates.breakdownStartDate = data.inspectedAt;
      }

      if (data.operationalNote !== undefined) {
        pumpUpdates.operationalNote = data.operationalNote?.trim() || null;
      }
      if (data.operationalCategory !== undefined) {
        pumpUpdates.operationalCategory = data.operationalCategory;
      }
      if (data.repairStatus !== undefined) {
        pumpUpdates.repairStatus = data.repairStatus?.trim() || null;
      }
      if (data.isPreOrder !== undefined) {
        pumpUpdates.isPreOrder = data.isPreOrder;
      }

      await tx.update(pumps).set(pumpUpdates).where(eq(pumps.id, data.pumpId));

      if (data.operatingHours !== null && data.operatingHours !== undefined && data.operatingHours > 0) {
        const hrsStr = (Math.round(data.operatingHours * 100) / 100).toFixed(2);
        await tx
          .insert(pumpOperatingLogs)
          .values({
            pumpId: data.pumpId,
            logDate: data.inspectedAt,
            operatingHours: hrsStr,
            dayStatus: "operasi",
            notes: data.notes?.trim() || null,
            recordedById: auth.user.userId,
            recordedByName: auth.user.name,
            updatedAt: new Date(),
          })
          .onConflictDoUpdate({
            target: [pumpOperatingLogs.pumpId, pumpOperatingLogs.logDate],
            set: {
              operatingHours: hrsStr,
              dayStatus: "operasi",
              notes: data.notes?.trim() || null,
              recordedById: auth.user.userId,
              recordedByName: auth.user.name,
              updatedAt: new Date(),
            },
          });
      }

      return inspection;
    });

    return NextResponse.json({ inspection: created }, { status: 201 });
  } catch (err) {
    if (err instanceof Error && err.message === "PUMP_NOT_FOUND") {
      return NextResponse.json({ error: "Pompa tidak ditemukan." }, { status: 404 });
    }
    if (err instanceof Error && err.message.startsWith("LOCATION_REQUIRED:")) {
      const code = err.message.split(":")[1] || "";
      return NextResponse.json(
        {
          error: `Pompa ${code} belum di-assign ke blok lokasi lapangan sehingga jam kerja belum dapat diinput.`,
        },
        { status: 400 }
      );
    }
    console.error("Create inspection error:", err);
    return NextResponse.json({ error: "Gagal menyimpan pemeriksaan." }, { status: 500 });
  }
}
