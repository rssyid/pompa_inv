export type OperationalCategory =
  | "none"
  | "tbm"
  | "pasang_surut"
  | "wsc_selesai"
  | "discharge"
  | "rusak_po";

export const OPERATIONAL_CATEGORY_OPTIONS: Array<{
  value: OperationalCategory;
  label: string;
  bgClass: string;
  borderClass: string;
  textClass: string;
  excelFillArgb: string | null;
}> = [
  {
    value: "none",
    label: "Standar / Tanpa Warna",
    bgClass: "bg-white",
    borderClass: "border-field-border",
    textClass: "text-field-ink",
    excelFillArgb: null,
  },
  {
    value: "tbm",
    label: "Rawan Banjir (TBM)",
    bgClass: "bg-[#DCFCE7]",
    borderClass: "border-[#86EFAC]",
    textClass: "text-[#166534]",
    excelFillArgb: "FF92D050",
  },
  {
    value: "pasang_surut",
    label: "Rawan Banjir (Pasang Surut)",
    bgClass: "bg-[#E0F2FE]",
    borderClass: "border-[#7DD3FC]",
    textClass: "text-[#075985]",
    excelFillArgb: "FF8DB4E2",
  },
  {
    value: "wsc_selesai",
    label: "Perbaikan Selesai (WSC)",
    bgClass: "bg-[#CCFBF1]",
    borderClass: "border-[#5EEAD4]",
    textClass: "text-[#115E59]",
    excelFillArgb: "FFB7DEE8",
  },
  {
    value: "discharge",
    label: "Discharge Pumping",
    bgClass: "bg-[#FEF3C7]",
    borderClass: "border-[#FCD34D]",
    textClass: "text-[#92400E]",
    excelFillArgb: "FFFFC000",
  },
  {
    value: "rusak_po",
    label: "Rusak / Pre-Order (PO)",
    bgClass: "bg-[#FEE2E2]",
    borderClass: "border-[#FCA5A5]",
    textClass: "text-[#991B1B]",
    excelFillArgb: null,
  },
];

export const OPERATIONAL_NOTE_PRESETS: Array<{
  note: string;
  category: OperationalCategory;
}> = [
  { note: "Aktif, lokasi rawan banjir (TBM)", category: "tbm" },
  { note: "Standby, lokasi rawan banjir (TBM)", category: "tbm" },
  { note: "Aktif, lokasi rawan banjir (pasang surut)", category: "pasang_surut" },
  { note: "Standby, lokasi rawan banjir (pasang surut)", category: "pasang_surut" },
  { note: "Standby perbaikan selesai, di WSC KPP", category: "wsc_selesai" },
  { note: "Standby, (Discharge pumping)", category: "discharge" },
  { note: "PRE-ORDER (PO)", category: "rusak_po" },
];

export function isWorkshopBlockCode(blockCode: string | null | undefined): boolean {
  if (!blockCode) return false;
  const code = blockCode.trim().toLowerCase();
  return code.startsWith("wsc") || code.includes("workshop");
}

export function isUnassignedBlockCode(blockCode: string | null | undefined): boolean {
  if (!blockCode) return true;
  const code = blockCode.trim().toLowerCase();
  return (
    code === "" ||
    code === "-" ||
    code === "tanpa blok" ||
    code === "belum ditempatkan" ||
    code === "belum assign"
  );
}

/**
 * Only pumps assigned to an operational field block (not null, not "Tanpa Blok",
 * and not parked in Workshop/WSC) may accept daily operating hour entries.
 */
export function isPumpLocationAssigned(pump: {
  blockId: number | null | undefined;
  blockCode: string | null | undefined;
}): boolean {
  if (!pump.blockId) return false;
  if (isUnassignedBlockCode(pump.blockCode)) return false;
  if (isWorkshopBlockCode(pump.blockCode)) return false;
  return true;
}

export function getPumpLocationBadgeInfo(pump: {
  blockId: number | null | undefined;
  blockCode: string | null | undefined;
  estateCode?: string | null | undefined;
}): {
  assigned: boolean;
  label: string;
  tone: "ok" | "workshop" | "unassigned";
} {
  if (!pump.blockId || isUnassignedBlockCode(pump.blockCode)) {
    return {
      assigned: false,
      label: "Belum Assign Lokasi",
      tone: "unassigned",
    };
  }
  if (isWorkshopBlockCode(pump.blockCode)) {
    return {
      assigned: false,
      label: `Workshop (${pump.blockCode})`,
      tone: "workshop",
    };
  }
  return {
    assigned: true,
    label: pump.estateCode ? `${pump.estateCode} / ${pump.blockCode}` : String(pump.blockCode),
    tone: "ok",
  };
}
