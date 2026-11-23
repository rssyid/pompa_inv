"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ArrowRight, ClipboardCheck } from "lucide-react";
import { useAppData } from "@/components/AppDataProvider";
import { AppShell } from "@/components/AppShell";
import {
  FilterValues,
  HierarchyFilterBar,
} from "@/components/HierarchyFilterBar";
import { UnitStatusBadge } from "@/components/StatusBadge";
import { EmptyState, ErrorState, LoadingState } from "@/components/UiStates";
import { EnrichedPump, fetchJson } from "@/lib/client-fetch";

interface ReportSummaryResponse {
  totals: {
    total: number;
    aktif: number;
    perluPerbaikan: number;
    rusakTotal: number;
    totalIssues: number;
  };
  byEstate: Array<{
    estateId: number;
    estateCode: string;
    regionName: string;
    total: number;
    aktif: number;
    perluPerbaikan: number;
    rusakTotal: number;
    issueCount: number;
  }>;
  pumps: EnrichedPump[];
}

export default function DashboardPage() {
  const { user, master, ensureLoaded, error: bootError } = useAppData();
  const [summary, setSummary] = useState<ReportSummaryResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
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

  const loadSummary = useCallback(async (f: FilterValues) => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    const params = new URLSearchParams();
    if (f.companyId) params.set("companyId", f.companyId);
    if (f.regionId) params.set("regionId", f.regionId);
    if (f.estateId) params.set("estateId", f.estateId);
    if (f.blockId) params.set("blockId", f.blockId);
    if (f.pumpTypeId) params.set("pumpTypeId", f.pumpTypeId);
    if (f.status) params.set("status", f.status);
    if (f.search) params.set("search", f.search);

    const data = await fetchJson<ReportSummaryResponse>(
      `/api/reports/summary?${params.toString()}`,
      { signal: controller.signal }
    );
    setSummary(data);
  }, []);

  const loadInitial = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      await Promise.all([ensureLoaded(), loadSummary(filters)]);
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") return;
      setError(err instanceof Error ? err.message : "Gagal memuat ringkasan pompa.");
    } finally {
      setLoading(false);
    }
  }, [ensureLoaded, filters, loadSummary]);

  useEffect(() => {
    loadInitial();
    // Load initial dashboard once on mount; filter updates call handleFilterChange
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleFilterChange(next: FilterValues) {
    setFilters(next);
    try {
      await loadSummary(next);
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") return;
      setError(err instanceof Error ? err.message : "Gagal menyaring data.");
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-field-bg p-6">
        <LoadingState message="Memuat ringkasan kondisi pompa..." />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-field-bg p-6">
        <ErrorState
          title="Gagal memuat ringkasan pompa"
          message={error || bootError || "Terjadi gangguan koneksi ke server."}
          onRetry={loadInitial}
        />
      </div>
    );
  }

  const urgentPumps =
    summary?.pumps.filter((p) => p.currentUnitStatus !== "aktif") ?? [];

  return (
    <AppShell
      user={user}
      title="Ringkasan Kondisi Pompa"
      subtitle="Pantau unit yang membutuhkan perbaikan dan tindak lanjut per Estate."
    >
      <div className="space-y-6">
        {error && <ErrorState message={error} onRetry={loadInitial} />}

        {master && (
          <HierarchyFilterBar
            master={master}
            values={filters}
            onChange={handleFilterChange}
            showSearch={false}
          />
        )}

        {summary && (
          <>
            {/* Real summary numbers with primary focus on problem units */}
            <section aria-label="Ringkasan jumlah unit" className="grid grid-cols-2 gap-3 lg:grid-cols-5">
              <div className="rounded-lg border border-field-border bg-field-surface p-4">
                <p className="text-xs font-semibold text-field-muted">Total Unit</p>
                <p className="mt-1 font-mono text-2xl font-bold tabular-nums text-field-ink">
                  {summary.totals.total}
                </p>
              </div>
              <div className="rounded-lg border border-[#86EFAC] bg-[#F0FDF4] p-4">
                <p className="text-xs font-semibold text-[#166534]">Aktif</p>
                <p className="mt-1 font-mono text-2xl font-bold tabular-nums text-[#166534]">
                  {summary.totals.aktif}
                </p>
              </div>
              <div className="rounded-lg border border-[#FCD34D] bg-[#FFFBEB] p-4">
                <p className="text-xs font-semibold text-[#92400E]">Perlu Perbaikan</p>
                <p className="mt-1 font-mono text-2xl font-bold tabular-nums text-[#92400E]">
                  {summary.totals.perluPerbaikan}
                </p>
              </div>
              <div className="rounded-lg border border-[#FCA5A5] bg-[#FEF2F2] p-4">
                <p className="text-xs font-semibold text-[#991B1B]">Rusak Total</p>
                <p className="mt-1 font-mono text-2xl font-bold tabular-nums text-[#991B1B]">
                  {summary.totals.rusakTotal}
                </p>
              </div>
              <div className="col-span-2 rounded-lg border border-field-border bg-field-surface p-4 lg:col-span-1">
                <p className="text-xs font-semibold text-field-muted">Part Bermasalah</p>
                <p className="mt-1 font-mono text-2xl font-bold tabular-nums text-field-ink">
                  {summary.totals.totalIssues}
                </p>
              </div>
            </section>

            {/* Rekap per Estate */}
            <section aria-label="Rekap kondisi per Estate" className="rounded-lg border border-field-border bg-field-surface">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-field-border px-4 py-3">
                <h2 className="text-base font-bold text-field-ink">Kondisi per Estate</h2>
                <Link
                  href="/reports"
                  className="inline-flex min-h-[44px] items-center gap-1.5 rounded-md border border-field-border bg-field-bg px-3 text-sm font-semibold text-field-ink hover:bg-[#EAEFEA]"
                >
                  <span>Buka Laporan Lengkap</span>
                  <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </Link>
              </div>

              {summary.byEstate.length === 0 ? (
                <div className="p-4">
                  <EmptyState
                    title="Belum ada pompa pada filter ini"
                    description="Ubah pilihan PT, Region, Estate, atau tambahkan unit pompa melalui menu Admin."
                  />
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[560px] text-left text-sm">
                    <thead className="border-b border-field-border bg-field-bg text-xs font-semibold text-field-muted">
                      <tr>
                        <th className="px-4 py-3">Estate</th>
                        <th className="px-4 py-3">Region</th>
                        <th className="px-4 py-3 text-right">Total</th>
                        <th className="px-4 py-3 text-right">Aktif</th>
                        <th className="px-4 py-3 text-right">Perbaikan</th>
                        <th className="px-4 py-3 text-right">Rusak</th>
                        <th className="px-4 py-3 text-right">Part Bermasalah</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-field-border">
                      {summary.byEstate.map((row) => (
                        <tr key={row.estateId} className="hover:bg-field-bg/60">
                          <td className="px-4 py-3 font-mono font-semibold text-field-ink">
                            {row.estateCode}
                          </td>
                          <td className="px-4 py-3 text-field-muted">{row.regionName}</td>
                          <td className="px-4 py-3 text-right font-mono tabular-nums">{row.total}</td>
                          <td className="px-4 py-3 text-right font-mono font-semibold tabular-nums text-[#166534]">
                            {row.aktif}
                          </td>
                          <td className="px-4 py-3 text-right font-mono font-semibold tabular-nums text-[#92400E]">
                            {row.perluPerbaikan}
                          </td>
                          <td className="px-4 py-3 text-right font-mono font-semibold tabular-nums text-[#991B1B]">
                            {row.rusakTotal}
                          </td>
                          <td className="px-4 py-3 text-right font-mono tabular-nums">
                            {row.issueCount}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>

            {/* Unit Membutuhkan Tindak Lanjut */}
            <section aria-label="Unit pompa perlu perhatian" className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="text-base font-bold text-field-ink">
                  Unit Membutuhkan Tindak Lanjut ({urgentPumps.length})
                </h2>
                <Link
                  href="/pumps"
                  className="inline-flex min-h-[44px] items-center text-sm font-semibold text-field-accent hover:underline"
                >
                  Lihat semua pompa
                </Link>
              </div>

              {urgentPumps.length === 0 ? (
                <EmptyState
                  title="Tidak ada unit bermasalah"
                  description="Seluruh pompa pada filter yang dipilih berstatus Aktif."
                />
              ) : (
                <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                  {urgentPumps.slice(0, 12).map((pump) => (
                    <article
                      key={pump.id}
                      className="flex flex-col justify-between gap-3 rounded-lg border border-field-border bg-field-surface p-4"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="font-mono text-base font-bold text-field-ink">
                            {pump.pumpCode}
                          </p>
                          <p className="mt-0.5 text-xs text-field-muted">
                            {pump.estateCode} / Blok {pump.blockCode} • {pump.pumpTypeName} •{" "}
                            {pump.engineBrandName}
                          </p>
                        </div>
                        <UnitStatusBadge status={pump.currentUnitStatus} />
                      </div>

                      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-field-border pt-3 text-xs text-field-muted">
                        <span>
                          Temuan:{" "}
                          <strong className="font-mono text-field-ink">{pump.issueCount}</strong> part
                          {pump.latestInspectedDate
                            ? ` • Periksa ${pump.latestInspectedDate}`
                            : ""}
                        </span>
                        <div className="flex items-center gap-2">
                          <Link
                            href={`/pumps/${pump.id}`}
                            className="inline-flex min-h-[44px] items-center rounded-md border border-field-border bg-field-bg px-3 text-xs font-semibold text-field-ink hover:bg-[#EAEFEA]"
                          >
                            Detail
                          </Link>
                          <Link
                            href={`/pumps/${pump.id}/inspect`}
                            className="inline-flex min-h-[44px] items-center gap-1.5 rounded-md bg-field-accent px-3 text-xs font-semibold text-white hover:bg-field-accent-hover"
                          >
                            <ClipboardCheck className="h-4 w-4" aria-hidden="true" />
                            <span>Periksa</span>
                          </Link>
                        </div>
                      </div>
                    </article>
                  ))}
                </div>
              )}
            </section>
          </>
        )}
      </div>
    </AppShell>
  );
}
