import { and, gte, inArray, lte } from "drizzle-orm";
import { getDb } from "@/db";
import { pumpOperatingLogs } from "@/db/schema";
import { PumpFilterParams, queryFilteredPumps } from "./pumps";

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

export interface MonitoringDateColumn {
  date: string;
  day: number;
  isSunday: boolean;
}

export interface MonitoringCell {
  date: string;
  type: "hours" | "standby" | "rusak" | "pre_order";
  value: string;
  hours: number;
}

export interface MonitoringPumpRow {
  no: number;
  pumpId: number;
  pumpCode: string;
  estateId: number | null;
  estateCode: string;
  estateName: string;
  blockId: number | null;
  blockCode: string;
  isLocationAssigned: boolean;
  pumpTypeName: string;
  pumpTypeShort: string;
  kondisi: "Baik" | "Rusak";
  currentUnitStatus: string;
  cells: MonitoringCell[];
  isPreOrder: boolean;
  totalHoursMonth: number;
  operationalNote: string;
  operationalCategory: string;
  repairStatus: string;
  breakdownStartDate: string | null;
}

export interface MonitoringRegionGroup {
  regionId: number | null;
  regionCode: string;
  regionName: string;
  pumps: MonitoringPumpRow[];
  regionTotalHoursMonth: number;
}

export interface OperatingHoursMonitoringPayload {
  month: string;
  monthName: string;
  year: number;
  monthLabel: string;
  dateFrom: string;
  dateTo: string;
  updateDate: string;
  dates: MonitoringDateColumn[];
  regions: MonitoringRegionGroup[];
  grandTotalHoursMonth: number;
  totalPumps: number;
}

export function formatHoursDisplay(hours: number): string {
  if (!Number.isFinite(hours) || hours <= 0) return "-";
  const rounded = Math.round(hours * 100) / 100;
  return Number.isInteger(rounded) ? String(rounded) : String(rounded);
}

export function formatPumpTypeShort(name: string): string {
  const lower = name.trim().toLowerCase();
  if (lower.includes("double")) return "AXIAL A-D";
  if (lower.includes("single")) return "AXIAL A-S";
  if (lower.includes("triple")) return "AXIAL A-T";
  if (lower.includes("ebara")) return "EBARA";
  return name.toUpperCase();
}

