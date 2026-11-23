import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { getTxDb } from "@/db";
import {
  inspectionItems,
  inspectionPhotos,
  inspections,
  pumps,
} from "@/db/schema";
import { requireApiSession } from "@/lib/auth";

const createInspectionSchema = z.object({
  pumpId: z.number().int().positive(),
  inspectedAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Format tanggal YYYY-MM-DD."),
  unitStatus: z.enum(["aktif", "perlu_perbaikan", "rusak_total"]),
  notes: z.string().max(500).nullable().optional(),
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
        .select({ id: pumps.id })
        .from(pumps)
        .where(eq(pumps.id, data.pumpId))
        .limit(1);

      if (!pump) {
        throw new Error("PUMP_NOT_FOUND");
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

      await tx
        .update(pumps)
        .set({
          currentUnitStatus: data.unitStatus,
          lastInspectedAt: new Date(`${data.inspectedAt}T08:00:00Z`),
        })
        .where(eq(pumps.id, data.pumpId));

      return inspection;
    });

    return NextResponse.json({ inspection: created }, { status: 201 });
  } catch (err) {
    if (err instanceof Error && err.message === "PUMP_NOT_FOUND") {
      return NextResponse.json({ error: "Pompa tidak ditemukan." }, { status: 404 });
    }
    console.error("Create inspection error:", err);
    return NextResponse.json({ error: "Gagal menyimpan pemeriksaan." }, { status: 500 });
  }
}
