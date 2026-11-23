"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Camera, ClipboardCheck } from "lucide-react";
import { useAppData } from "@/components/AppDataProvider";
import { AppShell } from "@/components/AppShell";
import {
  FilterValues,
  HierarchyFilterBar,
} from "@/components/HierarchyFilterBar";
import { UnitStatusBadge } from "@/components/StatusBadge";
import { EmptyState, ErrorState, LoadingState } from "@/components/UiStates";
import { EnrichedPump, fetchJson } from "@/lib/client-fetch";

export default function PumpsListPage() {
  const { user, master, ensureLoaded, error: bootError } = useAppData();
  const [pumps, setPumps] = useState<EnrichedPump[]>([]);
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

  const loadPumps = useCallback(async (f: FilterValues) => {
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

    const data = await fetchJson<{ pumps: EnrichedPump[] }>(
      `/api/pumps?${params.toString()}`,
      { signal: controller.signal }
    );
    setPumps(data.pumps);
  }, []);

  const loadInitial = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      await Promise.all([ensureLoaded(), loadPumps(filters)]);
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") return;
      setError(err instanceof Error ? err.message : "Gagal memuat daftar pompa.");
    } finally {
      setLoading(false);
    }
  }, [ensureLoaded, filters, loadPumps]);

  useEffect(() => {
    loadInitial();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleFilterChange(next: FilterValues) {
    setFilters(next);
    try {
      await loadPumps(next);
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") return;
      setError(err instanceof Error ? err.message : "Gagal menyaring daftar pompa.");
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-field-bg p-6">
        <LoadingState message="Memuat daftar pompa..." />
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

  return (
    <AppShell
      user={user}
      title="Daftar Unit Pompa"
      subtitle={`Menampilkan ${pumps.length} unit pompa aktif di PT TH Indoplantation.`}
    >
      <div className="space-y-5">
        {error && <ErrorState message={error} onRetry={loadInitial} />}

        {master && (
          <HierarchyFilterBar
            master={master}
            values={filters}
            onChange={handleFilterChange}
          />
        )}

        {pumps.length === 0 ? (
          <EmptyState
            title="Tidak ada pompa yang sesuai filter"
            description="Coba ubah Estate, Block, atau kata kunci kode pompa. Jika unit belum terdaftar, hubungi Admin."
            actionLabel="Reset Filter"
            onAction={() =>
              handleFilterChange({
                companyId: "",
                regionId: "",
                estateId: "",
                blockId: "",
                pumpTypeId: "",
                status: "",
                search: "",
              })
            }
          />
        ) : (
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
            {pumps.map((pump) => (
              <article
                key={pump.id}
                className="flex flex-col justify-between gap-3 rounded-lg border border-field-border bg-field-surface p-4"
              >
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-mono text-base font-bold text-field-ink">
                        {pump.pumpCode}
                      </p>
                      <p className="mt-0.5 text-xs font-medium text-field-muted">
                        {pump.regionName}
                      </p>
                    </div>
                    <UnitStatusBadge status={pump.currentUnitStatus} />
                  </div>

                  <dl className="mt-3 grid grid-cols-2 gap-x-3 gap-y-1.5 border-t border-field-border pt-3 text-xs">
                    <div>
                      <dt className="text-field-muted">Estate / Block</dt>
                      <dd className="font-mono font-semibold text-field-ink">
                        {pump.estateCode} / {pump.blockCode}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-field-muted">Jenis Pompa</dt>
                      <dd className="font-semibold text-field-ink">{pump.pumpTypeName}</dd>
                    </div>
                    <div>
                      <dt className="text-field-muted">Merek Mesin</dt>
                      <dd className="text-field-ink">{pump.engineBrandName}</dd>
                    </div>
                    <div>
                      <dt className="text-field-muted">Part Bermasalah</dt>
                      <dd className="font-mono font-semibold tabular-nums text-field-ink">
                        {pump.issueCount} item
                      </dd>
                    </div>
                  </dl>
                </div>

                <div className="flex items-center justify-between gap-2 border-t border-field-border pt-3">
                  <span className="inline-flex items-center gap-1 text-xs text-field-muted">
                    <Camera className="h-3.5 w-3.5" aria-hidden="true" />
                    <span className="font-mono tabular-nums">{pump.photoCount}</span>
                    <span>foto</span>
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
      </div>
    </AppShell>
  );
}
