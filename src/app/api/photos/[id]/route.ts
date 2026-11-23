import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { inspectionPhotos } from "@/db/schema";
import { requireApiSession } from "@/lib/auth";
import { getStorageProvider } from "@/lib/storage";

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const auth = await requireApiSession();
  if ("error" in auth) return auth.error;

  const { id } = await context.params;
  const photoId = Number(id);
  if (!Number.isInteger(photoId) || photoId <= 0) {
    return NextResponse.json({ error: "ID foto tidak valid." }, { status: 400 });
  }

  const db = getDb();
  const [photo] = await db
    .select()
    .from(inspectionPhotos)
    .where(eq(inspectionPhotos.id, photoId))
    .limit(1);

  if (!photo) {
    return NextResponse.json({ error: "Foto tidak ditemukan." }, { status: 404 });
  }

  const etag = `"photo-${photo.id}-${photo.storageKey}"`;
  if (request.headers.get("if-none-match") === etag) {
    return new NextResponse(null, {
      status: 304,
      headers: {
        ETag: etag,
        "Cache-Control": "private, max-age=604800, immutable",
      },
    });
  }

  try {
    const provider = getStorageProvider(
      photo.storageProvider === "local" ? "local" : "gdrive"
    );
    const { buffer, mimeType } = await provider.read(photo.storageKey, photo.mimeType);

    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        "Content-Type": photo.mimeType || mimeType,
        ETag: etag,
        "Cache-Control": "private, max-age=604800, immutable",
      },
    });
  } catch (err) {
    console.error("Read photo error:", err);
    return NextResponse.json({ error: "Gagal mengambil foto dari penyimpanan." }, { status: 500 });
  }
}
