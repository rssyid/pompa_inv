"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { BarChart3, Lock, MapPin, Save, SlidersHorizontal } from "lucide-react";
import { useAppData } from "@/components/AppDataProvider";
import { AppShell } from "@/components/AppShell";
import {
  FilterValues,
  HierarchyFilterBar,
} from "@/components/HierarchyFilterBar";
import {
  PumpLocationDialog,
  PumpOperationalEditable,
} from "@/components/PumpLocationDialog";
import { UnitStatusBadge } from "@/components/StatusBadge";
import { EmptyState, ErrorState, LoadingState } from "@/components/UiStates";
import { EnrichedPump, fetchJson } from "@/lib/client-fetch";
import { getPumpLocationBadgeInfo } from "@/lib/pump-location";

interface OperatingHoursPumpItem extends EnrichedPump {
  dayOperatingHours: number | null;
  dayLogNotes: string | null;
  monthTotalHours: number;
}

interface OperatingHoursListResponse {
  date: string;
  monthLabel: string;
  items: OperatingHoursPumpItem[];
}

function formatInputVal(hrs: number | null): string {
  if (hrs === null || hrs <= 0) return "";
  return String(hrs);
}

export default function OperatingHoursPage() {
  const { user, master, ensureLoaded, refreshMaster, error: bootError } = useAppData();
  const [logDate, setLogDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [locationFilter, setLocationFilter] = useState<"all" | "assigned" | "unassigned">("all");
  const [filters, setFilters] = useState<FilterValues>({
    companyId: "",
    regionId: "",
    estateId: "",
    blockId: "",
    pumpTypeId: "",
    status: "",
    search: "",
  });

  const [monthLabel, setMonthLabel] = useState("");
  const [items, setItems] = useState<OperatingHoursPumpItem[]>([]);
  const [draftHours, setDraftHours] = useState<Record<number, string>>({});
  const [dirtyIds, setDirtyIds] = useState<Record<number, boolean>>({});

  const [dialogState, setDialogState] = useState<{
    pump: PumpOperationalEditable;
    tab: "location" | "operational";
  } | null>(null);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const loadList = useCallback(
    async (
      targetDate: string,
      f: FilterValues,
      locFilter: "all" | "assigned" | "unassigned"
    ) => {
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      const params = new URLSearchParams();
      params.set("date", targetDate);
      params.set("locationFilter", locFilter);
      if (f.companyId) params.set("companyId", f.companyId);
      if (f.regionId) params.set("regionId", f.regionId);
      if (f.estateId) params.set("estateId", f.estateId);
      if (f.blockId) params.set("blockId", f.blockId);
      if (f.pumpTypeId) params.set("pumpTypeId", f.pumpTypeId);
      if (f.status) params.set("status", f.status);
      if (f.search) params.set("search", f.search);

      const res = await fetchJson<OperatingHoursListResponse>(
        `/api/operating-hours?${params.toString()}`,
        { signal: controller.signal }
      );

      setMonthLabel(res.monthLabel);
      setItems(res.items);

      const initialDrafts: Record<number, string> = {};
      for (const item of res.items) {
        initialDrafts[item.id] = formatInputVal(item.dayOperatingHours);
      }
      setDraftHours(initialDrafts);
      setDirtyIds({});
    },
    []
  );

  const loadInitial = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      await Promise.all([ensureLoaded(), loadList(logDate, filters, locationFilter)]);
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") return;
      setError(err instanceof Error ? err.message : "Gagal memuat daftar jam kerja pompa.");
    } finally {
      setLoading(false);
    }
  }, [ensureLoaded, filters, loadList, locationFilter, logDate]);

  useEffect(() => {
    loadInitial();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function applyQuery(
    nextDate = logDate,
    nextFilters = filters,
    nextLocFilter = locationFilter
  ) {
    setRefreshing(true);
    setError(null);
    setNotice(null);
    try {
      await loadList(nextDate, nextFilters, nextLocFilter);
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") return;
      setError(err instanceof Error ? err.message : "Gagal memuat ulang daftar.");
    } finally {
      setRefreshing(false);
    }
  }

  function handleHoursChange(pumpId: number, rawValue: string) {
    setNotice(null);
    setDraftHours((prev) => ({ ...prev, [pumpId]: rawValue }));
    setDirtyIds((prev) => ({ ...prev, [pumpId]: true }));
  }

  const dirtyPumpIds = useMemo(
    () => Object.keys(dirtyIds).filter((k) => dirtyIds[Number(k)]).map(Number),
    [dirtyIds]
  );

  const summaryCounts = useMemo(() => {
    let assigned = 0;
    let unassigned = 0;
    let loggedToday = 0;
    for (const item of items) {
      if (item.isLocationAssigned) assigned += 1;
      else unassigned += 1;
      const val = Number(draftHours[item.id] ?? "");
      if (Number.isFinite(val) && val > 0) loggedToday += 1;
    }
    return { total: items.length, assigned, unassigned, loggedToday };
  }, [draftHours, items]);

  async function handleSaveAll() {
    if (dirtyPumpIds.length === 0) return;

    const entries: Array<{ pumpId: number; operatingHours: number | null }> = [];
    for (const pumpId of dirtyPumpIds) {
      const raw = (draftHours[pumpId] ?? "").trim();
      if (raw === "") {
        entries.push({ pumpId, operatingHours: null });
        continue;
      }
      const num = Number(raw);
      if (!Number.isFinite(num) || num < 0 || num > 24) {
        const found = items.find((i) => i.id === pumpId);
        setError(
          `Nilai jam kerja untuk ${found?.pumpCode ?? "pompa"} harus antara 0 sampai 24 jam.`
        );
        return;
      }
      entries.push({ pumpId, operatingHours: num });
    }

    setSaving(true);
    setError(null);
    setNotice(null);
    try {
      const res = await fetchJson<{ savedCount: number; clearedCount: number }>(
        "/api/operating-hours",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ logDate, entries }),
        }
      );

      await loadList(logDate, filters, locationFilter);
      setNotice(
        `Tersimpan untuk ${logDate}: ${res.savedCount} unit tercatat beroperasi` +
          (res.clearedCount > 0 ? `, ${res.clearedCount} catatan dihapus` : "") +
          "."
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal menyimpan jam kerja pompa.");
    } finally {
      setSaving(false);
    }
  }

  function openPumpDialog(item: OperatingHoursPumpItem, tab: "location" | "operational") {
    setDialogState({
      tab,
      pump: {
        id: item.id,
        pumpCode: item.pumpCode,
        currentUnitStatus: item.currentUnitStatus,
        estateId: item.estateId,
        blockId: item.blockId,
        blockCode: item.blockCode,
        estateCode: item.estateCode,
        operationalNote: item.operationalNote,
        operationalCategory: item.operationalCategory,
        repairStatus: item.repairStatus,
        isPreOrder: item.isPreOrder,
        breakdownStartDate: item.breakdownStartDate,
      },
    });
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-field-bg p-6">
        <LoadingState message="Memuat daftar input jam kerja pompa..." />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-field-bg p-6">
        <ErrorState
          title="Gagal memuat halaman jam kerja"
          message={error || bootError || "Terjadi gangguan koneksi ke server."}
          onRetry={loadInitial}
        />
      </div>
    );
  }

  return (
    <AppShell
      user={user}
      title="Input Jam Kerja Pompa"
      subtitle="Isi jam operasional hanya pada pompa yang beroperasi. Pompa harus memiliki lokasi blok lapangan terlebih dahulu."
    >
      <div className="space-y-4">
        {error && <ErrorState message={error} />}
        {notice && (
          <div
            role="status"
            aria-live="polite"
            className="rounded-md border border-[#86EFAC] bg-[#DCFCE7] px-4 py-3 text-sm font-semibold text-[#166534]"
          >
            {notice}
          </div>
        )}

        {/* Top Bar: Date, Location Filter & Save/Report Actions */}
        <section className="rounded-lg border border-field-border bg-field-surface p-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:flex lg:flex-wrap lg:items-end">
              <div>
                <label
                  htmlFor="oh-date"
                  className="mb-1 block text-xs font-semibold text-field-muted"
                >
                  Tanggal Pencatatan
                </label>
                <input
                  id="oh-date"
                  type="date"
                  value={logDate}
                  onChange={(e) => {
                    const nextDate = e.target.value;
                    if (!nextDate) return;
                    setLogDate(nextDate);
                    applyQuery(nextDate, filters, locationFilter);
                  }}
                  className="min-h-[44px] w-full rounded-md border border-field-border bg-white px-3 text-sm font-medium text-field-ink sm:w-auto"
                />
              </div>

              <div>
                <label
                  htmlFor="oh-loc-filter"
                  className="mb-1 block text-xs font-semibold text-field-muted"
                >
                  Status Penempatan Lokasi
                </label>
                <select
                  id="oh-loc-filter"
                  value={locationFilter}
                  onChange={(e) => {
                    const nextLoc = e.target.value as "all" | "assigned" | "unassigned";
                    setLocationFilter(nextLoc);
                    applyQuery(logDate, filters, nextLoc);
                  }}
                  className="min-h-[44px] w-full rounded-md border border-field-border bg-white px-3 text-sm text-field-ink sm:w-auto"
                >
                  <option value="all">Semua Pompa</option>
                  <option value="assigned">Siap Operasi (Sudah Assign Lokasi)</option>
                  <option value="unassigned">Belum Assign Lokasi / WSC</option>
                </select>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Link
                href="/reports?tab=operating-hours"
                className="inline-flex min-h-[44px] items-center gap-2 rounded-md border border-field-border bg-field-bg px-3.5 text-sm font-semibold text-field-ink hover:bg-[#EAEFEA]"
              >
                <BarChart3 className="h-4 w-4" aria-hidden="true" />
                <span>Lihat Laporan Monitoring</span>
              </Link>
              <button
                type="button"
                disabled={saving || dirtyPumpIds.length === 0}
                onClick={handleSaveAll}
                className="inline-flex min-h-[44px] items-center gap-2 rounded-md bg-field-accent px-4 text-sm font-semibold text-white hover:bg-field-accent-hover disabled:opacity-50"
              >
                <Save className="h-4 w-4" aria-hidden="true" />
                <span>
                  {saving
                    ? "Menyimpan..."
                    : `Simpan Jam Kerja (${dirtyPumpIds.length})`}
                </span>
              </button>
            </div>
          </div>
        </section>

        {master && (
          <HierarchyFilterBar
            master={master}
            values={filters}
            onChange={(next) => {
              setFilters(next);
              applyQuery(logDate, next, locationFilter);
            }}
          />
        )}

        {/* Real Operational Counts */}
        <section
          aria-label="Ringkasan pencatatan jam kerja"
          className="grid grid-cols-2 divide-y divide-field-border overflow-hidden rounded-lg border border-field-border bg-field-surface sm:grid-cols-4 sm:divide-x sm:divide-y-0"
        >
          <div className="px-4 py-3">
            <p className="text-xs font-semibold text-field-muted">Total Tersaring</p>
            <p className="mt-0.5 font-mono text-lg font-bold tabular-nums text-field-ink">
              {summaryCounts.total}
            </p>
          </div>
          <div className="px-4 py-3">
            <p className="text-xs font-semibold text-[#166534]">Siap Input Jam</p>
            <p className="mt-0.5 font-mono text-lg font-bold tabular-nums text-[#166534]">
              {summaryCounts.assigned}
            </p>
          </div>
          <div className="px-4 py-3">
            <p className="text-xs font-semibold text-[#92400E]">Belum Assign / WSC</p>
            <p className="mt-0.5 font-mono text-lg font-bold tabular-nums text-[#92400E]">
              {summaryCounts.unassigned}
            </p>
          </div>
          <div className="px-4 py-3">
            <p className="text-xs font-semibold text-field-muted">Diisi Tgl Ini</p>
            <p className="mt-0.5 font-mono text-lg font-bold tabular-nums text-field-ink">
              {summaryCounts.loggedToday}
            </p>
          </div>
        </section>

        {refreshing && (
          <p role="status" aria-live="polite" className="text-xs font-medium text-field-muted">
            Memperbarui daftar pompa...
          </p>
        )}

        {items.length === 0 ? (
          <EmptyState
            title="Tidak ada pompa yang sesuai filter"
            description="Ubah filter Estate, Blok, atau status penempatan lokasi."
          />
        ) : (
          <div className="rounded-lg border border-field-border bg-field-surface">
            {/* Mobile Cards */}
            <ul className="divide-y divide-field-border md:hidden">
              {items.map((item) => {
                const loc = getPumpLocationBadgeInfo({
                  blockId: item.blockId,
                  blockCode: item.blockCode,
                  estateCode: item.estateCode,
                });
                const val = draftHours[item.id] ?? "";
                const isDirty = Boolean(dirtyIds[item.id]);

                return (
                  <li
                    key={item.id}
                    className={`space-y-3 p-4 ${isDirty ? "bg-[#F0FDF4]" : ""}`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <Link
                            href={`/pumps/${item.id}`}
                            className="font-mono text-base font-bold text-field-ink underline-offset-2 hover:underline"
                          >
                            {item.pumpCode}
                          </Link>
                          <span className="text-xs text-field-muted">
                            {item.pumpTypeName}
                          </span>
                        </div>
                        <p className="mt-0.5 text-xs text-field-muted">
                          {item.regionName ?? "Tanpa Region"}
                        </p>
                      </div>
                      <UnitStatusBadge status={item.currentUnitStatus} />
                    </div>

                    <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-field-border bg-field-bg px-3 py-2 text-xs">
                      <div className="flex items-center gap-1.5 font-semibold">
                        <MapPin className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                        <span
                          className={
                            loc.assigned
                              ? "font-mono text-field-ink"
                              : loc.tone === "workshop"
                                ? "text-[#92400E]"
                                : "text-[#991B1B]"
                          }
                        >
                          {loc.label}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => openPumpDialog(item, "location")}
                          className="min-h-[36px] rounded border border-field-border bg-white px-2.5 text-xs font-semibold text-field-ink"
                        >
                          {loc.assigned ? "Pindah Lokasi" : "Assign Lokasi"}
                        </button>
                        <button
                          type="button"
                          onClick={() => openPumpDialog(item, "operational")}
                          className="min-h-[36px] rounded border border-field-border bg-white px-2.5 text-xs font-semibold text-field-ink"
                        >
                          Info / PO
                        </button>
                      </div>
                    </div>

                    {loc.assigned ? (
                      <div className="space-y-2">
                        <div className="flex items-center justify-between gap-3">
                          <label
                            htmlFor={`mob-hours-${item.id}`}
                            className="text-xs font-semibold text-field-muted"
                          >
                            Jam Kerja ({logDate})
                          </label>
                          <span className="font-mono text-xs text-field-muted tabular-nums">
                            {monthLabel}: {item.monthTotalHours} jam
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <input
                            id={`mob-hours-${item.id}`}
                            type="number"
                            inputMode="decimal"
                            min={0}
                            max={24}
                            step="0.5"
                            value={val}
                            onChange={(e) => handleHoursChange(item.id, e.target.value)}
                            placeholder="-"
                            className="min-h-[44px] w-24 rounded-md border border-field-border bg-white px-3 text-center font-mono text-base font-bold tabular-nums text-field-ink"
                          />
                          <div className="flex flex-1 flex-wrap gap-1.5">
                            {["4", "6", "8"].map((preset) => (
                              <button
                                key={preset}
                                type="button"
                                onClick={() => handleHoursChange(item.id, preset)}
                                className={`min-h-[44px] flex-1 rounded border px-2 font-mono text-xs font-semibold ${
                                  val === preset
                                    ? "border-[#15803D] bg-[#DCFCE7] text-[#166534]"
                                    : "border-field-border bg-white text-field-ink"
                                }`}
                              >
                                {preset}j
                              </button>
                            ))}
                            <button
                              type="button"
                              onClick={() => handleHoursChange(item.id, "")}
                              className="min-h-[44px] rounded border border-field-border bg-field-bg px-2.5 text-xs font-semibold text-field-muted"
                            >
                              Hapus
                            </button>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center justify-between gap-2 rounded-md border border-[#FCD34D] bg-[#FFFBEB] px-3 py-2 text-xs text-[#92400E]">
                        <span className="inline-flex items-center gap-1.5 font-medium">
                          <Lock className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                          <span>Assign lokasi blok lapangan dulu agar bisa input jam.</span>
                        </span>
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>

            {/* Desktop & Tablet Table */}
            <div className="hidden overflow-x-auto md:block">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-field-border bg-field-bg text-xs font-semibold text-field-muted">
                  <tr>
                    <th className="px-3 py-3">Kode Pompa</th>
                    <th className="px-3 py-3">Kebun / Lokasi Blok</th>
                    <th className="px-3 py-3">Kondisi</th>
                    <th className="px-3 py-3">Jam Kerja ({logDate})</th>
                    <th className="px-3 py-3 text-right">Total {monthLabel}</th>
                    <th className="px-3 py-3">Keterangan / Status</th>
                    <th className="px-3 py-3 text-right">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-field-border">
                  {items.map((item) => {
                    const loc = getPumpLocationBadgeInfo({
                      blockId: item.blockId,
                      blockCode: item.blockCode,
                      estateCode: item.estateCode,
                    });
                    const val = draftHours[item.id] ?? "";
                    const isDirty = Boolean(dirtyIds[item.id]);

                    return (
                      <tr
                        key={item.id}
                        className={isDirty ? "bg-[#F0FDF4]" : "hover:bg-field-bg/60"}
                      >
                        <td className="px-3 py-2.5">
                          <Link
                            href={`/pumps/${item.id}`}
                            className="font-mono font-bold text-field-ink hover:underline"
                          >
                            {item.pumpCode}
                          </Link>
                          <p className="text-xs text-field-muted">{item.pumpTypeName}</p>
                        </td>

                        <td className="px-3 py-2.5">
                          <span
                            className={`inline-flex items-center gap-1.5 rounded border px-2 py-1 text-xs font-semibold ${
                              loc.assigned
                                ? "border-[#86EFAC] bg-[#DCFCE7] font-mono text-[#166534]"
                                : loc.tone === "workshop"
                                  ? "border-[#FCD34D] bg-[#FEF3C7] text-[#92400E]"
                                  : "border-[#FCA5A5] bg-[#FEE2E2] text-[#991B1B]"
                            }`}
                          >
                            <MapPin className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                            <span>{loc.label}</span>
                          </span>
                        </td>

                        <td className="px-3 py-2.5">
                          <UnitStatusBadge status={item.currentUnitStatus} />
                        </td>

                        <td className="px-3 py-2.5">
                          {loc.assigned ? (
                            <div className="flex items-center gap-1.5">
                              <label htmlFor={`desk-hours-${item.id}`} className="sr-only">
                                Jam kerja {item.pumpCode}
                              </label>
                              <input
                                id={`desk-hours-${item.id}`}
                                type="number"
                                inputMode="decimal"
                                min={0}
                                max={24}
                                step="0.5"
                                value={val}
                                onChange={(e) => handleHoursChange(item.id, e.target.value)}
                                placeholder="-"
                                className="min-h-[44px] w-24 rounded-md border border-field-border bg-white px-2.5 text-center font-mono text-sm font-bold tabular-nums text-field-ink"
                              />
                              <span className="text-xs text-field-muted">jam</span>
                            </div>
                          ) : (
                            <span
                              title="Pompa belum di-assign ke blok lapangan"
                              className="inline-flex min-h-[44px] items-center gap-1.5 text-xs font-medium text-field-muted"
                            >
                              <Lock className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                              <span>Terkunci (Assign lokasi dulu)</span>
                            </span>
                          )}
                        </td>

                        <td className="px-3 py-2.5 text-right font-mono font-semibold tabular-nums text-field-ink">
                          {item.monthTotalHours > 0 ? `${item.monthTotalHours} jam` : "-"}
                        </td>

                        <td className="max-w-[220px] px-3 py-2.5 text-xs text-field-muted">
                          <p className="truncate font-medium text-field-ink">
                            {item.operationalNote || "-"}
                          </p>
                          {item.repairStatus && (
                            <p className="mt-0.5 truncate text-[#075985]">
                              Status: {item.repairStatus}
                            </p>
                          )}
                        </td>

                        <td className="px-3 py-2.5 text-right">
                          <div className="inline-flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => openPumpDialog(item, "location")}
                              className={`min-h-[44px] rounded-md border px-3 text-xs font-semibold ${
                                loc.assigned
                                  ? "border-field-border bg-field-bg text-field-ink hover:bg-[#EAEFEA]"
                                  : "border-[#15803D] bg-[#DCFCE7] text-[#166534] hover:bg-[#BBF7D0]"
                              }`}
                            >
                              {loc.assigned ? "Pindah Lokasi" : "Assign Lokasi"}
                            </button>
                            <button
                              type="button"
                              aria-label={`Ubah keterangan dan status PO ${item.pumpCode}`}
                              onClick={() => openPumpDialog(item, "operational")}
                              className="inline-flex h-11 w-11 items-center justify-center rounded-md border border-field-border bg-field-bg text-field-ink hover:bg-[#EAEFEA]"
                            >
                              <SlidersHorizontal className="h-4 w-4" aria-hidden="true" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Sticky Bottom Save Bar when edits exist */}
        {dirtyPumpIds.length > 0 && (
          <div className="sticky bottom-16 z-30 flex flex-wrap items-center justify-between gap-3 rounded-lg border-2 border-[#15803D] bg-white px-4 py-3 shadow-md md:bottom-4">
            <p className="text-sm font-semibold text-field-ink">
              Ada{" "}
              <span className="font-mono font-bold text-[#166534]">
                {dirtyPumpIds.length}
              </span>{" "}
              unit pompa dengan perubahan jam kerja pada tanggal{" "}
              <span className="font-mono">{logDate}</span>.
            </p>
            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={saving}
                onClick={() => applyQuery(logDate, filters, locationFilter)}
                className="min-h-[44px] rounded-md border border-field-border bg-field-bg px-3.5 text-sm font-semibold text-field-ink"
              >
                Reset
              </button>
              <button
                type="button"
                disabled={saving}
                onClick={handleSaveAll}
                className="inline-flex min-h-[44px] items-center gap-2 rounded-md bg-field-accent px-5 text-sm font-bold text-white hover:bg-field-accent-hover disabled:opacity-60"
              >
                <Save className="h-4 w-4" aria-hidden="true" />
                <span>{saving ? "Menyimpan..." : "Simpan Jam Kerja"}</span>
              </button>
            </div>
          </div>
        )}
      </div>

      {dialogState && master && (
        <PumpLocationDialog
          pump={dialogState.pump}
          master={master}
          initialTab={dialogState.tab}
          onClose={() => setDialogState(null)}
          onSaved={async (createdBlock) => {
            if (createdBlock) {
              await refreshMaster();
            }
            await loadList(logDate, filters, locationFilter);
            setNotice(`Lokasi / info operasional pompa ${dialogState.pump.pumpCode} diperbarui.`);
          }}
        />
      )}
    </AppShell>
  );
}
