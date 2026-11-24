import type { EnrichedPump } from "@/lib/client-fetch";

export const STALE_INSPECTION_DAYS = 30;

const MONTH_NAMES_ID = [
  "Januari",
  "Februari",
  "Maret",
  "April",
  "Mei",
  "Juni",
  "Juli",
  "Agustus",
  "September",
  "Oktober",
  "November",
  "Desember",
];

const MONTH_SHORT_ID = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "Mei",
  "Jun",
  "Jul",
  "Agu",
  "Sep",
  "Okt",
  "Nov",
  "Des",
];

export type PumpInsightFilter =
  | "all"
  | "attention"
  | "aktif"
  | "perlu_perbaikan"
  | "rusak_total"
  | "pre_order"
  | "unassigned_or_wsc"
  | "stale_inspection";

export type PumpSortKey =
  | "estate_order"
  | "priority"
  | "issues_desc"
  | "inspection_oldest"
  | "hours_desc"
  | "code_asc";

export type PumpSortDirection = "asc" | "desc";

export interface FleetInsightSummary {
  total: number;
  aktif: number;
  perluPerbaikan: number;
  rusakTotal: number;
  attentionCount: number;
  readinessPct: number;
  preOrderCount: number;
  unassignedOrWscCount: number;
  staleInspectionCount: number;
  totalIssues: number;
  totalMonthHours: number;
  operatingUnitsCount: number;
}

export const SORT_OPTIONS: Array<{ value: PumpSortKey; label: string }> = [
  { value: "estate_order", label: "Urutan Estate & Kode" },
  { value: "priority", label: "Prioritas Tindak Lanjut" },
  { value: "issues_desc", label: "Temuan Terbanyak" },
  { value: "inspection_oldest", label: "Terlama Belum Diperiksa" },
  { value: "hours_desc", label: "Jam Kerja Tertinggi" },
  { value: "code_asc", label: "Kode Pompa (A-Z)" },
];

// Field sites run on WIB (UTC+7), so "today" must not roll over at UTC midnight.
export function getTodayIsoDate(now: Date = new Date()): string {
  return new Date(now.getTime() + 7 * 3_600_000).toISOString().slice(0, 10);
}

function parseIsoDate(iso: string | null | undefined): number | null {
  if (!iso) return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  if (!match) return null;
  return Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
}

export function diffCalendarDaysSafe(fromIso: string | null, toIso: string | null): number | null {
  const from = parseIsoDate(fromIso);
  const to = parseIsoDate(toIso);
  if (from === null || to === null) return null;
  return Math.round((to - from) / 86_400_000);
}

export function getMonthBoundsFromDate(isoDate: string): {
  month: string;
  monthLabel: string;
  monthStart: string;
  monthEnd: string;
} {
  const ms = parseIsoDate(isoDate) ?? parseIsoDate(getTodayIsoDate())!;
  const d = new Date(ms);
  const year = d.getUTCFullYear();
  const monthIndex = d.getUTCMonth();
  const mm = String(monthIndex + 1).padStart(2, "0");
  const lastDay = new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate();
  return {
    month: `${year}-${mm}`,
    monthLabel: `${MONTH_NAMES_ID[monthIndex]} ${year}`,
    monthStart: `${year}-${mm}-01`,
    monthEnd: `${year}-${mm}-${String(lastDay).padStart(2, "0")}`,
  };
}

export function getInspectionAgeDays(
  latestInspectedDate: string | null,
  referenceDate: string
): number | null {
  const diff = diffCalendarDaysSafe(latestInspectedDate, referenceDate);
  if (diff === null) return null;
  return Math.max(0, diff);
}

export function isInspectionStale(
  latestInspectedDate: string | null,
  referenceDate: string,
  thresholdDays = STALE_INSPECTION_DAYS
): boolean {
  const age = getInspectionAgeDays(latestInspectedDate, referenceDate);
  return age === null || age > thresholdDays;
}

export function getBreakdownDays(
  breakdownStartDate: string | null,
  currentUnitStatus: string,
  referenceDate: string
): number | null {
  if (currentUnitStatus === "aktif") return null;
  const diff = diffCalendarDaysSafe(breakdownStartDate, referenceDate);
  if (diff === null) return null;
  return Math.max(1, diff + 1);
}

export function formatRelativeDaysId(days: number | null): string {
  if (days === null) return "Belum pernah";
  if (days === 0) return "Hari ini";
  if (days === 1) return "Kemarin";
  return `${days} hari lalu`;
}