export function getMonthBounds(monthStr?: string): {
  month: string;
  year: number;
  monthIndex: number;
  monthName: string;
  monthLabel: string;
  monthStart: string;
  monthEnd: string;
  daysInMonth: number;
} {
  const now = new Date();
  const fallback = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`;
  const valid = monthStr && /^\d{4}-\d{2}$/.test(monthStr) ? monthStr : fallback;
  const [yStr, mStr] = valid.split("-");
  const year = Number(yStr);
  const monthIndex = Math.min(12, Math.max(1, Number(mStr)));
  const daysInMonth = new Date(Date.UTC(year, monthIndex, 0)).getUTCDate();
  const mm = String(monthIndex).padStart(2, "0");
  const monthName = MONTH_NAMES_ID[monthIndex - 1] ?? "Bulan";
  return {
    month: `${year}-${mm}`,
    year,
    monthIndex,
    monthName,
    monthLabel: `${monthName} ${year}`,
    monthStart: `${year}-${mm}-01`,
    monthEnd: `${year}-${mm}-${String(daysInMonth).padStart(2, "0")}`,
    daysInMonth,
  };
}

export function diffCalendarDays(fromDate: string, toDate: string): number {
  const [fy, fm, fd] = fromDate.split("-").map(Number);
  const [ty, tm, td] = toDate.split("-").map(Number);
  const fromMs = Date.UTC(fy, fm - 1, fd);
  const toMs = Date.UTC(ty, tm - 1, td);
  return Math.round((toMs - fromMs) / 86_400_000);
}

export function enumerateMonitoringDates(
  startDate: string,
  endDate: string
): MonitoringDateColumn[] {
  const [sy, sm, sd] = startDate.split("-").map(Number);
  const [ey, em, ed] = endDate.split("-").map(Number);
  const startMs = Date.UTC(sy, sm - 1, sd);
  const endMs = Date.UTC(ey, em - 1, ed);
  if (endMs < startMs) return [];

  const result: MonitoringDateColumn[] = [];
  for (let ms = startMs; ms <= endMs; ms += 86_400_000) {
    const dt = new Date(ms);
    const yyyy = dt.getUTCFullYear();
    const mm = String(dt.getUTCMonth() + 1).padStart(2, "0");
    const dd = String(dt.getUTCDate()).padStart(2, "0");
    result.push({
      date: `${yyyy}-${mm}-${dd}`,
      day: dt.getUTCDate(),
      isSunday: dt.getUTCDay() === 0,
    });
  }
  return result;
}

export interface DailyLogItem {
  operatingHours: number;
  dayStatus: string;
}

export function buildMonitoringCellsForPump(params: {
  dates: MonitoringDateColumn[];
  logsByDate: Map<string, DailyLogItem>;
  currentUnitStatus: string;
  isPreOrder: boolean;
  breakdownStartDate: string | null;
  latestInspectedDate: string | null;
  todayStr: string;
}): MonitoringCell[] {
  const {
    dates,
    logsByDate,
    currentUnitStatus,
    isPreOrder,
    breakdownStartDate,
    latestInspectedDate,
    todayStr,
  } = params;

  const isDamaged = currentUnitStatus !== "aktif";
  const effectiveStart = breakdownStartDate || latestInspectedDate || null;
  let consecutiveRusakCount = 0;

  return dates.map((col) => {
    const log = logsByDate.get(col.date);

    if (log && log.dayStatus === "operasi" && log.operatingHours > 0) {
      consecutiveRusakCount = 0;
      return {
        date: col.date,
        type: "hours",
        value: formatHoursDisplay(log.operatingHours),
        hours: log.operatingHours,
      };
    }

    if (log && log.dayStatus === "pre_order") {
      consecutiveRusakCount = 0;
      return {
        date: col.date,
        type: "pre_order",
        value: "PRE ORDER",
        hours: 0,
      };
    }

    if (log && log.dayStatus === "rusak") {
      consecutiveRusakCount += 1;
      const dayNumber =
        effectiveStart && col.date >= effectiveStart
          ? diffCalendarDays(effectiveStart, col.date) + 1
          : consecutiveRusakCount;
      return {
        date: col.date,
        type: "rusak",
        value: `R${dayNumber}`,
        hours: 0,
      };
    }

    if (isDamaged && isPreOrder) {
      return {
        date: col.date,
        type: "pre_order",
        value: "PRE ORDER",
        hours: 0,
      };
    }

    if (isDamaged && col.date <= todayStr) {
      if (effectiveStart && col.date >= effectiveStart) {
        const dayNumber = diffCalendarDays(effectiveStart, col.date) + 1;
        return {
          date: col.date,
          type: "rusak",
          value: `R${dayNumber}`,
          hours: 0,
        };
      }
      if (!effectiveStart) {
        consecutiveRusakCount += 1;
        return {
          date: col.date,
          type: "rusak",
          value: `R${consecutiveRusakCount}`,
          hours: 0,
        };
      }
    }

    consecutiveRusakCount = 0;
    return {
      date: col.date,
      type: "standby",
      value: "-",
      hours: 0,
    };
  });
}

function addDaysUtc(dateStr: string, delta: number): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + delta));
  return `${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(2, "0")}-${String(
    dt.getUTCDate()
  ).padStart(2, "0")}`;
}

export async function queryOperatingHoursMonitoring(
  params: PumpFilterParams & {
    month?: string;
    dateFrom?: string;
    dateTo?: string;
    windowPreset?: string;
  }
): Promise<OperatingHoursMonitoringPayload> {
  const bounds = getMonthBounds(params.month);
  const now = new Date();
  const todayStr = now.toISOString().slice(0, 10);

  let dateFrom = params.dateFrom && params.dateFrom >= bounds.monthStart ? params.dateFrom : "";
  let dateTo = params.dateTo && params.dateTo <= bounds.monthEnd ? params.dateTo : "";

  if (!dateFrom && !dateTo) {
    if (params.windowPreset === "full") {
      dateFrom = bounds.monthStart;
      dateTo = bounds.monthEnd;
    } else {
      const span = params.windowPreset === "7d" ? 6 : 13;
      const anchor =
        todayStr >= bounds.monthStart && todayStr <= bounds.monthEnd ? todayStr : bounds.monthEnd;
      const candidateFrom = addDaysUtc(anchor, -span);
      dateFrom = candidateFrom < bounds.monthStart ? bounds.monthStart : candidateFrom;
      dateTo = anchor;
    }
  } else {
    if (!dateFrom) dateFrom = bounds.monthStart;
    if (!dateTo) dateTo = bounds.monthEnd;
    if (dateFrom > dateTo) {
      dateFrom = bounds.monthStart;
      dateTo = bounds.monthEnd;
    }
  }

  const dates = enumerateMonitoringDates(dateFrom, dateTo);
  const pumps = await queryFilteredPumps(params);

  const db = getDb();
  const pumpIds = pumps.map((p) => p.id);
  const logsByPump = new Map<number, Map<string, DailyLogItem>>();
  const monthTotalByPump = new Map<number, number>();
  let maxLogDate = "";

  if (pumpIds.length > 0) {
    const logRows = await db
      .select({
        pumpId: pumpOperatingLogs.pumpId,
        logDate: pumpOperatingLogs.logDate,
        operatingHours: pumpOperatingLogs.operatingHours,
        dayStatus: pumpOperatingLogs.dayStatus,
      })
      .from(pumpOperatingLogs)
      .where(
        and(
          inArray(pumpOperatingLogs.pumpId, pumpIds),
          gte(pumpOperatingLogs.logDate, bounds.monthStart),
          lte(pumpOperatingLogs.logDate, bounds.monthEnd)
        )
      );

    for (const row of logRows) {
      const hrs = Number(row.operatingHours ?? 0);
      if (row.logDate > maxLogDate) maxLogDate = row.logDate;

      const map = logsByPump.get(row.pumpId) ?? new Map<string, DailyLogItem>();
      map.set(row.logDate, {
        operatingHours: hrs,
        dayStatus: row.dayStatus,
      });
      logsByPump.set(row.pumpId, map);

      if (row.dayStatus === "operasi" && hrs > 0) {
        monthTotalByPump.set(row.pumpId, (monthTotalByPump.get(row.pumpId) ?? 0) + hrs);
      }
    }
  }

  const regionGroupsMap = new Map<string, MonitoringRegionGroup>();

  for (const p of pumps) {
    const regionKey = p.regionId ? `${p.regionId}` : "unassigned";
    const group = regionGroupsMap.get(regionKey) ?? {
      regionId: p.regionId,
      regionCode: p.regionCode ?? "-",
      regionName: p.regionName ?? "Belum Ditempatkan",
      pumps: [],
      regionTotalHoursMonth: 0,
    };

    const logsMap = logsByPump.get(p.id) ?? new Map<string, DailyLogItem>();
    const totalHoursMonth = Math.round((monthTotalByPump.get(p.id) ?? 0) * 100) / 100;
    const cells = buildMonitoringCellsForPump({
      dates,
      logsByDate: logsMap,
      currentUnitStatus: p.currentUnitStatus,
      isPreOrder: p.isPreOrder,
      breakdownStartDate: p.breakdownStartDate,
      latestInspectedDate: p.latestInspectedDate,
      todayStr,
    });

    const kondisi: "Baik" | "Rusak" = p.currentUnitStatus === "aktif" ? "Baik" : "Rusak";
    const defaultNote =
      p.operationalNote?.trim() ||
      (kondisi === "Baik" ? "Standby" : "Rusak (lihat hasil pemeriksaan)");

    group.pumps.push({
      no: group.pumps.length + 1,
      pumpId: p.id,
      pumpCode: p.pumpCode,
      estateId: p.estateId,
      estateCode: p.estateCode ?? "-",
      estateName: p.estateName ?? p.estateCode ?? "Belum Assign",
      blockId: p.blockId,
      blockCode: p.blockCode ?? "Belum Assign",
      isLocationAssigned: p.isLocationAssigned,
      pumpTypeName: p.pumpTypeName,
      pumpTypeShort: formatPumpTypeShort(p.pumpTypeName),
      kondisi,
      currentUnitStatus: p.currentUnitStatus,
      cells,
      isPreOrder: p.isPreOrder && kondisi === "Rusak",
      totalHoursMonth,
      operationalNote: defaultNote,
      operationalCategory: p.operationalCategory || "none",
      repairStatus: p.repairStatus?.trim() || "",
      breakdownStartDate: p.breakdownStartDate,
    });

    group.regionTotalHoursMonth =
      Math.round((group.regionTotalHoursMonth + totalHoursMonth) * 100) / 100;
    regionGroupsMap.set(regionKey, group);
  }

  const regions = Array.from(regionGroupsMap.values()).sort((a, b) =>
    a.regionName.localeCompare(b.regionName)
  );
  const grandTotalHoursMonth =
    Math.round(regions.reduce((acc, g) => acc + g.regionTotalHoursMonth, 0) * 100) / 100;

  return {
    month: bounds.month,
    monthName: bounds.monthName,
    year: bounds.year,
    monthLabel: bounds.monthLabel,
    dateFrom,
    dateTo,
    updateDate: maxLogDate || dateTo || todayStr,
    dates,
    regions,
    grandTotalHoursMonth,
    totalPumps: pumps.length,
  };
}
