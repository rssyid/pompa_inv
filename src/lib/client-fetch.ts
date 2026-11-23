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

export interface EnrichedPump {
  id: number;
  pumpCode: string;
  currentUnitStatus: "aktif" | "perlu_perbaikan" | "rusak_total";
  lastInspectedAt: string | null;
  isActive: boolean;
  blockId: number;
  blockCode: string;
  blockName: string;
  estateId: number;
  estateCode: string;
  estateName: string;
  regionId: number;
  regionCode: string;
  regionName: string;
  companyId: number;
  companyCode: string;
  companyName: string;
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
}
