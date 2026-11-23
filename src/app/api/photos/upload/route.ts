import { NextRequest, NextResponse } from "next/server";
import { eq, sql } from "drizzle-orm";
import { getDb } from "@/db";
import { blocks, companies, estates, pumps, regions } from "@/db/schema";
import { requireApiSession } from "@/lib/auth";
import { getStorageProvider } from "@/lib/storage";
import { buildPumpFolderPath, buildPumpPhotoFileName } from "@/lib/storage/naming";

const MAX_FILE_SIZE_BYTES = 4 * 1024 * 1024;
const ALLOWED_MIME = new Set(["image/jpeg", "image/png", "image/webp"]);

export async function POST(request: NextRequest) {
  const auth = await requireApiSession();
  if ("error" in auth) return auth.error;

  try {
    const formData = await request.formData();
    const file = formData.get("file");
    const pumpId = Number(formData.get("pumpId"));
    const inspectedAt = String(formData.get("inspectedAt") ?? new Date().toISOString().slice(0, 10));
    const sequence = Number(formData.get("sequence") ?? 1) || 1;

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "File gambar wajib dilampirkan." }, { status: 400 });
    }

    if (!ALLOWED_MIME.has(file.type)) {
      return NextResponse.json(
        { error: "Format foto harus JPG, PNG, atau WebP." },
        { status: 400 }
      );
    }

    if (file.size > MAX_FILE_SIZE_BYTES) {
      return NextResponse.json(
        { error: "Ukuran foto maksimal 4 MB setelah kompresi." },
        { status: 400 }
      );
    }

    let folderPath: string[] | undefined;
    let fileName = `POMPA_${Date.now()}.jpg`;

    if (Number.isInteger(pumpId) && pumpId > 0) {
      const db = getDb();
      const [meta] = await db
        .select({
          companyCode: companies.code,
          regionCode: regions.code,
          estateCode: estates.code,
          blockCode: blocks.code,
          pumpCode: pumps.pumpCode,
        })
        .from(pumps)
        .leftJoin(blocks, eq(pumps.blockId, blocks.id))
        .leftJoin(estates, sql`COALESCE(${blocks.estateId}, ${pumps.estateId}) = ${estates.id}`)
        .leftJoin(regions, eq(estates.regionId, regions.id))
        .leftJoin(companies, eq(regions.companyId, companies.id))
        .where(eq(pumps.id, pumpId))
        .limit(1);

      if (meta) {
        const now = new Date();
        const hhmmss = `${String(now.getHours()).padStart(2, "0")}${String(
          now.getMinutes()
        ).padStart(2, "0")}${String(now.getSeconds()).padStart(2, "0")}`;

        const companyCode = meta.companyCode || "THIP";
        const regionCode = meta.regionCode || "UNASSIGNED";
        const estateCode = meta.estateCode || "UNASSIGNED";
        const blockCode = meta.blockCode || "Tanpa_Blok";

        folderPath = buildPumpFolderPath({
          companyCode,
          regionCode,
          estateCode,
          pumpCode: meta.pumpCode,
        });

        fileName = buildPumpPhotoFileName({
          estateCode,
          blockCode,
          pumpCode: meta.pumpCode,
          inspectedAt,
          sequence,
          mimeType: file.type,
          timeSuffix: hhmmss,
        });
      }
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const storage = getStorageProvider();

    const uploaded = await storage.upload({
      buffer,
      fileName,
      mimeType: file.type,
      folderPath,
    });

    return NextResponse.json({
      photo: {
        storageProvider: uploaded.storageProvider,
        storageKey: uploaded.storageKey,
        fileName,
        mimeType: file.type,
      },
    });
  } catch (err) {
    console.error("Photo upload error:", err);
    return NextResponse.json(
      { error: "Gagal mengunggah foto ke penyimpanan." },
      { status: 500 }
    );
  }
}
