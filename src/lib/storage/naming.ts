export function sanitizePathSegment(raw: string): string {
  return raw
    .trim()
    .replace(/[\\/:*?"<>|]/g, "-")
    .replace(/\s+/g, "_")
    .replace(/-+/g, "-")
    .slice(0, 64) || "UNKNOWN";
}

export function extFromMimeType(mimeType: string): string {
  if (mimeType === "image/png") return "png";
  if (mimeType === "image/webp") return "webp";
  return "jpg";
}

export function buildPumpFolderPath(params: {
  companyCode: string;
  regionCode: string;
  estateCode: string;
  pumpCode: string;
}): string[] {
  return [
    sanitizePathSegment(params.companyCode),
    sanitizePathSegment(params.regionCode),
    sanitizePathSegment(params.estateCode),
    sanitizePathSegment(params.pumpCode),
  ];
}

export function buildPumpPhotoFileName(params: {
  estateCode: string;
  blockCode: string;
  pumpCode: string;
  inspectedAt: string;
  sequence: number;
  mimeType: string;
  timeSuffix?: string;
}): string {
  const estate = sanitizePathSegment(params.estateCode);
  const block = sanitizePathSegment(params.blockCode);
  const pump = sanitizePathSegment(params.pumpCode);
  const datePart = /^\d{4}-\d{2}-\d{2}$/.test(params.inspectedAt)
    ? params.inspectedAt
    : new Date().toISOString().slice(0, 10);
  const seq = String(Math.max(1, params.sequence)).padStart(2, "0");
  const ext = extFromMimeType(params.mimeType);
  const time = params.timeSuffix ? `_${sanitizePathSegment(params.timeSuffix)}` : "";
  return `${estate}_${block}_${pump}_${datePart}${time}_${seq}.${ext}`;
}
