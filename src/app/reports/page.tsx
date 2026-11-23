"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Download, Printer } from "lucide-react";
import { useAppData } from "@/components/AppDataProvider";
import { AppShell } from "@/components/AppShell";
import {
  FilterValues,
  HierarchyFilterBar,
} from "@/components/HierarchyFilterBar";
import {
  AvailabilityLabel,
  ConditionLabel,
  UnitStatusBadge,
} from "@/components/StatusBadge";
import { EmptyState, ErrorState, LoadingState } from "@/components/UiStates";
import { EnrichedPump, fetchJson } from "@/lib/client-fetch";

interface IssueReportRow {
  id: number;
  pumpId: number;
  pumpCode: string;
  regionName: string;
  estateCode: string;
  blockCode: string;
  pumpTypeName: string;
  sectionName: string;
  partName: string;
  expectedQty: number;
  availability: string;
  condition: string;
  issueLabel: string;
  notes: string;
  inspectedAt: string;
}

interface ReportResponse {
  totals: {
    total: number;
    aktif: number;
    perluPerbaikan: number;
    rusakTotal: number;
    totalIssues: number;
  };
  pumps: EnrichedPump[];
  issues: IssueReportRow[];
}

export default function ReportsPage() {
  const { user, master, ensureLoaded, error: bootError } = useAppData();
  const [report, setReport] = useState<ReportResponse | null>(null);
  const [activeTab, setActiveTab] = useState<"units" | "issues">("units");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const abortRef = useRef<AbortController | null>(null);
  const [filters, setFilters] = useState<FilterValues>({
    companyId: "",
    regionId: "",
    estateId: "",
    blockId: "",
    pumpTypeId: "",
    status: "",
    search: "",
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const buildQueryString = useCallback(
    (f: FilterValues, dFrom: string, dTo: string) => {
      const params = new URLSearchParams();
      if (f.companyId) params.set("companyId", f.companyId);
      if (f.regionId) params.set("regionId", f.regionId);
      if (f.estateId) params.set("estateId", f.estateId);
      if (f.blockId) params.set("blockId", f.blockId);
      if (f.pumpTypeId) params.set("pumpTypeId", f.pumpTypeId);
      if (f.status) params.set("status", f.status);
      if (f.search) params.set("search", f.search);
      if (dFrom) params.set("dateFrom", dFrom);
      if (dTo) params.set("dateTo", dTo);
      return params.toString();
    },
    []
  );

  const loadReport = useCallback(
    async (f: FilterValues, dFrom: string, dTo: string) => {
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      const qs = buildQueryString(f, dFrom, dTo);
      const res = await fetchJson<ReportResponse>(`/api/reports/summary?${qs}`, {
        signal: controller.signal,
      });
      setReport(res);
    },
    [buildQueryString]
  );

  const loadInitial = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      await Promise.all([ensureLoaded(), loadReport(filters, dateFrom, dateTo)]);
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") return;
      setError(err instanceof Error ? err.message : "Gagal memuat laporan.");
    } finally {
      setLoading(false);
    }
  }, [dateFrom, dateTo, ensureLoaded, filters, loadReport]);

  useEffect(() => {
    loadInitial();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function applyFilters(nextF: FilterValues, nextFrom = dateFrom, nextTo = dateTo) {
    setFilters(nextF);
    try {
      await loadReport(nextF, nextFrom, nextTo);
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") return;
      setError(err instanceof Error ? err.message : "Gagal memperbarui laporan.");
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-field-bg p-6">
        <LoadingState message="Memuat pusat laporan..." />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-field-bg p-6">
        <ErrorState
          title="Gagal memuat laporan"
          message={error || bootError || "Terjadi gangguan koneksi ke server."}
          onRetry={loadInitial}
        />
      </div>
    );
  }

  const exportUrl = `/api/reports/export?type=recap&${buildQueryString(filters, dateFrom, dateTo)}`;

  return (
    <AppShell
      user={user}
      title="Laporan Kondisi Pompa"
      subtitle="Rekap kondisi unit dan daftar komponen rusak/hilang siap export Excel atau cetak PDF."
    >
      <div className="space-y-5">
        {error && <ErrorState message={error} onRetry={loadInitial} />}

        <div className="no-print space-y-3">
          {master && (
            <HierarchyFilterBar
              master={master}
              values={filters}
              onChange={(next) => applyFilters(next)}
            />
          )}

          <div className="flex flex-wrap items-end justify-between gap-3 rounded-lg border border-field-border bg-field-surface p-4">
            <div className="flex flex-wrap items-end gap-3">
              <div>
                <label
                  htmlFor="report-date-from"
                  className="mb-1 block text-xs font-semibold text-field-muted"
                >
                  Dari Tanggal Periksa
                </label>
                <input
                  id="report-date-from"
                  type="date"
                  value={dateFrom}
                  onChange={(e) => {
                    setDateFrom(e.target.value);
                    applyFilters(filters, e.target.value, dateTo);
                  }}
                  className="min-h-[44px] rounded-md border border-field-border bg-white px-3 text-sm"
                />
              </div>
              <div>
                <label
                  htmlFor="report-date-to"
                  className="mb-1 block text-xs font-semibold text-field-muted"
                >
                  Sampai Tanggal
                </label>
                <input
                  id="report-date-to"
                  type="date"
                  value={dateTo}
                  onChange={(e) => {
                    setDateTo(e.target.value);
                    applyFilters(filters, dateFrom, e.target.value);
                  }}
                  className="min-h-[44px] rounded-md border border-field-border bg-white px-3 text-sm"
                />
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <a
                href={exportUrl}
                className="inline-flex min-h-[44px] items-center gap-2 rounded-md bg-field-accent px-4 text-sm font-semibold text-white hover:bg-field-accent-hover"
              >
                <Download className="h-4 w-4" aria-hidden="true" />
                <span>Export Excel (.xlsx)</span>
              </a>
              <button
                type="button"
                onClick={() => window.print()}
                className="inline-flex min-h-[44px] items-center gap-2 rounded-md border border-field-border bg-field-bg px-4 text-sm font-semibold text-field-ink hover:bg-[#EAEFEA]"
              >
                <Printer className="h-4 w-4" aria-hidden="true" />
                <span>Cetak / PDF</span>
              </button>
            </div>
          </div>
        </div>

        {report && (
          <>
            {/* Print Header */}
            <div className="hidden print-only border-b border-black pb-2">
              <h2 className="text-lg font-bold">
                Laporan Kondisi Pompa - PT TH Indoplantation
              </h2>
              <p className="text-xs">
                Total Unit: {report.totals.total} | Aktif: {report.totals.aktif} | Perlu
                Perbaikan: {report.totals.perluPerbaikan} | Rusak Total:{" "}
                {report.totals.rusakTotal} | Part Bermasalah: {report.totals.totalIssues}
              </p>
            </div>

            {/* ARIA Tabs */}
            <div role="tablist" aria-label="Tampilan laporan" className="no-print flex gap-2">
              <button
                role="tab"
                id="tab-units"
                type="button"
                aria-selected={activeTab === "units"}
                aria-controls="panel-units"
                onClick={() => setActiveTab("units")}
                className={`min-h-[44px] rounded-md border px-4 text-sm font-semibold ${
                  activeTab === "units"
                    ? "border-[#15803D] bg-[#DCFCE7] text-[#166534]"
                    : "border-field-border bg-field-surface text-field-ink"
                }`}
              >
                Rekap Kondisi Unit ({report.pumps.length})
              </button>
              <button
                role="tab"
                id="tab-issues"
                type="button"
                aria-selected={activeTab === "issues"}
                aria-controls="panel-issues"
                onClick={() => setActiveTab("issues")}
                className={`min-h-[44px] rounded-md border px-4 text-sm font-semibold ${
                  activeTab === "issues"
                    ? "border-[#15803D] bg-[#DCFCE7] text-[#166534]"
                    : "border-field-border bg-field-surface text-field-ink"
                }`}
              >
                Part Bermasalah & Hilang ({report.issues.length})
              </button>
            </div>

            {activeTab === "units" && (
              <div
                role="tabpanel"
                id="panel-units"
                aria-labelledby="tab-units"
                className="rounded-lg border border-field-border bg-field-surface"
              >
                {report.pumps.length === 0 ? (
                  <div className="p-4">
                    <EmptyState
                      title="Tidak ada unit pompa pada laporan ini"
                      description="Sesuaikan filter PT, Region, Estate, Block, atau rentang tanggal pemeriksaan."
                    />
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[780px] text-left text-sm">
                      <thead className="border-b border-field-border bg-field-bg text-xs font-semibold text-field-muted">
                        <tr>
                          <th className="px-3 py-3">Kode Pompa</th>
                          <th className="px-3 py-3">Region</th>
                          <th className="px-3 py-3">Estate / Block</th>
                          <th className="px-3 py-3">Jenis Pompa</th>
                          <th className="px-3 py-3">Mesin</th>
                          <th className="px-3 py-3">Status Unit</th>
                          <th className="px-3 py-3 text-right">Temuan</th>
                          <th className="px-3 py-3">Periksa Terakhir</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-field-border">
                        {report.pumps.map((p) => (
                          <tr key={p.id} className="hover:bg-field-bg/60">
                            <td className="px-3 py-2.5 font-mono font-semibold text-field-ink">
                              {p.pumpCode}
                            </td>
                            <td className="px-3 py-2.5 text-xs text-field-muted">
                              {p.regionName}
                            </td>
                            <td className="px-3 py-2.5 font-mono text-xs">
                              {p.estateCode} / {p.blockCode}
                            </td>
                            <td className="px-3 py-2.5">{p.pumpTypeName}</td>
                            <td className="px-3 py-2.5 text-field-muted">{p.engineBrandName}</td>
                            <td className="px-3 py-2.5">
                              <UnitStatusBadge status={p.currentUnitStatus} />
                            </td>
                            <td className="px-3 py-2.5 text-right font-mono tabular-nums">
                              {p.issueCount}
                            </td>
                            <td className="px-3 py-2.5 text-xs text-field-muted">
                              {p.latestInspectedDate
                                ? `${p.latestInspectedDate} (${p.latestInspectorName})`
                                : "-"}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            {activeTab === "issues" && (
              <div
                role="tabpanel"
                id="panel-issues"
                aria-labelledby="tab-issues"
                className="rounded-lg border border-field-border bg-field-surface"
              >
                {report.issues.length === 0 ? (
                  <div className="p-4">
                    <EmptyState
                      title="Tidak ada komponen bermasalah"
                      description="Semua komponen pada unit yang tersaring tercatat Ada dan Baik."
                    />
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[820px] text-left text-sm">
                      <thead className="border-b border-field-border bg-field-bg text-xs font-semibold text-field-muted">
                        <tr>
                          <th className="px-3 py-3">Estate / Block</th>
                          <th className="px-3 py-3">Kode Pompa</th>
                          <th className="px-3 py-3">Bagian</th>
                          <th className="px-3 py-3">Komponen</th>
                          <th className="px-3 py-3 text-right">Qty</th>
                          <th className="px-3 py-3">Ketersediaan</th>
                          <th className="px-3 py-3">Kondisi</th>
                          <th className="px-3 py-3">Temuan & Detail</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-field-border">
                        {report.issues.map((item) => (
                          <tr key={item.id} className="hover:bg-field-bg/60">
                            <td className="px-3 py-2.5 font-mono text-xs">
                              {item.estateCode} / {item.blockCode}
                            </td>
                            <td className="px-3 py-2.5 font-mono font-semibold text-field-ink">
                              {item.pumpCode}
                            </td>
                            <td className="px-3 py-2.5 text-xs text-field-muted">
                              {item.sectionName}
                            </td>
                            <td className="px-3 py-2.5 font-medium text-field-ink">
                              {item.partName}
                            </td>
                            <td className="px-3 py-2.5 text-right font-mono tabular-nums">
                              {item.expectedQty}
                            </td>
                            <td className="px-3 py-2.5">
                              <AvailabilityLabel value={item.availability} />
                            </td>
                            <td className="px-3 py-2.5">
                              <ConditionLabel value={item.condition} />
                            </td>
                            <td className="px-3 py-2.5 text-xs text-field-muted">
                              {item.issueLabel}
                              {item.notes ? ` (${item.notes})` : ""}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </AppShell>
  );
}
