export async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  if (res.status === 401 && typeof window !== "undefined") {
    window.location.href = "/login";
    throw new Error("Sesi login berakhir.");
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || `Permintaan gagal (${res.status}).`);
  }
  return data as T;
}

export interface PumpIssueSummary {
  partName: string;
  sectionName: string;
  availability: string;
  condition: string;
  issueLabel: string;
  notes: string | null;
}

export interface EnrichedPump {
  id: number;
  pumpCode: string;
  currentUnitStatus: "aktif" | "perlu_perbaikan" | "rusak_total";
  lastInspectedAt: string | null;
  isActive: boolean;
  blockId: number | null;
  blockCode: string | null;
  blockName: string | null;
  estateId: number | null;
  estateCode: string | null;
  estateName: string | null;
  estateSortOrder?: number | null;
  regionId: number | null;
  regionCode: string | null;
  regionName: string | null;
  companyId: number | null;
  companyCode: string | null;
  companyName: string | null;
  pumpTypeId: number;
  pumpTypeCode: string;
  pumpTypeName: string;
  engineBrandId: number;
  engineBrandName: string;
  latestInspectionId: number | null;
  latestInspectedDate: string | null;
  latestInspectorName: string | null;
  issueCount: number;
  photoCount: number;
  isLocationAssigned: boolean;
  operationalNote: string | null;
  operationalCategory: string;
  repairStatus: string | null;
  isPreOrder: boolean;
  breakdownStartDate: string | null;
  locationUpdatedAt: string | null;
  // Only present when /api/pumps is called with includeInsights=true.
  latestIssues?: PumpIssueSummary[];
  monthTotalHours?: number;
  lastOperatingDate?: string | null;
}
