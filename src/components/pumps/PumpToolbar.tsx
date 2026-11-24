"use client";

import { useState } from "react";
import {
  ArrowDownUp,
  LayoutGrid,
  RotateCcw,
  Search,
  SlidersHorizontal,
  Table2,
  X,
} from "lucide-react";
import { MasterTreeData } from "@/components/HierarchyFilterBar";
import {
  PumpInsightFilter,
  PumpSortDirection,
  PumpSortKey,
  SORT_OPTIONS,
  STALE_INSPECTION_DAYS,
} from "@/lib/pump-insights";

export interface HierarchyScopeFilters {
  companyId: string;
  regionId: string;
  estateId: string;
  blockId: string;
  pumpTypeId: string;
}

export type PumpViewMode = "table" | "cards";

const INSIGHT_LABELS: Record<PumpInsightFilter, string> = {
  all: "Semua Unit",
  attention: "Perlu Tindak Lanjut",
  aktif: "Aktif",
  perlu_perbaikan: "Perlu Perbaikan",
  rusak_total: "Rusak Total",
  pre_order: "Pre-Order (PO)",
  unassigned_or_wsc: "Belum Assign / WSC",
  stale_inspection: `Inspeksi > ${STALE_INSPECTION_DAYS} Hr`,
};

export function PumpToolbar({
  master,
  hierarchy,
  onChangeHierarchy,
  search,
  onChangeSearch,
  insightFilter,
  onClearInsightFilter,
  sortKey,
  sortDirection,
  onChangeSort,
  viewMode,
  onChangeViewMode,
  onResetAll,
}: {
  master: MasterTreeData | null;
  hierarchy: HierarchyScopeFilters;
  onChangeHierarchy: (next: HierarchyScopeFilters) => void;
  search: string;
  onChangeSearch: (next: string) => void;
  insightFilter: PumpInsightFilter;
  onClearInsightFilter: () => void;
  sortKey: PumpSortKey;
  sortDirection: PumpSortDirection;
  onChangeSort: (key: PumpSortKey, direction: PumpSortDirection) => void;
  viewMode: PumpViewMode;
  onChangeViewMode: (next: PumpViewMode) => void;
  onResetAll: () => void;
}) {
  const [drawerOpen, setDrawerOpen] = useState(false);

  const activeHierarchyCount = [
    hierarchy.companyId,
    hierarchy.regionId,
    hierarchy.estateId,
    hierarchy.blockId,
    hierarchy.pumpTypeId,
  ].filter(Boolean).length;

  const filteredRegions = master
    ? hierarchy.companyId
      ? master.regions.filter((r) => String(r.companyId) === hierarchy.companyId)
      : master.regions
    : [];

  const regionIds = new Set(filteredRegions.map((r) => r.id));
  const filteredEstates = master
    ? hierarchy.regionId
      ? master.estates.filter((e) => String(e.regionId) === hierarchy.regionId)
      : master.estates.filter((e) => regionIds.has(e.regionId))
    : [];

  const estateIds = new Set(filteredEstates.map((e) => e.id));
  const filteredBlocks = master
    ? hierarchy.estateId
      ? master.blocks.filter((b) => String(b.estateId) === hierarchy.estateId)
      : master.blocks.filter((b) => estateIds.has(b.estateId))
    : [];

  function updateHierarchyField(field: keyof HierarchyScopeFilters, value: string) {
    const next: HierarchyScopeFilters = { ...hierarchy, [field]: value };
    if (field === "companyId") {
      next.regionId = "";
      next.estateId = "";
      next.blockId = "";
    } else if (field === "regionId") {
      next.estateId = "";
      next.blockId = "";
    } else if (field === "estateId") {
      next.blockId = "";
    }
    onChangeHierarchy(next);
  }

  const activeTags: Array<{ key: string; label: string; onRemove: () => void }> = [];

  if (hierarchy.companyId && master) {
    const company = master.companies.find((c) => String(c.id) === hierarchy.companyId);
    activeTags.push({
      key: "company",
      label: `PT: ${company?.code || company?.name || hierarchy.companyId}`,
      onRemove: () => updateHierarchyField("companyId", ""),
    });
  }
  if (hierarchy.regionId && master) {
    const region = master.regions.find((r) => String(r.id) === hierarchy.regionId);
    activeTags.push({
      key: "region",
      label: `Region: ${region?.name || hierarchy.regionId}`,
      onRemove: () => updateHierarchyField("regionId", ""),
    });
  }
  if (hierarchy.estateId && master) {
    const estate = master.estates.find((e) => String(e.id) === hierarchy.estateId);
    activeTags.push({
      key: "estate",
      label: `Estate: ${estate?.code || hierarchy.estateId}`,
      onRemove: () => updateHierarchyField("estateId", ""),
    });
  }
  if (hierarchy.blockId && master) {
    const block = master.blocks.find((b) => String(b.id) === hierarchy.blockId);
    activeTags.push({
      key: "block",
      label: `Block: ${block?.code || hierarchy.blockId}`,
      onRemove: () => updateHierarchyField("blockId", ""),
    });
  }
  if (hierarchy.pumpTypeId && master) {
    const pumpType = master.pumpTypes.find((pt) => String(pt.id) === hierarchy.pumpTypeId);
    activeTags.push({
      key: "pumpType",
      label: `Jenis: ${pumpType?.name || hierarchy.pumpTypeId}`,
      onRemove: () => updateHierarchyField("pumpTypeId", ""),
    });
  }
  if (insightFilter !== "all") {
    activeTags.push({
      key: "insight",
      label: `Insight: ${INSIGHT_LABELS[insightFilter]}`,
      onRemove: onClearInsightFilter,
    });
  }
  if (search.trim()) {
    activeTags.push({
      key: "search",
      label: `Cari: "${search.trim()}"`,
      onRemove: () => onChangeSearch(""),
    });
  }

  return (
    <section
      aria-label="Pencarian, filter lokasi, dan pengaturan tampilan"
      className="space-y-2.5 rounded-lg border border-field-border bg-field-surface p-3.5 sm:p-4"
    >
      <div className="flex flex-col gap-2.5 lg:flex-row lg:items-center">
        {/* Quick Search */}
        <div className="relative min-w-0 flex-1">
          <label htmlFor="pumps-quick-search" className="sr-only">
            Cari kode pompa, blok, estate, part bermasalah, atau catatan
          </label>
          <Search
            className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-field-muted"
            aria-hidden="true"
          />
          <input
            id="pumps-quick-search"
            type="search"
            value={search}
            onChange={(e) => onChangeSearch(e.target.value)}
            placeholder="Cari kode pompa, blok, part rusak, merek, atau catatan..."
            className="min-h-[44px] w-full rounded-md border border-field-border bg-white pr-11 pl-9 text-sm text-field-ink placeholder:text-field-muted/80"
          />
          {search && (
            <button
              type="button"
              onClick={() => onChangeSearch("")}
              aria-label="Kosongkan kata kunci pencarian"
              className="absolute top-0 right-0 inline-flex h-[44px] w-[44px] items-center justify-center rounded-r-md text-field-muted hover:text-field-ink"
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </button>
          )}
        </div>

        {/* Controls Group */}
        <div className="flex flex-wrap items-center gap-2">
          {master && (
            <button
              type="button"
              aria-expanded={drawerOpen}
              aria-controls="pumps-hierarchy-drawer"
              onClick={() => setDrawerOpen((prev) => !prev)}
              className={`inline-flex min-h-[44px] items-center gap-2 rounded-md border px-3.5 text-xs font-semibold transition-colors ${
                drawerOpen || activeHierarchyCount > 0
                  ? "border-[#15803D] bg-[#DCFCE7] text-[#166534]"
                  : "border-field-border bg-field-bg text-field-ink hover:bg-[#EAEFEA]"
              }`}
            >
              <SlidersHorizontal className="h-4 w-4 shrink-0" aria-hidden="true" />
              <span>Filter Lokasi &amp; Jenis</span>
              {activeHierarchyCount > 0 && (
                <span className="rounded bg-[#15803D] px-1.5 py-0.5 font-mono text-[11px] font-bold text-white tabular-nums">
                  {activeHierarchyCount}
                </span>
              )}
            </button>
          )}

          <div className="flex min-w-0 flex-1 items-center gap-1.5 sm:flex-initial">
            <label htmlFor="pumps-sort-select" className="sr-only">
              Urutkan daftar pompa
            </label>
            <select
              id="pumps-sort-select"
              value={sortKey}
              onChange={(e) => onChangeSort(e.target.value as PumpSortKey, "asc")}
              className="min-h-[44px] min-w-0 flex-1 rounded-md border border-field-border bg-white px-3 text-xs font-semibold text-field-ink sm:flex-initial"
            >
              {SORT_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  Urut: {opt.label}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={() =>
                onChangeSort(sortKey, sortDirection === "asc" ? "desc" : "asc")
              }
              aria-label={
                sortDirection === "asc"
                  ? "Balik urutan menjadi menurun"
                  : "Balik urutan menjadi menaik"
              }
              title={sortDirection === "asc" ? "Urutan standar" : "Urutan dibalik"}
              className={`inline-flex h-[44px] w-[44px] shrink-0 items-center justify-center rounded-md border transition-colors ${
                sortDirection === "desc"
                  ? "border-[#15803D] bg-[#DCFCE7] text-[#166534]"
                  : "border-field-border bg-field-bg text-field-ink hover:bg-[#EAEFEA]"
              }`}
            >
              <ArrowDownUp className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>

          {/* Desktop & Tablet View Mode Switcher */}
          <div
            role="group"
            aria-label="Mode tampilan daftar pompa"
            className="hidden items-center rounded-md border border-field-border bg-field-bg p-0.5 md:inline-flex"
          >
            <button
              type="button"
              aria-pressed={viewMode === "table"}
              onClick={() => onChangeViewMode("table")}
              className={`inline-flex min-h-[40px] items-center gap-1.5 rounded px-3 text-xs font-semibold transition-colors ${
                viewMode === "table"
                  ? "bg-[#15803D] text-white"
                  : "text-field-ink hover:bg-[#EAEFEA]"
              }`}
            >
              <Table2 className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Tabel</span>
            </button>
            <button
              type="button"
              aria-pressed={viewMode === "cards"}
              onClick={() => onChangeViewMode("cards")}
              className={`inline-flex min-h-[40px] items-center gap-1.5 rounded px-3 text-xs font-semibold transition-colors ${
                viewMode === "cards"
                  ? "bg-[#15803D] text-white"
                  : "text-field-ink hover:bg-[#EAEFEA]"
              }`}
            >
              <LayoutGrid className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Kartu</span>
            </button>
          </div>
        </div>
      </div>

      {/* Collapsible Hierarchy Drawer */}
      {drawerOpen && master && (
        <div
          id="pumps-hierarchy-drawer"
          className="grid grid-cols-1 gap-3 rounded-md border border-field-border bg-field-bg p-3.5 sm:grid-cols-2 lg:grid-cols-5"
        >
          <div>
            <label
              htmlFor="pumps-filter-pt"
              className="mb-1 block text-xs font-semibold text-field-muted"
            >
              PT / Perusahaan
            </label>
            <select
              id="pumps-filter-pt"
              value={hierarchy.companyId}
              onChange={(e) => updateHierarchyField("companyId", e.target.value)}
              className="min-h-[44px] w-full rounded-md border border-field-border bg-white px-3 text-sm text-field-ink"
            >
              <option value="">Semua PT</option>
              {master.companies.map((c) => (
                <option key={c.id} value={String(c.id)}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label
              htmlFor="pumps-filter-region"
              className="mb-1 block text-xs font-semibold text-field-muted"
            >
              Region / Wilayah
            </label>
            <select
              id="pumps-filter-region"
              value={hierarchy.regionId}
              onChange={(e) => updateHierarchyField("regionId", e.target.value)}
              className="min-h-[44px] w-full rounded-md border border-field-border bg-white px-3 text-sm text-field-ink"
            >
              <option value="">Semua Region</option>
              {filteredRegions.map((r) => (
                <option key={r.id} value={String(r.id)}>
                  {r.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label
              htmlFor="pumps-filter-estate"
              className="mb-1 block text-xs font-semibold text-field-muted"
            >
              Estate
            </label>
            <select
              id="pumps-filter-estate"
              value={hierarchy.estateId}
              onChange={(e) => updateHierarchyField("estateId", e.target.value)}
              className="min-h-[44px] w-full rounded-md border border-field-border bg-white px-3 text-sm text-field-ink"
            >
              <option value="">Semua Estate</option>
              {filteredEstates.map((es) => (
                <option key={es.id} value={String(es.id)}>
                  {es.code}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label
              htmlFor="pumps-filter-block"
              className="mb-1 block text-xs font-semibold text-field-muted"
            >
              Block / Lokasi
            </label>
            <select
              id="pumps-filter-block"
              value={hierarchy.blockId}
              onChange={(e) => updateHierarchyField("blockId", e.target.value)}
              className="min-h-[44px] w-full rounded-md border border-field-border bg-white px-3 text-sm text-field-ink"
            >
              <option value="">Semua Block</option>
              {filteredBlocks.map((b) => (
                <option key={b.id} value={String(b.id)}>
                  {b.code}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label
              htmlFor="pumps-filter-type"
              className="mb-1 block text-xs font-semibold text-field-muted"
            >
              Jenis Pompa
            </label>
            <select
              id="pumps-filter-type"
              value={hierarchy.pumpTypeId}
              onChange={(e) => updateHierarchyField("pumpTypeId", e.target.value)}
              className="min-h-[44px] w-full rounded-md border border-field-border bg-white px-3 text-sm text-field-ink"
            >
              <option value="">Semua Jenis</option>
              {master.pumpTypes.map((pt) => (
                <option key={pt.id} value={String(pt.id)}>
                  {pt.name}
                </option>
              ))}
            </select>
          </div>
        </div>
      )}

      {/* Active Removable Filter Chips */}
      {activeTags.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 border-t border-field-border pt-2.5">
          <span className="text-xs font-semibold text-field-muted">Filter aktif:</span>
          {activeTags.map((tag) => (
            <button
              key={tag.key}
              type="button"
              onClick={tag.onRemove}
              aria-label={`Hapus filter ${tag.label}`}
              className="inline-flex min-h-[36px] items-center gap-1.5 rounded-md border border-field-border bg-field-bg px-2.5 py-1 text-xs font-semibold text-field-ink hover:bg-[#FEE2E2] hover:border-[#FCA5A5] hover:text-[#991B1B]"
            >
              <span>{tag.label}</span>
              <X className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            </button>
          ))}
          <button
            type="button"
            onClick={onResetAll}
            className="inline-flex min-h-[36px] items-center gap-1 rounded-md px-2.5 py-1 text-xs font-semibold text-[#991B1B] hover:bg-[#FEE2E2]"
          >
            <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
            <span>Reset Semua</span>
          </button>
        </div>
      )}
    </section>
  );
}
