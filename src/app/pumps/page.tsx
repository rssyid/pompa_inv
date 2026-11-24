"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useAppData } from "@/components/AppDataProvider";
import { AppShell } from "@/components/AppShell";
import {
  PumpLocationDialog,
  PumpOperationalEditable,
} from "@/components/PumpLocationDialog";
import { EmptyState, ErrorState, LoadingState } from "@/components/UiStates";
import { FleetReadinessPanel } from "@/components/pumps/FleetReadinessPanel";
import { PumpCardGrid } from "@/components/pumps/PumpCardGrid";
import { PumpDataTable } from "@/components/pumps/PumpDataTable";
import {
  HierarchyScopeFilters,
  PumpToolbar,
  PumpViewMode,
} from "@/components/pumps/PumpToolbar";
import { EnrichedPump, fetchJson } from "@/lib/client-fetch";
import {
  computeFleetInsights,
  getMonthBoundsFromDate,
  getTodayIsoDate,
  matchesInsightFilter,
  matchesPumpSearch,
  PumpInsightFilter,
  PumpSortDirection,
  PumpSortKey,
  sortPumps,
} from "@/lib/pump-insights";

interface PumpsInsightsResponse {
  pumps: EnrichedPump[];
  monthLabel?: string;
  referenceDate?: string;
}

const EMPTY_HIERARCHY: HierarchyScopeFilters = {
  companyId: "",
  regionId: "",
  estateId: "",
  blockId: "",
  pumpTypeId: "",
};

