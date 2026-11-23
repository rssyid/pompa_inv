import { NextRequest, NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { getTxDb } from "@/db";
import { blocks, estates, pumps } from "@/db/schema";
import { requireApiSession } from "@/lib/auth";
import { MASTER_TREE_TAG } from "@/lib/queries/master";

const operationalPatchSchema = z.object({
  estateId: z.number().int().positive().nullable().optional(),
  blockId: z.number().int().positive().nullable().optional(),
  newBlockCode: z.string().trim().max(40).nullable().optional(),
  clearLocation: z.boolean().optional(),
  operationalNote: z.string().max(240).nullable().optional(),
  operationalCategory: z
    .enum(["none", "tbm", "pasang_surut", "wsc_selesai", "discharge", "rusak_po"])
    .optional(),
  repairStatus: z.string().max(120).nullable().optional(),
  isPreOrder: z.boolean().optional(),
  breakdownStartDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .nullable()
    .optional(),
});

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const auth = await requireApiSession();
  if ("error" in auth) return auth.error;

  const { id } = await context.params;
  const pumpId = Number(id);
  if (!Number.isInteger(pumpId) || pumpId <= 0) {
    return NextResponse.json({ error: "ID pompa tidak valid." }, { status: 400 });
  }

  const body = await request.json();
  const parsed = operationalPatchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Data pembaruan lokasi/operasional tidak valid." },
      { status: 400 }
    );
  }

  const data = parsed.data;
  const db = getTxDb();

  try {
    const result = await db.transaction(async (tx) => {
      const [existing] = await tx
        .select({
          id: pumps.id,
          estateId: pumps.estateId,
          blockId: pumps.blockId,
        })
        .from(pumps)
        .where(eq(pumps.id, pumpId))
        .limit(1);

      if (!existing) {
        throw new Error("PUMP_NOT_FOUND");
      }

      const updates: Record<string, unknown> = {};
      let createdBlock = false;

      if (data.clearLocation) {
        if (data.estateId !== undefined) updates.estateId = data.estateId;
        updates.blockId = null;
        updates.locationUpdatedAt = new Date();
      } else if (data.newBlockCode && data.newBlockCode.trim().length > 0) {
        const targetEstateId = data.estateId ?? existing.estateId;
        if (!targetEstateId) {
          throw new Error("ESTATE_REQUIRED");
        }

        const [est] = await tx
          .select({ id: estates.id })
          .from(estates)
          .where(eq(estates.id, targetEstateId))
          .limit(1);
        if (!est) {
          throw new Error("ESTATE_NOT_FOUND");
        }

        const cleanCode = data.newBlockCode.trim();
        const [foundBlock] = await tx
          .select({ id: blocks.id })
          .from(blocks)
          .where(and(eq(blocks.estateId, targetEstateId), eq(blocks.code, cleanCode)))
          .limit(1);

        let resolvedBlockId: number;
        if (foundBlock) {
          resolvedBlockId = foundBlock.id;
        } else {
          const [insertedBlock] = await tx
            .insert(blocks)
            .values({
              estateId: targetEstateId,
              code: cleanCode,
              name: cleanCode,
            })
            .returning();
          resolvedBlockId = insertedBlock.id;
          createdBlock = true;
        }

        updates.estateId = targetEstateId;
        updates.blockId = resolvedBlockId;
        updates.locationUpdatedAt = new Date();
      } else if (data.blockId !== undefined) {
        if (data.blockId === null) {
          updates.blockId = null;
          if (data.estateId !== undefined) updates.estateId = data.estateId;
        } else {
          const [blk] = await tx
            .select({ id: blocks.id, estateId: blocks.estateId })
            .from(blocks)
            .where(eq(blocks.id, data.blockId))
            .limit(1);
          if (!blk) {
            throw new Error("BLOCK_NOT_FOUND");
          }
          updates.blockId = blk.id;
          updates.estateId = blk.estateId;
        }
        updates.locationUpdatedAt = new Date();
      } else if (data.estateId !== undefined) {
        updates.estateId = data.estateId;
        updates.locationUpdatedAt = new Date();
      }

      if (data.operationalNote !== undefined) {
        updates.operationalNote = data.operationalNote?.trim() || null;
      }
      if (data.operationalCategory !== undefined) {
        updates.operationalCategory = data.operationalCategory;
      }
      if (data.repairStatus !== undefined) {
        updates.repairStatus = data.repairStatus?.trim() || null;
      }
      if (data.isPreOrder !== undefined) {
        updates.isPreOrder = data.isPreOrder;
      }
      if (data.breakdownStartDate !== undefined) {
        updates.breakdownStartDate = data.breakdownStartDate;
      }

      if (Object.keys(updates).length === 0) {
        return { pump: existing, createdBlock: false };
      }

      const [updated] = await tx
        .update(pumps)
        .set(updates)
        .where(eq(pumps.id, pumpId))
        .returning();

      return { pump: updated, createdBlock };
    });

    if (result.createdBlock) {
      revalidateTag(MASTER_TREE_TAG);
    }

    return NextResponse.json({
      pump: result.pump,
      createdBlock: result.createdBlock,
    });
  } catch (err) {
    if (err instanceof Error) {
      if (err.message === "PUMP_NOT_FOUND") {
        return NextResponse.json({ error: "Pompa tidak ditemukan." }, { status: 404 });
      }
      if (err.message === "ESTATE_REQUIRED") {
        return NextResponse.json(
          { error: "Pilih Estate terlebih dahulu sebelum membuat kode blok baru." },
          { status: 400 }
        );
      }
      if (err.message === "ESTATE_NOT_FOUND" || err.message === "BLOCK_NOT_FOUND") {
        return NextResponse.json({ error: "Estate atau Blok tidak ditemukan." }, { status: 404 });
      }
    }
    console.error("Update pump operational error:", err);
    return NextResponse.json(
      { error: "Gagal memperbarui lokasi atau status operasional pompa." },
      { status: 500 }
    );
  }
}
