"use client";

import { Fragment } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  Camera,
  ChevronDown,
  ChevronRight,
  ClipboardCheck,
  Lock,
  MapPin,
} from "lucide-react";
import { UnitStatusBadge } from "@/components/StatusBadge";
import { PumpExpandedTray } from "@/components/pumps/PumpExpandedTray";
import { EnrichedPump } from "@/lib/client-fetch";
import {
  formatHours,
  formatRelativeDaysId,
  formatShortDateId,
  getBreakdownDays,
  getInspectionAgeDays,
  isInspectionStale,
  isPreOrderPump,
  PumpSortDirection,
  PumpSortKey,
} from "@/lib/pump-insights";
import {
  getPumpLocationBadgeInfo,
  OPERATIONAL_CATEGORY_OPTIONS,
} from "@/lib/pump-location";

function SortHeaderButton({
  label,
  targetKey,
  activeKey,
  direction,
  onSort,
  align = "left",
}: {
  label: string;
  targetKey: PumpSortKey;
  activeKey: PumpSortKey;
  direction: PumpSortDirection;
  onSort: (key: PumpSortKey, direction: PumpSortDirection) => void;
  align?: "left" | "right";
}) {
  const isActive = activeKey === targetKey;

  function handleClick() {
    if (isActive) {
      onSort(targetKey, direction === "asc" ? "desc" : "asc");
    } else {
      onSort(targetKey, "asc");
    }
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      className={`inline-flex min-h-[40px] items-center gap-1.5 rounded px-1.5 py-1 text-xs font-semibold transition-colors hover:bg-[#EAEFEA] ${
        isActive ? "text-[#166534]" : "text-field-muted hover:text-field-ink"
      } ${align === "right" ? "ml-auto justify-end" : ""}`}
    >
      <span>{label}</span>
      {isActive ? (
        direction === "asc" ? (
          <ArrowUp className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
        ) : (
          <ArrowDown className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
        )
      ) : (
        <ArrowUpDown className="h-3.5 w-3.5 shrink-0 opacity-60" aria-hidden="true" />
      )}
    </button>
  );
}

function getAriaSort(
  targetKey: PumpSortKey,
  activeKey: PumpSortKey,
  direction: PumpSortDirection
): "ascending" | "descending" | "none" {
  if (activeKey !== targetKey) return "none";
  return direction === "asc" ? "ascending" : "descending";
}