export default function PumpsListPage() {
  const { user, master, ensureLoaded, refreshMaster, error: bootError } = useAppData();

  const [pumps, setPumps] = useState<EnrichedPump[]>([]);
  const [referenceDate, setReferenceDate] = useState<string>(() => getTodayIsoDate());
  const [monthLabel, setMonthLabel] = useState<string>(
    () => getMonthBoundsFromDate(getTodayIsoDate()).monthLabel
  );

  const [hierarchy, setHierarchy] = useState<HierarchyScopeFilters>(EMPTY_HIERARCHY);
  const [insightFilter, setInsightFilter] = useState<PumpInsightFilter>("all");
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState<PumpSortKey>("estate_order");
  const [sortDirection, setSortDirection] = useState<PumpSortDirection>("asc");
  const [viewMode, setViewMode] = useState<PumpViewMode>("table");
  const [expandedIds, setExpandedIds] = useState<Set<number>>(() => new Set());

  const [dialogState, setDialogState] = useState<{
    pump: PumpOperationalEditable;
    tab: "location" | "operational";
  } | null>(null);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const loadPumps = useCallback(async (scope: HierarchyScopeFilters) => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    const params = new URLSearchParams();
    params.set("includeInsights", "true");
    if (scope.companyId) params.set("companyId", scope.companyId);
    if (scope.regionId) params.set("regionId", scope.regionId);
    if (scope.estateId) params.set("estateId", scope.estateId);
    if (scope.blockId) params.set("blockId", scope.blockId);
    if (scope.pumpTypeId) params.set("pumpTypeId", scope.pumpTypeId);

    const data = await fetchJson<PumpsInsightsResponse>(
      `/api/pumps?${params.toString()}`,
      { signal: controller.signal }
    );
    setPumps(data.pumps);
    if (data.referenceDate) setReferenceDate(data.referenceDate);
    if (data.monthLabel) setMonthLabel(data.monthLabel);
  }, []);

  const loadInitial = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      await Promise.all([ensureLoaded(), loadPumps(hierarchy)]);
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") return;
      setError(err instanceof Error ? err.message : "Gagal memuat daftar pompa.");
    } finally {
      setLoading(false);
    }
  }, [ensureLoaded, hierarchy, loadPumps]);

  useEffect(() => {
    loadInitial();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleHierarchyChange(next: HierarchyScopeFilters) {
    setHierarchy(next);
    setRefreshing(true);
    setError(null);
    setNotice(null);
    try {
      await loadPumps(next);
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") return;
      setError(err instanceof Error ? err.message : "Gagal menyaring daftar pompa.");
    } finally {
      setRefreshing(false);
    }
  }

  function handleResetAll() {
    const hadHierarchy = Object.values(hierarchy).some(Boolean);
    setInsightFilter("all");
    setSearch("");
    setNotice(null);
    if (hadHierarchy) {
      void handleHierarchyChange(EMPTY_HIERARCHY);
    } else {
      setHierarchy(EMPTY_HIERARCHY);
    }
  }

  function handleToggleExpand(pumpId: number) {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(pumpId)) next.delete(pumpId);
      else next.add(pumpId);
      return next;
    });
  }

  function handleOpenDialog(pump: EnrichedPump, tab: "location" | "operational") {
    setDialogState({
      tab,
      pump: {
        id: pump.id,
        pumpCode: pump.pumpCode,
        currentUnitStatus: pump.currentUnitStatus,
        estateId: pump.estateId,
        blockId: pump.blockId,
        blockCode: pump.blockCode,
        estateCode: pump.estateCode,
        operationalNote: pump.operationalNote,
        operationalCategory: pump.operationalCategory,
        repairStatus: pump.repairStatus,
        isPreOrder: pump.isPreOrder,
        breakdownStartDate: pump.breakdownStartDate,
      },
    });
  }

  const fleetInsights = useMemo(
    () => computeFleetInsights(pumps, referenceDate),
    [pumps, referenceDate]
  );

  const visiblePumps = useMemo(() => {
    const narrowed = pumps.filter(
      (pump) =>
        matchesInsightFilter(pump, insightFilter, referenceDate) &&
        matchesPumpSearch(pump, search)
    );
    return sortPumps(narrowed, sortKey, sortDirection, referenceDate);
  }, [insightFilter, pumps, referenceDate, search, sortDirection, sortKey]);

  const hasAnyFilter =
    Object.values(hierarchy).some(Boolean) ||
    insightFilter !== "all" ||
    search.trim().length > 0;

  if (loading) {
    return (
      <div className="min-h-screen bg-field-bg p-6">
        <LoadingState message="Memuat daftar dan insight unit pompa..." />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-field-bg p-6">
        <ErrorState
          title="Gagal memuat halaman daftar pompa"
          message={error || bootError || "Terjadi gangguan koneksi ke server."}
          onRetry={loadInitial}
        />
      </div>
    );
  }

  const subtitle =
    visiblePumps.length !== pumps.length
      ? `Menampilkan ${visiblePumps.length} dari ${pumps.length} unit pompa aktif di PT TH Indoplantation.`
      : `Menampilkan ${pumps.length} unit pompa aktif di PT TH Indoplantation.`;

  return (
    <AppShell user={user} title="Daftar Unit Pompa" subtitle={subtitle}>
      <div className="space-y-4">
        {error && <ErrorState message={error} onRetry={loadInitial} />}

        {notice && (
          <div
            role="status"
            aria-live="polite"
            className="rounded-md border border-[#86EFAC] bg-[#DCFCE7] px-4 py-3 text-sm font-semibold text-[#166534]"
          >
            {notice}
          </div>
        )}

        {/* Zone 1: Fleet Readiness & Actionable Insight Quick Filters */}
        <FleetReadinessPanel
          insights={fleetInsights}
          monthLabel={monthLabel}
          activeFilter={insightFilter}
          onSelectFilter={(next) => setInsightFilter(next)}
        />

        {/* Zone 2: Lightweight Search, Collapsible Hierarchy Filter & View/Sort Controls */}
        <PumpToolbar
          master={master}
          hierarchy={hierarchy}
          onChangeHierarchy={handleHierarchyChange}
          search={search}
          onChangeSearch={setSearch}
          insightFilter={insightFilter}
          onClearInsightFilter={() => setInsightFilter("all")}
          sortKey={sortKey}
          sortDirection={sortDirection}
          onChangeSort={(key, dir) => {
            setSortKey(key);
            setSortDirection(dir);
          }}
          viewMode={viewMode}
          onChangeViewMode={setViewMode}
          onResetAll={handleResetAll}
        />

        {/* Status Bar Above Data */}
        <div className="flex flex-wrap items-center justify-between gap-2 px-0.5 text-xs text-field-muted">
          <p role="status" aria-live="polite">
            {refreshing ? (
              <span className="font-semibold text-field-ink">
                Memperbarui cakupan pompa...
              </span>
            ) : visiblePumps.length === pumps.length ? (
              <span>
                Menampilkan seluruh{" "}
                <strong className="font-mono font-semibold tabular-nums text-field-ink">
                  {visiblePumps.length}
                </strong>{" "}
                unit pada cakupan lokasi saat ini. Klik panah di kiri kode unit untuk membuka
                rincian komponen &amp; aksi cepat.
              </span>
            ) : (
              <span>
                Menyaring{" "}
                <strong className="font-mono font-semibold tabular-nums text-field-ink">
                  {visiblePumps.length}
                </strong>{" "}
                dari{" "}
                <strong className="font-mono font-semibold tabular-nums text-field-ink">
                  {pumps.length}
                </strong>{" "}
                unit sesuai filter atau kata kunci.
              </span>
            )}
          </p>

          {expandedIds.size > 0 && (
            <button
              type="button"
              onClick={() => setExpandedIds(new Set())}
              className="inline-flex min-h-[36px] items-center rounded-md border border-field-border bg-field-surface px-2.5 text-xs font-semibold text-field-ink hover:bg-[#EAEFEA]"
            >
              Tutup Semua Rincian ({expandedIds.size})
            </button>
          )}
        </div>

        {/* Zone 3: Data View */}
        {visiblePumps.length === 0 ? (
          hasAnyFilter ? (
            <EmptyState
              title="Tidak ada pompa yang cocok dengan filter aktif"
              description="Coba longgarkan pilihan insight, kata kunci pencarian, atau filter lokasi Estate/Block untuk melihat unit lainnya."
              actionLabel="Reset Semua Filter"
              onAction={handleResetAll}
            />
          ) : (
            <EmptyState
              title="Belum ada unit pompa aktif terdaftar"
              description="Tambahkan unit pompa baru melalui menu Admin Kelola Pompa atau unggah rekap melalui Import Excel."
            />
          )
        ) : viewMode === "cards" ? (
          <PumpCardGrid
            pumps={visiblePumps}
            referenceDate={referenceDate}
            monthLabel={monthLabel}
            expandedIds={expandedIds}
            onToggleExpand={handleToggleExpand}
            onOpenDialog={handleOpenDialog}
          />
        ) : (
          <>
            <div className="md:hidden">
              <PumpCardGrid
                pumps={visiblePumps}
                referenceDate={referenceDate}
                monthLabel={monthLabel}
                expandedIds={expandedIds}
                onToggleExpand={handleToggleExpand}
                onOpenDialog={handleOpenDialog}
              />
            </div>
            <div className="hidden md:block">
              <PumpDataTable
                pumps={visiblePumps}
                referenceDate={referenceDate}
                monthLabel={monthLabel}
                sortKey={sortKey}
                sortDirection={sortDirection}
                onChangeSort={(key, dir) => {
                  setSortKey(key);
                  setSortDirection(dir);
                }}
                expandedIds={expandedIds}
                onToggleExpand={handleToggleExpand}
                onOpenDialog={handleOpenDialog}
              />
            </div>
          </>
        )}
      </div>

      {dialogState && master && (
        <PumpLocationDialog
          pump={dialogState.pump}
          master={master}
          initialTab={dialogState.tab}
          onClose={() => setDialogState(null)}
          onSaved={async (createdBlock) => {
            const targetCode = dialogState.pump.pumpCode;
            if (createdBlock) {
              await refreshMaster();
            }
            await loadPumps(hierarchy);
            setNotice(`Lokasi atau info operasional pompa ${targetCode} berhasil diperbarui.`);
          }}
        />
      )}
    </AppShell>
  );
}
