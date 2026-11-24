"use client";

import Link from "next/link";
import {
  Camera,
  ClipboardCheck,
  Clock,
  ExternalLink,
  MapPin,
  SlidersHorizontal,
} from "lucide-react";
import { AvailabilityLabel, ConditionLabel } from "@/components/StatusBadge";
import { EnrichedPump } from "@/lib/client-fetch";
import {
  formatHours,
  formatRelativeDaysId,
  formatShortDateId,
  getBreakdownDays,
  getInspectionAgeDays,
  isPreOrderPump,
} from "@/lib/pump-insights";
import {
  getPumpLocationBadgeInfo,
  OPERATIONAL_CATEGORY_OPTIONS,
} from "@/lib/pump-location";

export function PumpExpandedTray({
  pump,
  referenceDate,
  monthLabel,
  onOpenDialog,
}: {
  pump: EnrichedPump;
  referenceDate: string;
  monthLabel: string;
  onOpenDialog: (pump: EnrichedPump, tab: "location" | "operational") => void;
}) {
  const issues = pump.latestIssues ?? [];
  const loc = getPumpLocationBadgeInfo({
    blockId: pump.blockId,
    blockCode: pump.blockCode,
    estateCode: pump.estateCode,
  });
  const categoryMeta = OPERATIONAL_CATEGORY_OPTIONS.find(
    (opt) => opt.value === pump.operationalCategory
  );
  const breakdownDays = getBreakdownDays(
    pump.breakdownStartDate,
    pump.currentUnitStatus,
    referenceDate
  );
  const inspectionAge = getInspectionAgeDays(pump.latestInspectedDate, referenceDate);
  const preOrder = isPreOrderPump(pump);

  return (
    <div className="space-y-4 rounded-md border border-field-border bg-field-bg p-3.5 sm:p-4">
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
        {/* Issue Details Column */}
        <div className="space-y-2 lg:col-span-7">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-xs font-bold text-field-ink">
              Rincian Komponen Pemeriksaan Terakhir
            </h3>
            {pump.latestInspectedDate && (
              <span className="font-mono text-xs text-field-muted">
                {formatShortDateId(pump.latestInspectedDate)} ({formatRelativeDaysId(inspectionAge)})
              </span>
            )}
          </div>

          {pump.latestInspectionId === null ? (
            <p className="rounded-md border border-dashed border-field-border bg-white p-3 text-xs text-field-muted">
              Unit ini belum memiliki riwayat pemeriksaan tercatat. Gunakan tombol Periksa Unit
              untuk mencatat kondisi komponen pertama kali.
            </p>
          ) : issues.length === 0 && pump.issueCount === 0 ? (
            <p className="rounded-md border border-[#86EFAC] bg-[#F0FDF4] p-3 text-xs font-medium text-[#166534]">
              Seluruh komponen pada pemeriksaan terakhir tercatat lengkap dan berfungsi baik.
            </p>
          ) : (
            <ul className="divide-y divide-field-border overflow-hidden rounded-md border border-field-border bg-white">
              {issues.map((item, idx) => (
                <li
                  key={`${item.sectionName}-${item.partName}-${idx}`}
                  className="flex flex-col gap-1.5 px-3 py-2.5 text-xs sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="min-w-0">
                    <p className="font-semibold text-field-ink">{item.partName}</p>
                    <p className="text-[11px] text-field-muted">
                      {item.sectionName}
                      {item.issueLabel ? ` · ${item.issueLabel}` : ""}
                      {item.notes ? ` · Catatan: ${item.notes}` : ""}
                    </p>
                  </div>
                  <div className="flex shrink-0 flex-wrap items-center gap-1.5">
                    <AvailabilityLabel value={item.availability} />
                    <ConditionLabel value={item.condition} />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Operational & Activity Summary Column */}
        <div className="space-y-2 lg:col-span-5">
          <h3 className="text-xs font-bold text-field-ink">
            Konteks Operasional &amp; Aktivitas
          </h3>

          <dl className="grid grid-cols-1 gap-2 rounded-md border border-field-border bg-white p-3 text-xs sm:grid-cols-2">
            <div>
              <dt className="text-field-muted">Lokasi Penempatan</dt>
              <dd className="mt-0.5 font-mono font-semibold text-field-ink">
                {loc.label}
              </dd>
            </div>

            <div>
              <dt className="text-field-muted">Jam Kerja ({monthLabel || "Bulan Ini"})</dt>
              <dd className="mt-0.5 font-mono font-semibold tabular-nums text-field-ink">
                {pump.isLocationAssigned
                  ? `${formatHours(pump.monthTotalHours)} jam`
                  : "Terkunci (WSC/Belum Assign)"}
                {pump.lastOperatingDate ? (
                  <span className="block font-sans text-[11px] font-normal text-field-muted">
                    Operasi terakhir: {formatShortDateId(pump.lastOperatingDate)}
                  </span>
                ) : null}
              </dd>
            </div>

            <div>
              <dt className="text-field-muted">Pemeriksa Terakhir</dt>
              <dd className="mt-0.5 font-medium text-field-ink">
                {pump.latestInspectorName || "-"}
                {pump.photoCount > 0 && (
                  <span className="mt-0.5 inline-flex items-center gap-1 font-mono text-[11px] text-field-muted sm:ml-2">
                    <Camera className="h-3 w-3" aria-hidden="true" />
                    <span>{pump.photoCount} foto</span>
                  </span>
                )}
              </dd>
            </div>

            <div>
              <dt className="text-field-muted">Tindak Lanjut / PO</dt>
              <dd className="mt-0.5 font-medium text-field-ink">
                {pump.repairStatus || (preOrder ? "Menunggu Pre-Order (PO)" : "-")}
                {breakdownDays !== null && pump.breakdownStartDate && (
                  <span className="block font-mono text-[11px] font-semibold text-[#991B1B]">
                    Hari ke-{breakdownDays} sejak {formatShortDateId(pump.breakdownStartDate)}
                  </span>
                )}
              </dd>
            </div>

            <div className="sm:col-span-2 border-t border-field-border pt-2">
              <dt className="text-field-muted">Keterangan Monitoring</dt>
              <dd className="mt-1 flex flex-wrap items-center gap-1.5 text-field-ink">
                {categoryMeta && categoryMeta.value !== "none" && (
                  <span
                    className={`inline-flex items-center rounded border px-2 py-0.5 text-[11px] font-semibold ${categoryMeta.bgClass} ${categoryMeta.borderClass} ${categoryMeta.textClass}`}
                  >
                    {categoryMeta.label}
                  </span>
                )}
                {preOrder && (
                  <span className="inline-flex items-center rounded border border-[#FCA5A5] bg-[#FEE2E2] px-2 py-0.5 font-mono text-[11px] font-bold text-[#991B1B]">
                    PRE-ORDER
                  </span>
                )}
                <span className="font-medium">
                  {pump.operationalNote || "Tidak ada catatan khusus."}
                </span>
              </dd>
            </div>
          </dl>
        </div>
      </div>

      {/* Quick Action Bar */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-field-border pt-3">
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => onOpenDialog(pump, "location")}
            className="inline-flex min-h-[44px] items-center gap-1.5 rounded-md border border-field-border bg-white px-3 text-xs font-semibold text-field-ink hover:bg-[#EAEFEA]"
          >
            <MapPin className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            <span>{loc.assigned ? "Pindah Lokasi" : "Assign Lokasi"}</span>
          </button>
          <button
            type="button"
            onClick={() => onOpenDialog(pump, "operational")}
            className="inline-flex min-h-[44px] items-center gap-1.5 rounded-md border border-field-border bg-white px-3 text-xs font-semibold text-field-ink hover:bg-[#EAEFEA]"
          >
            <SlidersHorizontal className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            <span>Edit Info &amp; PO</span>
          </button>
          <Link
            href="/operating-hours"
            className="inline-flex min-h-[44px] items-center gap-1.5 rounded-md border border-field-border bg-white px-3 text-xs font-semibold text-field-ink hover:bg-[#EAEFEA]"
          >
            <Clock className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            <span>Input Jam Kerja</span>
          </Link>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Link
            href={`/pumps/${pump.id}`}
            className="inline-flex min-h-[44px] items-center gap-1.5 rounded-md border border-field-border bg-white px-3.5 text-xs font-semibold text-field-ink hover:bg-[#EAEFEA]"
          >
            <ExternalLink className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            <span>Lihat Detail &amp; Cetak</span>
          </Link>
          <Link
            href={`/pumps/${pump.id}/inspect`}
            className="inline-flex min-h-[44px] items-center gap-1.5 rounded-md bg-field-accent px-4 text-xs font-semibold text-white hover:bg-field-accent-hover"
          >
            <ClipboardCheck className="h-4 w-4 shrink-0" aria-hidden="true" />
            <span>Periksa Unit</span>
          </Link>
        </div>
      </div>
    </div>
  );
}
