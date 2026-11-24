"use client";

import Link from "next/link";
import {
  AlertTriangle,
  ChevronDown,
  ChevronUp,
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
} from "@/lib/pump-insights";
import {
  getPumpLocationBadgeInfo,
  OPERATIONAL_CATEGORY_OPTIONS,
} from "@/lib/pump-location";

export function PumpCardGrid({
  pumps,
  referenceDate,
  monthLabel,
  expandedIds,
  onToggleExpand,
  onOpenDialog,
}: {
  pumps: EnrichedPump[];
  referenceDate: string;
  monthLabel: string;
  expandedIds: Set<number>;
  onToggleExpand: (pumpId: number) => void;
  onOpenDialog: (pump: EnrichedPump, tab: "location" | "operational") => void;
}) {
  return (
    <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
      {pumps.map((pump) => {
        const isExpanded = expandedIds.has(pump.id);
        const detailId = `pump-card-detail-${pump.id}`;
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

        return (
          <article
            key={pump.id}
            className={`flex flex-col justify-between gap-3 rounded-lg border border-field-border bg-field-surface p-4 ${
              isExpanded ? "md:col-span-2 xl:col-span-3" : ""
            }`}
          >
            <div className="space-y-3">
              {/* Top Identity & Status */}
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <Link
                      href={`/pumps/${pump.id}`}
                      className="font-mono text-base font-bold text-field-ink underline-offset-2 hover:underline"
                    >
                      {pump.pumpCode}
                    </Link>
                    {preOrder && (
                      <span className="inline-flex items-center rounded border border-[#FCA5A5] bg-[#FEE2E2] px-1.5 py-0.5 font-mono text-[10px] font-bold text-[#991B1B]">
                        PO
                      </span>
                    )}
                  </div>
                  <p className="mt-0.5 text-xs text-field-muted">
                    {pump.pumpTypeName} · {pump.engineBrandName}
                  </p>
                </div>
                <UnitStatusBadge status={pump.currentUnitStatus} />
              </div>

              {/* Location & Category Badges */}
              <div className="flex flex-wrap items-center gap-1.5">
                <span
                  className={`inline-flex items-center gap-1 rounded border px-2 py-0.5 text-xs font-semibold ${
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

                {breakdownDays !== null && (
                  <span className="inline-flex items-center rounded border border-[#FCA5A5] bg-[#FEF2F2] px-2 py-0.5 font-mono text-[11px] font-semibold tabular-nums text-[#991B1B]">
                    Rusak {breakdownDays} hr
                  </span>
                )}

                {categoryMeta &&
                  categoryMeta.value !== "none" &&
                  categoryMeta.value !== "rusak_po" && (
                    <span
                      className={`inline-flex items-center rounded border px-2 py-0.5 text-[11px] font-semibold ${categoryMeta.bgClass} ${categoryMeta.borderClass} ${categoryMeta.textClass}`}
                    >
                      {categoryMeta.label}
                    </span>
                  )}
              </div>

              {/* Key Insights Grid */}
              <dl className="grid grid-cols-2 gap-x-3 gap-y-2 border-t border-field-border pt-2.5 text-xs">
                <div className="col-span-2">
                  <dt className="text-field-muted">Temuan &amp; Catatan</dt>
                  <dd className="mt-0.5 font-medium text-field-ink">
                    {pump.latestInspectionId === null ? (
                      <span className="text-field-muted">Belum pernah diperiksa</span>
                    ) : pump.issueCount === 0 ? (
                      <span>{pump.operationalNote || "Komponen lengkap & baik"}</span>
                    ) : (
                      <span>
                        <strong className="font-semibold">
                          {firstIssue
                            ? `${firstIssue.partName} (${firstIssue.issueLabel})`
                            : `${pump.issueCount} part bermasalah`}
                        </strong>
                        {firstIssue && pump.issueCount > 1
                          ? ` +${pump.issueCount - 1} part lain`
                          : ""}
                      </span>
                    )}
                  </dd>
                </div>

                <div>
                  <dt className="text-field-muted">Inspeksi Terakhir</dt>
                  <dd
                    className={`mt-0.5 inline-flex items-center gap-1 font-medium ${
                      stale ? "font-semibold text-[#92400E]" : "text-field-ink"
                    }`}
                  >
                    {stale && (
                      <AlertTriangle className="h-3 w-3 shrink-0" aria-hidden="true" />
                    )}
                    <span>
                      {pump.latestInspectedDate
                        ? `${formatShortDateId(pump.latestInspectedDate)} (${formatRelativeDaysId(inspectionAge)})`
                        : "Belum diperiksa"}
                    </span>
                  </dd>
                </div>

                <div>
                  <dt className="text-field-muted">Jam Kerja Bln Ini</dt>
                  <dd className="mt-0.5 font-mono font-semibold tabular-nums text-field-ink">
                    {pump.isLocationAssigned ? (
                      `${formatHours(hours)} jam`
                    ) : (
                      <span className="inline-flex items-center gap-1 font-sans font-medium text-field-muted">
                        <Lock className="h-3 w-3 shrink-0" aria-hidden="true" />
                        <span>Terkunci</span>
                      </span>
                    )}
                  </dd>
                </div>
              </dl>

              {isExpanded && (
                <div id={detailId} className="pt-1">
                  <PumpExpandedTray
                    pump={pump}
                    referenceDate={referenceDate}
                    monthLabel={monthLabel}
                    onOpenDialog={onOpenDialog}
                  />
                </div>
              )}
            </div>

            {/* Footer Controls */}
            <div className="flex flex-wrap items-center justify-between gap-2 border-t border-field-border pt-3">
              <button
                type="button"
                aria-expanded={isExpanded}
                aria-controls={detailId}
                onClick={() => onToggleExpand(pump.id)}
                className={`inline-flex min-h-[44px] items-center gap-1.5 rounded-md border px-3 text-xs font-semibold transition-colors ${
                  isExpanded
                    ? "border-[#15803D] bg-[#DCFCE7] text-[#166534]"
                    : "border-field-border bg-field-bg text-field-ink hover:bg-[#EAEFEA]"
                }`}
              >
                {isExpanded ? (
                  <>
                    <ChevronUp className="h-4 w-4" aria-hidden="true" />
                    <span>Tutup Rincian</span>
                  </>
                ) : (
                  <>
                    <ChevronDown className="h-4 w-4" aria-hidden="true" />
                    <span>Rincian</span>
                  </>
                )}
              </button>

              <div className="flex items-center gap-2">
                <Link
                  href={`/pumps/${pump.id}`}
                  className="inline-flex min-h-[44px] items-center rounded-md border border-field-border bg-white px-3 text-xs font-semibold text-field-ink hover:bg-field-bg"
                >
                  Detail
                </Link>
                <Link
                  href={`/pumps/${pump.id}/inspect`}
                  className="inline-flex min-h-[44px] items-center gap-1.5 rounded-md border border-[#86EFAC] bg-[#F0FDF4] px-3.5 text-xs font-semibold text-[#166534] hover:bg-[#DCFCE7]"
                >
                  <ClipboardCheck className="h-4 w-4" aria-hidden="true" />
                  <span>Periksa</span>
                </Link>
              </div>
            </div>
          </article>
        );
      })}
    </div>
  );
}
