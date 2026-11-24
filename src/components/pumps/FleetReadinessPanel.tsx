"use client";

import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  Layers,
  MapPinOff,
  PackageCheck,
  XCircle,
} from "lucide-react";
import {
  FleetInsightSummary,
  formatHours,
  PumpInsightFilter,
  STALE_INSPECTION_DAYS,
} from "@/lib/pump-insights";

interface InsightChipDef {
  id: PumpInsightFilter;
  label: string;
  count: number;
  icon: React.ComponentType<{ className?: string }>;
  activeClass: string;
}

export function FleetReadinessPanel({
  insights,
  monthLabel,
  activeFilter,
  onSelectFilter,
}: {
  insights: FleetInsightSummary;
  monthLabel: string;
  activeFilter: PumpInsightFilter;
  onSelectFilter: (next: PumpInsightFilter) => void;
}) {
  const total = insights.total;
  const aktifPct = total > 0 ? (insights.aktif / total) * 100 : 0;
  const perbaikanPct = total > 0 ? (insights.perluPerbaikan / total) * 100 : 0;
  const rusakPct = total > 0 ? (insights.rusakTotal / total) * 100 : 0;

  const chips: InsightChipDef[] = [
    {
      id: "all",
      label: "Semua Unit",
      count: insights.total,
      icon: Layers,
      activeClass: "border-[#15803D] bg-[#DCFCE7] text-[#166534]",
    },
    {
      id: "attention",
      label: "Perlu Tindak Lanjut",
      count: insights.attentionCount,
      icon: AlertTriangle,
      activeClass: "border-[#B45309] bg-[#FEF3C7] text-[#92400E]",
    },
    {
      id: "rusak_total",
      label: "Rusak Total",
      count: insights.rusakTotal,
      icon: XCircle,
      activeClass: "border-[#DC2626] bg-[#FEE2E2] text-[#991B1B]",
    },
    {
      id: "pre_order",
      label: "Pre-Order (PO)",
      count: insights.preOrderCount,
      icon: PackageCheck,
      activeClass: "border-[#DC2626] bg-[#FEE2E2] text-[#991B1B]",
    },
    {
      id: "unassigned_or_wsc",
      label: "Belum Assign / WSC",
      count: insights.unassignedOrWscCount,
      icon: MapPinOff,
      activeClass: "border-[#B45309] bg-[#FEF3C7] text-[#92400E]",
    },
    {
      id: "stale_inspection",
      label: `Inspeksi > ${STALE_INSPECTION_DAYS} Hr`,
      count: insights.staleInspectionCount,
      icon: Clock,
      activeClass: "border-[#B45309] bg-[#FEF3C7] text-[#92400E]",
    },
    {
      id: "aktif",
      label: "Aktif",
      count: insights.aktif,
      icon: CheckCircle2,
      activeClass: "border-[#15803D] bg-[#DCFCE7] text-[#166534]",
    },
  ];

  function handleChipClick(id: PumpInsightFilter) {
    if (id !== "all" && activeFilter === id) {
      onSelectFilter("all");
      return;
    }
    onSelectFilter(id);
  }

  return (
    <section
      aria-label="Kesiapan armada dan filter insight cepat"
      className="rounded-lg border border-field-border bg-field-surface p-4 sm:p-5"
    >
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="min-w-0">
          <p className="text-xs font-semibold text-field-muted">Kesiapan Armada Terfilter</p>
          <div className="mt-1 flex flex-wrap items-baseline gap-x-2.5 gap-y-1">
            <span className="font-mono text-2xl font-bold tabular-nums text-field-ink sm:text-3xl">
              {insights.readinessPct}%
            </span>
            <span className="text-sm font-semibold text-field-ink">
              Siap Operasi ({insights.aktif} dari {insights.total} unit)
            </span>
          </div>
          <p className="mt-1 text-xs text-field-muted">
            <span className="font-mono font-semibold tabular-nums text-field-ink">
              {insights.attentionCount}
            </span>{" "}
            unit perlu tindak lanjut ·{" "}
            <span className="font-mono font-semibold tabular-nums text-field-ink">
              {insights.totalIssues}
            </span>{" "}
            part bermasalah ·{" "}
            <span className="font-mono font-semibold tabular-nums text-field-ink">
              {formatHours(insights.totalMonthHours)}
            </span>{" "}
            jam tercatat ({monthLabel || "Bulan Ini"})
          </p>
        </div>

        <div className="w-full lg:max-w-md">
          <div
            role="img"
            aria-label={`Komposisi kondisi pompa: ${insights.aktif} Aktif, ${insights.perluPerbaikan} Perlu Perbaikan, ${insights.rusakTotal} Rusak Total dari ${insights.total} unit`}
            className="flex h-3.5 w-full overflow-hidden rounded-md border border-field-border bg-[#E4EAE5] p-0.5 gap-0.5"
          >
            {insights.aktif > 0 && (
              <div
                style={{ width: `${aktifPct}%` }}
                className="h-full rounded-xs bg-[#15803D]"
              />
            )}
            {insights.perluPerbaikan > 0 && (
              <div
                style={{ width: `${perbaikanPct}%` }}
                className="h-full rounded-xs bg-[#B45309]"
              />
            )}
            {insights.rusakTotal > 0 && (
              <div
                style={{ width: `${rusakPct}%` }}
                className="h-full rounded-xs bg-[#DC2626]"
              />
            )}
          </div>

          <div className="mt-2 flex flex-wrap items-center justify-between gap-x-4 gap-y-1 text-xs">
            <span className="inline-flex items-center gap-1.5 text-field-ink">
              <span className="h-2.5 w-2.5 rounded-xs bg-[#15803D]" aria-hidden="true" />
              <span>Aktif:</span>
              <strong className="font-mono tabular-nums">{insights.aktif}</strong>
            </span>
            <span className="inline-flex items-center gap-1.5 text-field-ink">
              <span className="h-2.5 w-2.5 rounded-xs bg-[#B45309]" aria-hidden="true" />
              <span>Perbaikan:</span>
              <strong className="font-mono tabular-nums">{insights.perluPerbaikan}</strong>
            </span>
            <span className="inline-flex items-center gap-1.5 text-field-ink">
              <span className="h-2.5 w-2.5 rounded-xs bg-[#DC2626]" aria-hidden="true" />
              <span>Rusak:</span>
              <strong className="font-mono tabular-nums">{insights.rusakTotal}</strong>
            </span>
          </div>
        </div>
      </div>

      <div
        role="group"
        aria-label="Filter cepat berdasarkan insight kondisi pompa"
        className="mt-4 flex flex-wrap gap-2 border-t border-field-border pt-3.5"
      >
        {chips.map((chip) => {
          const Icon = chip.icon;
          const isSelected = activeFilter === chip.id;
          const isDisabled = chip.id !== "all" && chip.count === 0 && !isSelected;

          return (
            <button
              key={chip.id}
              type="button"
              disabled={isDisabled}
              aria-pressed={isSelected}
              onClick={() => handleChipClick(chip.id)}
              className={`inline-flex min-h-[44px] items-center gap-2 rounded-md border px-3 text-xs font-semibold transition-colors ${
                isSelected
                  ? chip.activeClass
                  : isDisabled
                    ? "border-field-border bg-field-bg text-field-muted opacity-55"
                    : "border-field-border bg-white text-field-ink hover:bg-field-bg"
              }`}
            >
              <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              <span>{chip.label}</span>
              <span
                className={`rounded px-1.5 py-0.5 font-mono text-[11px] font-bold tabular-nums ${
                  isSelected
                    ? "bg-white/80 text-current"
                    : "bg-field-bg text-field-ink"
                }`}
              >
                {chip.count}
              </span>
            </button>
          );
        })}
      </div>
    </section>
  );
}
