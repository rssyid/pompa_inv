"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, Download, Eye, Printer } from "lucide-react";
import { useAppData } from "@/components/AppDataProvider";
import { AppShell } from "@/components/AppShell";
import {
  FilterValues,
  HierarchyFilterBar,
  MasterTreeData,
} from "@/components/HierarchyFilterBar";
import {
  OperatingHoursPrintReport,
} from "@/components/OperatingHoursPrintReport";
import {
  ReportFilterSummaryItem,
  ReportPrintScope,
  ReportsPrintReport,
  ReportSummaryPayload,
} from "@/components/ReportsPrintReport";
import {
  AvailabilityLabel,
  ConditionLabel,
  UnitStatusBadge,
} from "@/components/StatusBadge";
import { EmptyState, ErrorState, LoadingState } from "@/components/UiStates";
import { fetchJson } from "@/lib/client-fetch";
import type { OperatingHoursMonitoringPayload } from "@/lib/queries/operating-hours";

const STATUS_LABEL_MAP: Record<string, string> = {
  aktif: "Aktif",
  perlu_perbaikan: "Perlu Perbaikan",
  rusak_total: "Rusak Total",
};

function formatNowLabel(): string {
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const dd = String(now.getDate()).padStart(2, "0");
  const hh = String(now.getHours()).padStart(2, "0");
  const min = String(now.getMinutes()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd} ${hh}:${min}`;
}

function buildFilterMeta(
  master: MasterTreeData | null,
  filters: FilterValues,
  dateFrom: string,
  dateTo: string
): { companyTitle: string; filterItems: ReportFilterSummaryItem[] } {
  const selectedCompany = filters.companyId
    ? master?.companies.find((c) => String(c.id) === filters.companyId)
    : undefined;
  const companyTitle = selectedCompany?.name || "PT TH Indoplantation";

  const items: ReportFilterSummaryItem[] = [];
  if (selectedCompany) {
    items.push({ label: "PT", value: selectedCompany.name });
  }
  if (filters.regionId) {
    const region = master?.regions.find((r) => String(r.id) === filters.regionId);
    if (region) items.push({ label: "Region", value: region.name });
  }
  if (filters.estateId) {
    const estate = master?.estates.find((e) => String(e.id) === filters.estateId);
    if (estate) items.push({ label: "Estate", value: estate.code });
  }
  if (filters.blockId) {
    const block = master?.blocks.find((b) => String(b.id) === filters.blockId);
    if (block) items.push({ label: "Block", value: block.code });
  }
  if (filters.pumpTypeId) {
    const pumpType = master?.pumpTypes.find((pt) => String(pt.id) === filters.pumpTypeId);
    if (pumpType) items.push({ label: "Jenis", value: pumpType.name });
  }
  if (filters.status) {
    items.push({
      label: "Status",
      value: STATUS_LABEL_MAP[filters.status] ?? filters.status,
    });
  }
  if (dateFrom || dateTo) {
    items.push({
      label: "Periode",
      value: `${dateFrom || "Awal"} s/d ${dateTo || "Sekarang"}`,
    });
  }
  if (filters.search.trim()) {
    items.push({ label: "Pencarian", value: filters.search.trim() });
  }

  return { companyTitle, filterItems: items };
}

function StackedLines({ lines }: { lines: (string | null | undefined)[] }) {
  const parts = lines.map((l) => (l ?? "").trim()).filter(Boolean);
  if (parts.length === 0) return <>-</>;
  return (
    <>
      {parts.map((part, i) => (
        <span key={i} className="block whitespace-nowrap">
          {part}
        </span>
      ))}
    </>
  );
}

export default function ReportsPage() {
  const { user, master, ensureLoaded, error: bootError } = useAppData();
  const [report, setReport] = useState<ReportSummaryPayload | null>(null);
  const [ohReport, setOhReport] = useState<OperatingHoursMonitoringPayload | null>(null);
  const [activeTab, setActiveTab] = useState<"units" | "issues" | "operating-hours">("units");
  const [previewPrint, setPreviewPrint] = useState(false);
  const [printScope, setPrintScope] = useState<ReportPrintScope>("all");
  const [pageBreakIssues, setPageBreakIssues] = useState(false);
  const [printedAt, setPrintedAt] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [ohMonth, setOhMonth] = useState(() => new Date().toISOString().slice(0, 7));
  const [ohWindowPreset, setOhWindowPreset] = useState<"7d" | "14d" | "full" | "custom">("14d");
  const [ohDateFrom, setOhDateFrom] = useState("");
  const [ohDateTo, setOhDateTo] = useState("");
  const [showMobileMatrix, setShowMobileMatrix] = useState(false);

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
  const [refreshing, setRefreshing] = useState(false);
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

  const buildOhQueryString = useCallback(
    (
      f: FilterValues,
      month: string,
      preset: "7d" | "14d" | "full" | "custom",
      dFrom: string,
      dTo: string
    ) => {
      const params = new URLSearchParams(buildQueryString(f, "", ""));
      params.set("month", month);
      if (preset === "custom") {
        if (dFrom) params.set("dateFrom", dFrom);
        if (dTo) params.set("dateTo", dTo);
      } else {
        params.set("windowPreset", preset);
      }
      return params.toString();
    },
    [buildQueryString]
  );

  const loadReport = useCallback(
    async (
      f: FilterValues,
      dFrom: string,
      dTo: string,
      month = ohMonth,
      preset = ohWindowPreset,
      oFrom = ohDateFrom,
      oTo = ohDateTo
    ) => {
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      const qs = buildQueryString(f, dFrom, dTo);
      const ohQs = buildOhQueryString(f, month, preset, oFrom, oTo);

      const [summaryRes, ohRes] = await Promise.all([
        fetchJson<ReportSummaryPayload>(`/api/reports/summary?${qs}`, {
          signal: controller.signal,
        }),
        fetchJson<OperatingHoursMonitoringPayload>(`/api/reports/operating-hours?${ohQs}`, {
          signal: controller.signal,
        }),
      ]);
      setReport(summaryRes);
      setOhReport(ohRes);
    },
    [buildOhQueryString, buildQueryString, ohDateFrom, ohDateTo, ohMonth, ohWindowPreset]
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
    if (typeof window !== "undefined") {
      const sp = new URLSearchParams(window.location.search);
      const tabParam = sp.get("tab");
      if (tabParam === "operating-hours" || tabParam === "issues" || tabParam === "units") {
        setActiveTab(tabParam);
      }
    }
    loadInitial();
    setPrintedAt(formatNowLabel());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!previewPrint) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setPreviewPrint(false);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [previewPrint]);

  async function applyFilters(
    nextF: FilterValues,
    nextFrom = dateFrom,
    nextTo = dateTo,
    nextOhMonth = ohMonth,
    nextOhPreset = ohWindowPreset,
    nextOhFrom = ohDateFrom,
    nextOhTo = ohDateTo
  ) {
    setFilters(nextF);
    setRefreshing(true);
    setError(null);
    try {
      await loadReport(nextF, nextFrom, nextTo, nextOhMonth, nextOhPreset, nextOhFrom, nextOhTo);
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") return;
      setError(err instanceof Error ? err.message : "Gagal memperbarui laporan.");
    } finally {
      setRefreshing(false);
    }
  }

  function handleOpenPreview() {
    setPrintedAt(formatNowLabel());
    setPreviewPrint(true);
  }

  function handleTriggerPrint() {
    setPrintedAt(formatNowLabel());
    window.requestAnimationFrame(() => {
      window.print();
    });
  }

  const { companyTitle, filterItems } = useMemo(
    () => buildFilterMeta(master, filters, dateFrom, dateTo),
    [master, filters, dateFrom, dateTo]
  );

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

  const exportUrl =
    activeTab === "operating-hours"
      ? `/api/reports/export?type=operating-hours&${buildOhQueryString(
          filters,
          ohMonth,
          ohWindowPreset,
          ohDateFrom,
          ohDateTo
        )}`
      : `/api/reports/export?type=recap&${buildQueryString(filters, dateFrom, dateTo)}`;

  return (
    <AppShell
      user={user}
      title="Laporan Kondisi & Jam Kerja Pompa"
      subtitle="Rekap kondisi unit, daftar komponen bermasalah, serta monitoring jam operasional harian dan bulanan."
    >
      {previewPrint && report ? (
        <div className="space-y-4">
          {/* A4 Preview Toolbar */}
          <div className="no-print flex flex-wrap items-end justify-between gap-3 rounded-lg border border-field-border bg-field-surface p-3 sm:p-4">
            <div className="flex flex-wrap items-end gap-3">
              <button
                type="button"
                onClick={() => setPreviewPrint(false)}
                className="inline-flex min-h-[44px] items-center gap-1.5 rounded-md border border-field-border bg-field-bg px-3 text-sm font-semibold text-field-ink hover:bg-[#EAEFEA]"
              >
                <ArrowLeft className="h-4 w-4" aria-hidden="true" />
                <span>Tutup Pratinjau</span>
              </button>

              {activeTab !== "operating-hours" && (
                <>
                  <div>
                    <label
                      htmlFor="preview-print-scope"
                      className="mb-1 block text-xs font-semibold text-field-muted"
                    >
                      Cakupan Cetak A4
                    </label>
                    <select
                      id="preview-print-scope"
                      value={printScope}
                      onChange={(e) => setPrintScope(e.target.value as ReportPrintScope)}
                      className="min-h-[44px] rounded-md border border-field-border bg-white px-3 text-sm text-field-ink"
                    >
                      <option value="all">Lengkap (Estate + Unit + Temuan)</option>
                      <option value="estate_units">Rekap Estate &amp; Kondisi Unit</option>
                      <option value="issues">Part Bermasalah &amp; Hilang Saja</option>
                    </select>
                  </div>

                  {printScope === "all" && (
                    <label className="inline-flex min-h-[44px] items-center gap-2 rounded-md border border-field-border bg-field-bg px-3 text-xs font-medium text-field-ink">
                      <input
                        type="checkbox"
                        checked={pageBreakIssues}
                        onChange={(e) => setPageBreakIssues(e.target.checked)}
                        className="h-4 w-4 accent-[#15803D]"
                      />
                      <span>Pisah halaman untuk Part Bermasalah</span>
                    </label>
                  )}
                </>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <a
                href={exportUrl}
                className="inline-flex min-h-[44px] items-center gap-2 rounded-md border border-field-border bg-field-bg px-3.5 text-sm font-semibold text-field-ink hover:bg-[#EAEFEA]"
              >
                <Download className="h-4 w-4" aria-hidden="true" />
                <span>Export Excel (.xlsx)</span>
              </a>
              <button
                type="button"
                onClick={handleTriggerPrint}
                className="inline-flex min-h-[44px] items-center gap-2 rounded-md bg-field-accent px-4 text-sm font-semibold text-white hover:bg-field-accent-hover"
              >
                <Printer className="h-4 w-4" aria-hidden="true" />
                <span>Cetak / Simpan PDF</span>
              </button>
            </div>
          </div>

          <p className="no-print text-xs text-field-muted">
            {activeTab === "operating-hours"
              ? "Pratinjau kertas A4 Landscape (297 x 210 mm). Pada layar sempit, geser ke samping untuk memeriksa seluruh kolom tanggal. Tekan Esc untuk menutup."
              : "Pratinjau kertas A4 Portrait (210 x 297 mm). Pada layar sempit, geser kertas ke samping untuk memeriksa kolom sebelum mencetak. Tekan Esc untuk menutup pratinjau."}
          </p>

          <div className="overflow-x-auto rounded-lg border border-field-border bg-[#EAEFEA] p-2 sm:p-5 print:overflow-visible print:border-0 print:bg-transparent print:p-0">
            {activeTab === "operating-hours" && ohReport ? (
              <OperatingHoursPrintReport
                report={ohReport}
                companyTitle={companyTitle}
                forceShow
              />
            ) : (
              <ReportsPrintReport
                report={report}
                scope={printScope}
                companyTitle={companyTitle}
                filterItems={filterItems}
                printedBy={user.name}
                printedAt={printedAt || formatNowLabel()}
                pageBreakBeforeIssues={pageBreakIssues}
                forceShow
              />
            )}
          </div>
        </div>
      ) : (
        <div className="space-y-5 print:hidden" aria-busy={refreshing}>
          {error && <ErrorState message={error} onRetry={loadInitial} />}

          <div className="no-print space-y-3">
            {master && (
              <HierarchyFilterBar
                master={master}
                values={filters}
                onChange={(next) => applyFilters(next)}
              />
            )}

            <div className="flex flex-col gap-3 rounded-lg border border-field-border bg-field-surface p-4 lg:flex-row lg:items-end lg:justify-between">
              {activeTab === "operating-hours" ? (
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  <div>
                    <label
                      htmlFor="oh-month"
                      className="mb-1 block text-xs font-semibold text-field-muted"
                    >
                      Bulan Monitoring
                    </label>
                    <input
                      id="oh-month"
                      type="month"
                      value={ohMonth}
                      onChange={(e) => {
                        const nextMonth = e.target.value;
                        if (!nextMonth) return;
                        setOhMonth(nextMonth);
                        applyFilters(filters, dateFrom, dateTo, nextMonth, ohWindowPreset, "", "");
                      }}
                      className="min-h-[44px] w-full rounded-md border border-field-border bg-white px-3 text-sm text-field-ink"
                    />
                  </div>
                  <div>
                    <label
                      htmlFor="oh-window"
                      className="mb-1 block text-xs font-semibold text-field-muted"
                    >
                      Rentang Kolom Tanggal
                    </label>
                    <select
                      id="oh-window"
                      value={ohWindowPreset}
                      onChange={(e) => {
                        const preset = e.target.value as "7d" | "14d" | "full" | "custom";
                        setOhWindowPreset(preset);
                        if (preset !== "custom") {
                          applyFilters(filters, dateFrom, dateTo, ohMonth, preset, "", "");
                        }
                      }}
                      className="min-h-[44px] w-full rounded-md border border-field-border bg-white px-3 text-sm text-field-ink"
                    >
                      <option value="7d">7 Hari Terakhir</option>
                      <option value="14d">14 Hari Terakhir</option>
                      <option value="full">1 Bulan Penuh</option>
                      <option value="custom">Pilih Tanggal Khusus</option>
                    </select>
                  </div>
                  {ohWindowPreset === "custom" && (
                    <>
                      <div>
                        <label
                          htmlFor="oh-from"
                          className="mb-1 block text-xs font-semibold text-field-muted"
                        >
                          Dari Tanggal
                        </label>
                        <input
                          id="oh-from"
                          type="date"
                          value={ohDateFrom}
                          onChange={(e) => {
                            setOhDateFrom(e.target.value);
                            applyFilters(
                              filters,
                              dateFrom,
                              dateTo,
                              ohMonth,
                              "custom",
                              e.target.value,
                              ohDateTo
                            );
                          }}
                          className="min-h-[44px] w-full rounded-md border border-field-border bg-white px-3 text-sm text-field-ink"
                        />
                      </div>
                      <div>
                        <label
                          htmlFor="oh-to"
                          className="mb-1 block text-xs font-semibold text-field-muted"
                        >
                          Sampai Tanggal
                        </label>
                        <input
                          id="oh-to"
                          type="date"
                          value={ohDateTo}
                          onChange={(e) => {
                            setOhDateTo(e.target.value);
                            applyFilters(
                              filters,
                              dateFrom,
                              dateTo,
                              ohMonth,
                              "custom",
                              ohDateFrom,
                              e.target.value
                            );
                          }}
                          className="min-h-[44px] w-full rounded-md border border-field-border bg-white px-3 text-sm text-field-ink"
                        />
                      </div>
                    </>
                  )}
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
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
                      className="min-h-[44px] w-full rounded-md border border-field-border bg-white px-3 text-sm text-field-ink"
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
                      className="min-h-[44px] w-full rounded-md border border-field-border bg-white px-3 text-sm text-field-ink"
                    />
                  </div>
                  <div>
                    <label
                      htmlFor="report-print-scope"
                      className="mb-1 block text-xs font-semibold text-field-muted"
                    >
                      Cakupan Cetak A4
                    </label>
                    <select
                      id="report-print-scope"
                      value={printScope}
                      onChange={(e) => setPrintScope(e.target.value as ReportPrintScope)}
                      className="min-h-[44px] w-full rounded-md border border-field-border bg-white px-3 text-sm text-field-ink"
                    >
                      <option value="all">Lengkap (Estate + Unit + Temuan)</option>
                      <option value="estate_units">Rekap Estate &amp; Unit</option>
                      <option value="issues">Part Bermasalah Saja</option>
                    </select>
                  </div>
                </div>
              )}

              <div className="flex flex-wrap items-center gap-2">
                <a
                  href={exportUrl}
                  className="inline-flex min-h-[44px] items-center gap-2 rounded-md bg-field-accent px-4 text-sm font-semibold text-white hover:bg-field-accent-hover"
                >
                  <Download className="h-4 w-4" aria-hidden="true" />
                  <span>
                    {activeTab === "operating-hours"
                      ? "Export Excel Monitoring (.xlsx)"
                      : "Export Excel (.xlsx)"}
                  </span>
                </a>
                <button
                  type="button"
                  onClick={handleOpenPreview}
                  disabled={!report}
                  className="inline-flex min-h-[44px] items-center gap-2 rounded-md border border-field-border bg-field-bg px-3.5 text-sm font-semibold text-field-ink hover:bg-[#EAEFEA] disabled:opacity-50"
                >
                  <Eye className="h-4 w-4" aria-hidden="true" />
                  <span>
                    {activeTab === "operating-hours" ? "Pratinjau A4 Landscape" : "Pratinjau A4"}
                  </span>
                </button>
                <button
                  type="button"
                  onClick={handleTriggerPrint}
                  disabled={!report}
                  className="inline-flex min-h-[44px] items-center gap-2 rounded-md border border-field-border bg-field-bg px-3.5 text-sm font-semibold text-field-ink hover:bg-[#EAEFEA] disabled:opacity-50"
                >
                  <Printer className="h-4 w-4" aria-hidden="true" />
                  <span>Cetak / PDF</span>
                </button>
              </div>
            </div>
          </div>

          {refreshing && (
            <p role="status" aria-live="polite" className="text-xs font-medium text-field-muted">
              Memperbarui data laporan...
            </p>
          )}

          {report && (
            <>
              {/* Compact 5-Metric Operational Summary Strip */}
              <section
                aria-label="Ringkasan statistik laporan"
                className="grid grid-cols-2 divide-y divide-field-border overflow-hidden rounded-lg border border-field-border bg-field-surface sm:grid-cols-5 sm:divide-x sm:divide-y-0"
              >
                <div className="px-4 py-3">
                  <p className="text-xs font-semibold text-field-muted">Total Unit</p>
                  <p className="mt-0.5 font-mono text-lg font-bold tabular-nums text-field-ink">
                    {report.totals.total}
                  </p>
                </div>
                <div className="px-4 py-3">
                  <p className="text-xs font-semibold text-[#166534]">Aktif</p>
                  <p className="mt-0.5 font-mono text-lg font-bold tabular-nums text-[#166534]">
                    {report.totals.aktif}
                  </p>
                </div>
                <div className="px-4 py-3">
                  <p className="text-xs font-semibold text-[#92400E]">Perlu Perbaikan</p>
                  <p className="mt-0.5 font-mono text-lg font-bold tabular-nums text-[#92400E]">
                    {report.totals.perluPerbaikan}
                  </p>
                </div>
                <div className="px-4 py-3">
                  <p className="text-xs font-semibold text-[#991B1B]">Rusak Total</p>
                  <p className="mt-0.5 font-mono text-lg font-bold tabular-nums text-[#991B1B]">
                    {report.totals.rusakTotal}
                  </p>
                </div>
                <div className="col-span-2 px-4 py-3 sm:col-span-1">
                  <p className="text-xs font-semibold text-field-muted">Part Bermasalah</p>
                  <p className="mt-0.5 font-mono text-lg font-bold tabular-nums text-field-ink">
                    {report.totals.totalIssues}
                  </p>
                </div>
              </section>

              {/* ARIA Tabs */}
              <div
                role="tablist"
                aria-label="Tampilan laporan"
                className="no-print flex flex-wrap gap-2"
              >
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
                      : "border-field-border bg-field-surface text-field-ink hover:bg-field-bg"
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
                      : "border-field-border bg-field-surface text-field-ink hover:bg-field-bg"
                  }`}
                >
                  Part Bermasalah &amp; Hilang ({report.issues.length})
                </button>
                <button
                  role="tab"
                  id="tab-operating-hours"
                  type="button"
                  aria-selected={activeTab === "operating-hours"}
                  aria-controls="panel-operating-hours"
                  onClick={() => setActiveTab("operating-hours")}
                  className={`min-h-[44px] rounded-md border px-4 text-sm font-semibold ${
                    activeTab === "operating-hours"
                      ? "border-[#15803D] bg-[#DCFCE7] text-[#166534]"
                      : "border-field-border bg-field-surface text-field-ink hover:bg-field-bg"
                  }`}
                >
                  Monitoring Jam Operasional ({ohReport?.totalPumps ?? report.pumps.length})
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
                    <>
                      {/* Mobile Stacked List */}
                      <ul className="divide-y divide-field-border md:hidden">
                        {report.pumps.map((p) => (
                          <li key={p.id} className="space-y-2 p-4 text-sm">
                            <div className="flex items-start justify-between gap-2">
                              <div className="min-w-0">
                                <p className="font-mono font-bold text-field-ink">{p.pumpCode}</p>
                                <p className="text-xs text-field-muted">{p.regionName}</p>
                              </div>
                              <UnitStatusBadge status={p.currentUnitStatus} />
                            </div>
                            <dl className="grid grid-cols-2 gap-2 text-xs">
                              <div>
                                <dt className="text-field-muted">Estate / Block</dt>
                                <dd className="font-mono font-semibold text-field-ink">
                                  {p.estateCode} / {p.blockCode}
                                </dd>
                              </div>
                              <div>
                                <dt className="text-field-muted">Jenis / Mesin</dt>
                                <dd className="text-field-ink">
                                  {p.pumpTypeName} ({p.engineBrandName})
                                </dd>
                              </div>
                              <div>
                                <dt className="text-field-muted">Temuan Part</dt>
                                <dd className="font-mono font-semibold tabular-nums text-field-ink">
                                  {p.issueCount} item
                                </dd>
                              </div>
                              <div>
                                <dt className="text-field-muted">Periksa Terakhir</dt>
                                <dd className="text-field-ink">
                                  {p.latestInspectedDate
                                    ? `${p.latestInspectedDate} (${p.latestInspectorName})`
                                    : "Belum diperiksa"}
                                </dd>
                              </div>
                            </dl>
                          </li>
                        ))}
                      </ul>

                      {/* Tablet & Desktop Table */}
                      <div className="hidden overflow-x-auto md:block">
                        <table className="w-full text-left text-sm">
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
                                  <StackedLines lines={(p.regionName ?? "").split("/")} />
                                </td>
                                <td className="px-3 py-2.5 font-mono text-xs">
                                  <StackedLines lines={[p.estateCode, p.blockCode]} />
                                </td>
                                <td className="px-3 py-2.5">{p.pumpTypeName}</td>
                                <td className="px-3 py-2.5 text-field-muted">
                                  {p.engineBrandName}
                                </td>
                                <td className="px-3 py-2.5">
                                  <UnitStatusBadge status={p.currentUnitStatus} />
                                </td>
                                <td className="px-3 py-2.5 text-right font-mono tabular-nums">
                                  {p.issueCount}
                                </td>
                                <td className="px-3 py-2.5 text-xs text-field-muted">
                                  {p.latestInspectedDate ? (
                                    <>
                                      <span className="block whitespace-nowrap font-mono tabular-nums text-field-ink">
                                        {p.latestInspectedDate}
                                      </span>
                                      <span className="block whitespace-nowrap">
                                        {p.latestInspectorName}
                                      </span>
                                    </>
                                  ) : (
                                    "-"
                                  )}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </>
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
                    <>
                      {/* Mobile Stacked List */}
                      <ul className="divide-y divide-field-border md:hidden">
                        {report.issues.map((item) => (
                          <li key={item.id} className="space-y-2 p-4 text-sm">
                            <div className="flex items-start justify-between gap-2">
                              <div className="min-w-0">
                                <p className="font-semibold text-field-ink">{item.partName}</p>
                                <p className="text-xs text-field-muted">
                                  {item.sectionName} ·{" "}
                                  <span className="font-mono font-semibold text-field-ink">
                                    {item.pumpCode}
                                  </span>{" "}
                                  ({item.estateCode}/{item.blockCode})
                                </p>
                              </div>
                              <span className="font-mono text-xs font-semibold tabular-nums text-field-muted">
                                Qty {item.expectedQty}
                              </span>
                            </div>
                            <div className="flex flex-wrap items-center gap-2">
                              <AvailabilityLabel value={item.availability} />
                              <ConditionLabel value={item.condition} />
                            </div>
                            <p className="text-xs text-field-muted">
                              {item.issueLabel}
                              {item.notes ? ` (${item.notes})` : ""}
                            </p>
                          </li>
                        ))}
                      </ul>

                      {/* Tablet & Desktop Table */}
                      <div className="hidden overflow-x-auto md:block">
                        <table className="w-full text-left text-sm">
                          <thead className="border-b border-field-border bg-field-bg text-xs font-semibold text-field-muted">
                            <tr>
                              <th className="px-3 py-3">Estate / Block</th>
                              <th className="px-3 py-3">Kode Pompa</th>
                              <th className="px-3 py-3">Bagian</th>
                              <th className="px-3 py-3">Komponen</th>
                              <th className="px-3 py-3 text-right">Qty</th>
                              <th className="px-3 py-3">Ketersediaan</th>
                              <th className="px-3 py-3">Kondisi</th>
                              <th className="px-3 py-3">Temuan &amp; Detail</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-field-border">
                            {report.issues.map((item) => (
                              <tr key={item.id} className="hover:bg-field-bg/60">
                                <td className="px-3 py-2.5 font-mono text-xs">
                                  <StackedLines lines={[item.estateCode, item.blockCode]} />
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
                    </>
                  )}
                </div>
              )}
              {activeTab === "operating-hours" && ohReport && (
                <div
                  role="tabpanel"
                  id="panel-operating-hours"
                  aria-labelledby="tab-operating-hours"
                  className="space-y-4"
                >
                  {ohReport.regions.length === 0 ? (
                    <div className="rounded-lg border border-field-border bg-field-surface p-4">
                      <EmptyState
                        title="Tidak ada data pompa pada filter ini"
                        description="Ubah filter PT, Region, Estate, atau Blok untuk melihat monitoring jam operasional."
                      />
                    </div>
                  ) : (
                    <>
                      <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-field-border bg-field-surface px-4 py-3 text-xs">
                        <p className="text-field-muted">
                          Periode tampil:{" "}
                          <span className="font-mono font-semibold text-field-ink">
                            {ohReport.dateFrom} s/d {ohReport.dateTo}
                          </span>{" "}
                          (Total Jam/Bln dihitung penuh sebulan{" "}
                          <span className="font-semibold text-field-ink">
                            {ohReport.monthLabel}
                          </span>
                          )
                        </p>
                        <p className="font-mono font-bold text-[#166534] tabular-nums">
                          Grand Total: {ohReport.grandTotalHoursMonth} jam
                        </p>
                      </div>

                      {/* Mobile Toggle for Full Matrix vs Reflow Cards */}
                      <div className="flex justify-end md:hidden">
                        <button
                          type="button"
                          onClick={() => setShowMobileMatrix((v) => !v)}
                          className="min-h-[44px] rounded-md border border-field-border bg-field-surface px-3 text-xs font-semibold text-field-ink"
                        >
                          {showMobileMatrix ? "Lihat Tampilan Kartu Mobile" : "Lihat Format Tabel Lengkap"}
                        </button>
                      </div>

                      {!showMobileMatrix && (
                        <div className="space-y-4 md:hidden">
                          {ohReport.regions.map((group) => (
                            <section
                              key={group.regionName}
                              className="rounded-lg border border-field-border bg-field-surface"
                            >
                              <div className="flex items-center justify-between gap-2 border-b border-field-border bg-field-bg px-4 py-2.5">
                                <h3 className="text-sm font-bold text-field-ink">
                                  {group.regionName}
                                </h3>
                                <span className="font-mono text-xs font-bold text-[#166534] tabular-nums">
                                  {group.regionTotalHoursMonth} jam
                                </span>
                              </div>
                              <ul className="divide-y divide-field-border">
                                {group.pumps.map((p) => (
                                  <li key={p.pumpId} className="space-y-2 p-3.5 text-xs">
                                    <div className="flex items-start justify-between gap-2">
                                      <div>
                                        <p className="font-mono text-sm font-bold text-field-ink">
                                          {p.no}. {p.pumpCode}
                                        </p>
                                        <p className="text-field-muted">
                                          {p.estateName} /{" "}
                                          <span className="font-mono font-semibold text-field-ink">
                                            {p.blockCode}
                                          </span>{" "}
                                          ({p.pumpTypeShort})
                                        </p>
                                      </div>
                                      <div className="text-right">
                                        <span
                                          className={`inline-block rounded border px-2 py-0.5 font-semibold ${
                                            p.kondisi === "Baik"
                                              ? "border-[#86EFAC] bg-[#DCFCE7] text-[#166534]"
                                              : "border-[#FCA5A5] bg-[#FEE2E2] text-[#991B1B]"
                                          }`}
                                        >
                                          {p.kondisi}
                                        </span>
                                        <p className="mt-1 font-mono font-bold text-field-ink tabular-nums">
                                          {p.totalHoursMonth} jam/bln
                                        </p>
                                      </div>
                                    </div>

                                    {p.isPreOrder ? (
                                      <div className="rounded border border-[#FCD34D] bg-[#FFFBEB] px-2.5 py-1.5 text-center font-bold text-[#92400E]">
                                        PRE ORDER
                                      </div>
                                    ) : (
                                      <div className="flex gap-1.5 overflow-x-auto pb-1">
                                        {p.cells.map((c, cIdx) => {
                                          const colMeta = ohReport.dates[cIdx];
                                          return (
                                            <div
                                              key={c.date}
                                              className={`min-w-[40px] shrink-0 rounded border text-center ${
                                                c.type === "rusak"
                                                  ? "border-[#DC2626] bg-[#DC2626] text-white"
                                                  : "border-field-border bg-field-bg text-field-ink"
                                              }`}
                                            >
                                              <div
                                                className={`border-b px-1 py-0.5 font-mono text-[10px] font-bold ${
                                                  c.type === "rusak"
                                                    ? "border-white/30 text-white"
                                                    : colMeta?.isSunday
                                                      ? "border-field-border bg-[#FEE2E2] text-[#DC2626]"
                                                      : "border-field-border text-field-muted"
                                                }`}
                                              >
                                                {colMeta?.day}
                                              </div>
                                              <div className="px-1 py-1 font-mono text-xs font-bold tabular-nums">
                                                {c.value}
                                              </div>
                                            </div>
                                          );
                                        })}
                                      </div>
                                    )}

                                    <p className="text-field-muted">
                                      {p.operationalNote}
                                      {p.repairStatus ? ` • Status: ${p.repairStatus}` : ""}
                                    </p>
                                  </li>
                                ))}
                              </ul>
                            </section>
                          ))}
                        </div>
                      )}

                      <div className={showMobileMatrix ? "block" : "hidden md:block"}>
                        <OperatingHoursPrintReport
                          report={ohReport}
                          companyTitle={companyTitle}
                          screenInteractive
                        />
                      </div>
                    </>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      )}

      {!previewPrint && report && (
        activeTab === "operating-hours" && ohReport ? (
          <OperatingHoursPrintReport report={ohReport} companyTitle={companyTitle} />
        ) : (
          <ReportsPrintReport
            report={report}
            scope={printScope}
            companyTitle={companyTitle}
            filterItems={filterItems}
            printedBy={user.name}
            printedAt={printedAt || formatNowLabel()}
            pageBreakBeforeIssues={pageBreakIssues}
          />
        )
      )}
    </AppShell>
  );
}
