export type AvailabilityStatus = "ada" | "tidak_lengkap" | "hilang";
export type ConditionStatus = "baik" | "rusak";
export type UnitStatus = "aktif" | "perlu_perbaikan" | "rusak_total";

export interface IssuePresetSeed {
  label: string;
  defaultAvailability: AvailabilityStatus;
  defaultCondition: ConditionStatus;
  sortOrder: number;
}

export const DEFAULT_ISSUE_PRESETS: IssuePresetSeed[] = [
  { label: "Normal / Baik", defaultAvailability: "ada", defaultCondition: "baik", sortOrder: 1 },
  { label: "Hilang", defaultAvailability: "hilang", defaultCondition: "rusak", sortOrder: 2 },
  { label: "Bocor", defaultAvailability: "ada", defaultCondition: "rusak", sortOrder: 3 },
  { label: "Patah / Putus", defaultAvailability: "ada", defaultCondition: "rusak", sortOrder: 4 },
  { label: "Soak / Lemah", defaultAvailability: "ada", defaultCondition: "rusak", sortOrder: 5 },
  { label: "Tidak Lengkap", defaultAvailability: "tidak_lengkap", defaultCondition: "rusak", sortOrder: 6 },
  { label: "Tidak Center / Centring", defaultAvailability: "ada", defaultCondition: "rusak", sortOrder: 7 },
  { label: "Tidak Dipasang / Modif", defaultAvailability: "tidak_lengkap", defaultCondition: "rusak", sortOrder: 8 },
  { label: "Perlu Perbaikan", defaultAvailability: "ada", defaultCondition: "rusak", sortOrder: 9 },
  { label: "Perlu Ganti", defaultAvailability: "ada", defaultCondition: "rusak", sortOrder: 10 },
  { label: "Overhaul di Workshop", defaultAvailability: "ada", defaultCondition: "rusak", sortOrder: 11 },
  { label: "Dipindah ke Workshop", defaultAvailability: "tidak_lengkap", defaultCondition: "baik", sortOrder: 12 },
];

export function normalizePumpType(title: string): { code: string; name: string } {
  const lower = title.toLowerCase();
  if (lower.includes("triple")) return { code: "axial_triple", name: "Axial Triple" };
  if (lower.includes("double")) return { code: "axial_double", name: "Axial Double" };
  if (lower.includes("ebara")) return { code: "ebara", name: "Ebara" };
  return { code: "axial_single", name: "Axial Single" };
}

export function normalizeEngineBrand(raw: string): string {
  const s = raw.toLowerCase();
  if (s.includes("mitsubishi") || s.includes("mitsubshi")) {
    if (s.includes("ebara")) return "Mitsubishi (Ebara)";
    return "Mitsubishi";
  }
  if (s.includes("ebara")) return "Ebara";
  if (s.includes("donfeng") || s.includes("dong feng")) return "Donfeng";
  return raw.replace(/^mesin\s+/i, "").trim() || "Donfeng";
}

export function normalizeRegionCodeAndName(rawRegion: string): { code: string; name: string } {
  const compact = rawRegion.toLowerCase().replace(/\s+/g, "");
  if (compact.includes("wil1") || compact.includes("w1")) {
    return { code: "R1-W1", name: "Region 1 / Wilayah 1" };
  }
  return { code: "R1-W2", name: "Region 1 / Wilayah 2" };
}

export function normalizeBlockCode(rawBlock: string): string {
  return rawBlock.replace(/^:+/, "").trim() || "Tanpa Blok";
}

export function normalizePumpCode(rawCode: string): string {
  return rawCode.replace(/^:+/, "").replace(/\s+/g, " ").trim();
}