export function formatShortDateId(isoDate: string | null | undefined): string {
  const ms = parseIsoDate(isoDate);
  if (ms === null) return "-";
  const d = new Date(ms);
  return `${d.getUTCDate()} ${MONTH_SHORT_ID[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}

export function formatHours(hours: number | null | undefined): string {
  const value = Number(hours ?? 0);
  if (!Number.isFinite(value) || value <= 0) return "0";
  const rounded = Math.round(value * 10) / 10;
  return rounded.toLocaleString("id-ID", { maximumFractionDigits: 1 });
}

export function isPreOrderPump(pump: EnrichedPump): boolean {
  return pump.isPreOrder || pump.operationalCategory === "rusak_po";
}

export function computeFleetInsights(
  pumps: EnrichedPump[],
  referenceDate: string
): FleetInsightSummary {
  const summary: FleetInsightSummary = {
    total: pumps.length,
    aktif: 0,
    perluPerbaikan: 0,
    rusakTotal: 0,
    attentionCount: 0,
    readinessPct: 0,
    preOrderCount: 0,
    unassignedOrWscCount: 0,
    staleInspectionCount: 0,
    totalIssues: 0,
    totalMonthHours: 0,
    operatingUnitsCount: 0,
  };

  for (const pump of pumps) {
    if (pump.currentUnitStatus === "aktif") summary.aktif += 1;
    else if (pump.currentUnitStatus === "perlu_perbaikan") summary.perluPerbaikan += 1;
    else summary.rusakTotal += 1;

    if (isPreOrderPump(pump)) summary.preOrderCount += 1;
    if (!pump.isLocationAssigned) summary.unassignedOrWscCount += 1;
    if (isInspectionStale(pump.latestInspectedDate, referenceDate)) {
      summary.staleInspectionCount += 1;
    }
    summary.totalIssues += pump.issueCount;
    const hours = Number(pump.monthTotalHours ?? 0);
    if (hours > 0) {
      summary.totalMonthHours += hours;
      summary.operatingUnitsCount += 1;
    }
  }

  summary.attentionCount = summary.perluPerbaikan + summary.rusakTotal;
  summary.readinessPct =
    summary.total > 0 ? Math.round((summary.aktif / summary.total) * 100) : 0;
  summary.totalMonthHours = Math.round(summary.totalMonthHours * 100) / 100;
  return summary;
}

export function matchesInsightFilter(
  pump: EnrichedPump,
  filter: PumpInsightFilter,
  referenceDate: string
): boolean {
  switch (filter) {
    case "all":
      return true;
    case "attention":
      return pump.currentUnitStatus !== "aktif";
    case "aktif":
    case "perlu_perbaikan":
    case "rusak_total":
      return pump.currentUnitStatus === filter;
    case "pre_order":
      return isPreOrderPump(pump);
    case "unassigned_or_wsc":
      return !pump.isLocationAssigned;
    case "stale_inspection":
      return isInspectionStale(pump.latestInspectedDate, referenceDate);
    default:
      return true;
  }
}

export function matchesPumpSearch(pump: EnrichedPump, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  const haystack = [
    pump.pumpCode,
    pump.estateCode,
    pump.estateName,
    pump.blockCode,
    pump.regionName,
    pump.pumpTypeName,
    pump.engineBrandName,
    pump.operationalNote,
    pump.repairStatus,
    pump.latestInspectorName,
    ...(pump.latestIssues ?? []).flatMap((issue) => [issue.partName, issue.issueLabel]),
  ];
  return haystack.some((value) => (value ?? "").toLowerCase().includes(q));
}

const STATUS_RANK: Record<string, number> = {
  rusak_total: 0,
  perlu_perbaikan: 1,
  aktif: 2,
};

export function sortPumps(
  pumps: EnrichedPump[],
  sortKey: PumpSortKey,
  direction: PumpSortDirection,
  referenceDate: string
): EnrichedPump[] {
  const sign = direction === "asc" ? 1 : -1;
  const indexed = pumps.map((pump, index) => ({ pump, index }));

  function compare(a: EnrichedPump, b: EnrichedPump): number {
    switch (sortKey) {
      case "estate_order":
        return 0;
      case "priority": {
        const rank = (STATUS_RANK[a.currentUnitStatus] ?? 3) - (STATUS_RANK[b.currentUnitStatus] ?? 3);
        if (rank !== 0) return rank;
        const issues = b.issueCount - a.issueCount;
        if (issues !== 0) return issues;
        const daysA = getBreakdownDays(a.breakdownStartDate, a.currentUnitStatus, referenceDate) ?? 0;
        const daysB = getBreakdownDays(b.breakdownStartDate, b.currentUnitStatus, referenceDate) ?? 0;
        return daysB - daysA;
      }
      case "issues_desc":
        return b.issueCount - a.issueCount;
      case "inspection_oldest": {
        // Never-inspected units count as the oldest.
        const ageA = getInspectionAgeDays(a.latestInspectedDate, referenceDate) ?? Number.MAX_SAFE_INTEGER;
        const ageB = getInspectionAgeDays(b.latestInspectedDate, referenceDate) ?? Number.MAX_SAFE_INTEGER;
        return ageB - ageA;
      }
      case "hours_desc":
        return Number(b.monthTotalHours ?? 0) - Number(a.monthTotalHours ?? 0);
      case "code_asc":
        return a.pumpCode.localeCompare(b.pumpCode, "id", { numeric: true, sensitivity: "base" });
      default:
        return 0;
    }
  }

  indexed.sort((x, y) => {
    const primary = compare(x.pump, y.pump) * sign;
    if (primary !== 0) return primary;
    return sortKey === "estate_order" ? (x.index - y.index) * sign : x.index - y.index;
  });

  return indexed.map((entry) => entry.pump);
}