export function PumpDataTable({
  pumps,
  referenceDate,
  monthLabel,
  sortKey,
  sortDirection,
  onChangeSort,
  expandedIds,
  onToggleExpand,
  onOpenDialog,
}: {
  pumps: EnrichedPump[];
  referenceDate: string;
  monthLabel: string;
  sortKey: PumpSortKey;
  sortDirection: PumpSortDirection;
  onChangeSort: (key: PumpSortKey, direction: PumpSortDirection) => void;
  expandedIds: Set<number>;
  onToggleExpand: (pumpId: number) => void;
  onOpenDialog: (pump: EnrichedPump, tab: "location" | "operational") => void;
}) {
  const maxMonthHours = pumps.reduce(
    (max, p) => Math.max(max, Number(p.monthTotalHours ?? 0)),
    0
  );

  return (
    <div className="overflow-hidden rounded-lg border border-field-border bg-field-surface">
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-field-border bg-field-bg">
            <tr>
              <th
                scope="col"
                aria-sort={getAriaSort("code_asc", sortKey, sortDirection)}
                className="px-3 py-2"
              >
                <SortHeaderButton
                  label="Unit & Spesifikasi"
                  targetKey="code_asc"
                  activeKey={sortKey}
                  direction={sortDirection}
                  onSort={onChangeSort}
                />
              </th>

              <th
                scope="col"
                aria-sort={getAriaSort("estate_order", sortKey, sortDirection)}
                className="hidden px-3 py-2 lg:table-cell"
              >
                <SortHeaderButton
                  label="Lokasi Penempatan"
                  targetKey="estate_order"
                  activeKey={sortKey}
                  direction={sortDirection}
                  onSort={onChangeSort}
                />
              </th>

              <th
                scope="col"
                aria-sort={getAriaSort("priority", sortKey, sortDirection)}
                className="px-3 py-2"
              >
                <SortHeaderButton
                  label="Kondisi & Temuan"
                  targetKey="priority"
                  activeKey={sortKey}
                  direction={sortDirection}
                  onSort={onChangeSort}
                />
              </th>

              <th
                scope="col"
                aria-sort={getAriaSort("inspection_oldest", sortKey, sortDirection)}
                className="hidden px-3 py-2 lg:table-cell"
              >
                <SortHeaderButton
                  label="Inspeksi Terakhir"
                  targetKey="inspection_oldest"
                  activeKey={sortKey}
                  direction={sortDirection}
                  onSort={onChangeSort}
                />
              </th>

              <th
                scope="col"
                aria-sort={getAriaSort("hours_desc", sortKey, sortDirection)}
                className="hidden px-3 py-2 text-right xl:table-cell"
              >
                <SortHeaderButton
                  label={`Jam Kerja (${monthLabel || "Bulan Ini"})`}
                  targetKey="hours_desc"
                  activeKey={sortKey}
                  direction={sortDirection}
                  onSort={onChangeSort}
                  align="right"
                />
              </th>

              <th
                scope="col"
                className="px-3 py-2.5 text-right text-xs font-semibold text-field-muted"
              >
                Aksi
              </th>
            </tr>
          </thead>

          <tbody className="divide-y divide-field-border">
            {pumps.map((pump) => {
              const isExpanded = expandedIds.has(pump.id);
              const detailId = `pump-row-detail-${pump.id}`;
              const loc = getPumpLocationBadgeInfo({
                blockId: pump.blockId,
                blockCode: pump.blockCode,
                estateCode: pump.estateCode,
              });
              const categoryMeta = OPERATIONAL_CATEGORY_OPTIONS.find(
                (opt) => opt.value === pump.operationalCategory
              );
              const preOrder = isPreOrderPump(pump);
              const breakdownDays = getBreakdownDays(
                pump.breakdownStartDate,
                pump.currentUnitStatus,
                referenceDate
              );
              const inspectionAge = getInspectionAgeDays(
                pump.latestInspectedDate,
                referenceDate
              );
              const stale = isInspectionStale(pump.latestInspectedDate, referenceDate);
              const issues = pump.latestIssues ?? [];
              const firstIssue = issues[0];
              const hours = Number(pump.monthTotalHours ?? 0);
              const hoursBarPct =
                maxMonthHours > 0 && hours > 0
                  ? Math.min(100, Math.max(8, Math.round((hours / maxMonthHours) * 100)))
                  : 0;

              return (
                <Fragment key={pump.id}>
                  <tr
                    className={`align-top transition-colors ${
                      isExpanded ? "bg-field-bg/80" : "hover:bg-field-bg/50"
                    }`}
                  >
                    {/* Column 1: Unit & Spec (+ compact location on md tablet) */}
                    <td className="px-3 py-3">
                      <div className="flex items-start gap-1.5">
                        <button
                          type="button"
                          aria-expanded={isExpanded}
                          aria-controls={detailId}
                          aria-label={
                            isExpanded
                              ? `Tutup rincian pompa ${pump.pumpCode}`
                              : `Buka rincian pompa ${pump.pumpCode}`
                          }
                          onClick={() => onToggleExpand(pump.id)}
                          className={`inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-md border transition-colors ${
                            isExpanded
                              ? "border-[#15803D] bg-[#DCFCE7] text-[#166534]"
                              : "border-field-border bg-field-bg text-field-ink hover:bg-[#EAEFEA]"
                          }`}
                        >
                          {isExpanded ? (
                            <ChevronDown className="h-4 w-4" aria-hidden="true" />
                          ) : (
                            <ChevronRight className="h-4 w-4" aria-hidden="true" />
                          )}
                        </button>

                        <div className="min-w-0 pt-0.5">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <Link
                              href={`/pumps/${pump.id}`}
                              className="font-mono text-sm font-bold text-field-ink underline-offset-2 hover:underline"
                            >
                              {pump.pumpCode}
                            </Link>
                            {preOrder && (
                              <span className="inline-flex items-center rounded border border-[#FCA5A5] bg-[#FEE2E2] px-1.5 py-0.5 font-mono text-[10px] font-bold text-[#991B1B]">
                                PO
                              </span>
                            )}
                            {categoryMeta &&
                              categoryMeta.value !== "none" &&
                              categoryMeta.value !== "rusak_po" && (
                                <span
                                  className={`inline-flex items-center rounded border px-1.5 py-0.5 text-[10px] font-semibold ${categoryMeta.bgClass} ${categoryMeta.borderClass} ${categoryMeta.textClass}`}
                                >
                                  {categoryMeta.label}
                                </span>
                              )}
                          </div>
                          <p className="mt-0.5 text-xs text-field-muted">
                            {pump.pumpTypeName} · {pump.engineBrandName}
                          </p>

                          {/* Tablet compact location summary (768px - 1023px) */}
                          <div className="mt-1.5 lg:hidden">
                            <span
                              className={`inline-flex items-center gap-1 rounded border px-1.5 py-0.5 text-[11px] font-semibold ${
                                loc.assigned
                                  ? "border-field-border bg-field-bg font-mono text-field-ink"
                                  : loc.tone === "workshop"
                                    ? "border-[#FCD34D] bg-[#FEF3C7] text-[#92400E]"
                                    : "border-[#FCA5A5] bg-[#FEE2E2] text-[#991B1B]"
                              }`}
                            >
                              <MapPin className="h-3 w-3 shrink-0" aria-hidden="true" />
                              <span>{loc.label}</span>
                            </span>
                          </div>
                        </div>
                      </div>
                    </td>

                    {/* Column 2: Location (lg+) */}
                    <td className="hidden px-3 py-3 lg:table-cell">
                      <span
                        className={`inline-flex items-center gap-1.5 rounded border px-2 py-0.5 text-xs font-semibold ${
                          loc.assigned
                            ? "border-field-border bg-field-bg font-mono text-field-ink"
                            : loc.tone === "workshop"
                              ? "border-[#FCD34D] bg-[#FEF3C7] text-[#92400E]"
                              : "border-[#FCA5A5] bg-[#FEE2E2] text-[#991B1B]"
                        }`}
                      >
                        <MapPin className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                        <span>{loc.label}</span>
                      </span>
                      <p className="mt-1 text-xs text-field-muted">
                        {pump.regionName ?? "Belum Ada Region"}
                      </p>
                    </td>

                    {/* Column 3: Condition & Issue Preview (+ compact recency/hours on md tablet) */}
                    <td className="px-3 py-3">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <UnitStatusBadge status={pump.currentUnitStatus} />
                        {breakdownDays !== null && (
                          <span className="inline-flex items-center rounded border border-[#FCA5A5] bg-[#FEF2F2] px-2 py-0.5 font-mono text-[11px] font-semibold tabular-nums text-[#991B1B]">
                            Rusak {breakdownDays} hr
                          </span>
                        )}
                      </div>

                      <div className="mt-1.5 text-xs">
                        {pump.latestInspectionId === null ? (
                          <span className="text-field-muted">Belum ada catatan pemeriksaan</span>
                        ) : pump.issueCount === 0 ? (
                          <span className="text-field-muted">
                            {pump.operationalNote
                              ? pump.operationalNote
                              : "Komponen lengkap & baik"}
                          </span>
                        ) : (
                          <div className="text-field-ink">
                            <span className="font-semibold">
                              {firstIssue
                                ? `${firstIssue.partName} (${firstIssue.issueLabel})`
                                : `${pump.issueCount} part bermasalah`}
                            </span>
                            {firstIssue && pump.issueCount > 1 && (
                              <span className="ml-1.5 rounded bg-[#FEF3C7] px-1.5 py-0.5 font-mono text-[11px] font-semibold tabular-nums text-[#92400E]">
                                +{pump.issueCount - 1} lain
                              </span>
                            )}
                          </div>
                        )}
                      </div>

                      {/* Tablet compact inspection + hours summary (768px - 1023px) */}
                      <p className="mt-1 text-[11px] text-field-muted lg:hidden">
                        Inspeksi:{" "}
                        <span className={stale ? "font-semibold text-[#92400E]" : ""}>
                          {formatRelativeDaysId(inspectionAge)}
                        </span>
                        {" · "}
                        {pump.isLocationAssigned
                          ? `${formatHours(hours)} jam bln ini`
                          : "Jam terkunci"}
                      </p>
                    </td>

                    {/* Column 4: Latest Inspection (lg+) */}
                    <td className="hidden px-3 py-3 lg:table-cell">
                      {pump.latestInspectedDate ? (
                        <div>
                          <p className="font-mono text-xs font-semibold text-field-ink">
                            {formatShortDateId(pump.latestInspectedDate)}
                          </p>
                          <p
                            className={`mt-0.5 inline-flex items-center gap-1 text-xs ${
                              stale ? "font-semibold text-[#92400E]" : "text-field-muted"
                            }`}
                          >
                            {stale && (
                              <AlertTriangle
                                className="h-3 w-3 shrink-0"
                                aria-hidden="true"
                              />
                            )}
                            <span>{formatRelativeDaysId(inspectionAge)}</span>
                          </p>
                          <p className="mt-0.5 text-[11px] text-field-muted">
                            {pump.latestInspectorName || "-"}
                            {pump.photoCount > 0 && (
                              <span className="ml-1.5 inline-flex items-center gap-0.5 font-mono tabular-nums">
                                <Camera className="h-3 w-3" aria-hidden="true" />
                                {pump.photoCount}
                              </span>
                            )}
                          </p>
                        </div>
                      ) : (
                        <span className="inline-flex items-center gap-1 rounded border border-[#FCD34D] bg-[#FEF3C7] px-2 py-0.5 text-xs font-semibold text-[#92400E]">
                          <AlertTriangle className="h-3 w-3 shrink-0" aria-hidden="true" />
                          <span>Belum diperiksa</span>
                        </span>
                      )}

                      {/* Laptop compact hours line when Column 5 is hidden (1024px - 1279px) */}
                      <p className="mt-1 font-mono text-[11px] text-field-muted tabular-nums xl:hidden">
                        {pump.isLocationAssigned
                          ? `Jam bln ini: ${formatHours(hours)} jam`
                          : "Jam: Terkunci"}
                      </p>
                    </td>

                    {/* Column 5: Monthly Operating Hours (xl+) */}
                    <td className="hidden px-3 py-3 text-right xl:table-cell">
                      {pump.isLocationAssigned ? (
                        <div className="ml-auto max-w-[140px]">
                          <p className="font-mono text-sm font-bold tabular-nums text-field-ink">
                            {formatHours(hours)} <span className="text-xs font-normal text-field-muted">jam</span>
                          </p>
                          <div
                            aria-hidden="true"
                            className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-[#E4EAE5]"
                          >
                            {hoursBarPct > 0 && (
                              <div
                                style={{ width: `${hoursBarPct}%` }}
                                className="ml-auto h-full rounded-full bg-[#15803D]"
                              />
                            )}
                          </div>
                          <p className="mt-1 text-[11px] text-field-muted">
                            {pump.lastOperatingDate
                              ? `Terakhir: ${formatShortDateId(pump.lastOperatingDate)}`
                              : "Belum ada log"}
                          </p>
                        </div>
                      ) : (
                        <span className="inline-flex items-center justify-end gap-1 text-xs font-medium text-field-muted">
                          <Lock className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                          <span>Terkunci</span>
                        </span>
                      )}
                    </td>

                    {/* Column 6: Actions */}
                    <td className="px-3 py-3 text-right">
                      <div className="inline-flex items-center justify-end gap-1.5">
                        <Link
                          href={`/pumps/${pump.id}`}
                          className="inline-flex min-h-[44px] items-center rounded-md border border-field-border bg-white px-2.5 text-xs font-semibold text-field-ink hover:bg-field-bg"
                        >
                          Detail
                        </Link>
                        <Link
                          href={`/pumps/${pump.id}/inspect`}
                          className="inline-flex min-h-[44px] items-center gap-1.5 rounded-md border border-[#86EFAC] bg-[#F0FDF4] px-3 text-xs font-semibold text-[#166534] hover:bg-[#DCFCE7]"
                        >
                          <ClipboardCheck className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                          <span>Periksa</span>
                        </Link>
                      </div>
                    </td>
                  </tr>

                  {isExpanded && (
                    <tr id={detailId} className="bg-field-bg/50">
                      <td colSpan={6} className="px-3 pb-4 pt-1 sm:px-4">
                        <PumpExpandedTray
                          pump={pump}
                          referenceDate={referenceDate}
                          monthLabel={monthLabel}
                          onOpenDialog={onOpenDialog}
                        />
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