export function inferItemCondition(params: {
  checkedAda: boolean;
  checkedTidakAda: boolean;
  rawKondisi: string;
  rawCatatan: string;
}): {
  availability: AvailabilityStatus;
  condition: ConditionStatus;
  issuePresetLabel: string;
  notes: string | null;
} {
  const kondisi = params.rawKondisi.trim();
  const catatan = params.rawCatatan.trim();
  const combined = `${kondisi} ${catatan}`.toLowerCase();

  let availability: AvailabilityStatus = "ada";
  let condition: ConditionStatus = "baik";
  let issuePresetLabel = "Normal / Baik";

  if (
    params.checkedTidakAda ||
    combined.includes("hilang") ||
    combined.includes("tidak ada") ||
    combined.includes("tidak pakai") ||
    combined.includes("tdk pakai")
  ) {
    availability = "hilang";
    condition = "rusak";
    issuePresetLabel = "Hilang";
  } else if (
    combined.includes("tdk lengkap") ||
    combined.includes("tidak lengkap") ||
    combined.includes("cuman") ||
    combined.includes("hanya ") ||
    combined.includes("sebagian") ||
    combined.includes("1 bagus")
  ) {
    availability = "tidak_lengkap";
    condition = "rusak";
    issuePresetLabel = "Tidak Lengkap";
  } else if (
    combined.includes("tidak dipasang") ||
    combined.includes("modif") ||
    combined.includes("tidak cocok")
  ) {
    availability = "tidak_lengkap";
    condition = "rusak";
    issuePresetLabel = "Tidak Dipasang / Modif";
  } else if (combined.includes("bocor")) {
    condition = "rusak";
    issuePresetLabel = "Bocor";
  } else if (combined.includes("patah") || combined.includes("putus") || combined.includes("sompel") || combined.includes("lepas")) {
    condition = "rusak";
    issuePresetLabel = "Patah / Putus";
  } else if (combined.includes("soak")) {
    condition = "rusak";
    issuePresetLabel = "Soak / Lemah";
  } else if (combined.includes("centring") || combined.includes("center")) {
    condition = "rusak";
    issuePresetLabel = "Tidak Center / Centring";
  } else if (combined.includes("overhoul") || combined.includes("overhaul")) {
    condition = "rusak";
    issuePresetLabel = "Overhaul di Workshop";
  } else if (combined.includes("dipindah")) {
    availability = "tidak_lengkap";
    condition = "baik";
    issuePresetLabel = "Dipindah ke Workshop";
  } else if (combined.includes("perlu ganti")) {
    condition = "rusak";
    issuePresetLabel = "Perlu Ganti";
  } else if (combined.includes("rusak") || combined.includes("perlu perbaikan")) {
    condition = "rusak";
    issuePresetLabel = "Perlu Perbaikan";
  } else if (params.checkedAda || combined.includes("baik") || combined.includes("aktif") || combined.includes("aktiv") || combined.includes("sederhana")) {
    availability = "ada";
    condition = "baik";
    issuePresetLabel = "Normal / Baik";
  }

  const rawDetail = [kondisi, catatan]
    .filter((v) => v && v !== "#VALUE!")
    .join(" - ")
    .trim();

  const detailLower = rawDetail.toLowerCase();
  const isRedundantDetail =
    !rawDetail ||
    detailLower === "baik" ||
    detailLower === "rusak" ||
    detailLower === "hilang" ||
    detailLower === "bocor" ||
    detailLower === "perlu perbaikan";

  return {
    availability,
    condition,
    issuePresetLabel,
    notes: isRedundantDetail ? null : rawDetail,
  };
}

export function inferUnitStatus(
  items: Array<{
    sectionCode: string;
    sectionName: string;
    itemNo: number;
    availability: AvailabilityStatus;
    condition: ConditionStatus;
    notes: string | null;
  }>
): UnitStatus {
  const machineHeader = items.find(
    (item) => item.itemNo === 0 && item.sectionName.toUpperCase().includes("MESIN")
  );
  const hasExplicitActiveNote =
    machineHeader?.notes?.toLowerCase().includes("beroprasi") ||
    machineHeader?.notes?.toLowerCase().includes("beroperasi");

  const brokenOrMissingCount = items.filter(
    (item) => item.itemNo > 0 && (item.availability !== "ada" || item.condition === "rusak")
  ).length;
  const totalParts = items.filter((item) => item.itemNo > 0).length;

  if (machineHeader && machineHeader.condition === "rusak" && !hasExplicitActiveNote) {
    return "rusak_total";
  }
  if (totalParts > 0 && brokenOrMissingCount >= Math.ceil(totalParts * 0.5) && !hasExplicitActiveNote) {
    return "rusak_total";
  }
  if (brokenOrMissingCount > 0) {
    return "perlu_perbaikan";
  }
  return "aktif";
}
