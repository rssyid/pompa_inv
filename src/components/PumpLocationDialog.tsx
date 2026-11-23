"use client";

import { useEffect, useId, useMemo, useState } from "react";
import { MapPin, X } from "lucide-react";
import { MasterTreeData } from "@/components/HierarchyFilterBar";
import { fetchJson } from "@/lib/client-fetch";
import {
  getPumpLocationBadgeInfo,
  OPERATIONAL_CATEGORY_OPTIONS,
  OPERATIONAL_NOTE_PRESETS,
  OperationalCategory,
} from "@/lib/pump-location";

export interface PumpOperationalEditable {
  id: number;
  pumpCode: string;
  currentUnitStatus: string;
  estateId: number | null;
  blockId: number | null;
  blockCode: string | null;
  estateCode: string | null;
  operationalNote: string | null;
  operationalCategory: string;
  repairStatus: string | null;
  isPreOrder: boolean;
  breakdownStartDate: string | null;
}

export function PumpLocationDialog({
  pump,
  master,
  initialTab = "location",
  onClose,
  onSaved,
}: {
  pump: PumpOperationalEditable;
  master: MasterTreeData;
  initialTab?: "location" | "operational";
  onClose: () => void;
  onSaved: (createdBlock: boolean) => Promise<void> | void;
}) {
  const titleId = useId();
  const [tab, setTab] = useState<"location" | "operational">(initialTab);
  const [estateId, setEstateId] = useState<string>(
    pump.estateId ? String(pump.estateId) : ""
  );
  const [blockMode, setBlockMode] = useState<"existing" | "new" | "clear">(
    pump.blockId ? "existing" : "existing"
  );
  const [blockId, setBlockId] = useState<string>(
    pump.blockId ? String(pump.blockId) : ""
  );
  const [newBlockCode, setNewBlockCode] = useState("");

  const [operationalNote, setOperationalNote] = useState(pump.operationalNote ?? "");
  const [operationalCategory, setOperationalCategory] = useState<OperationalCategory>(
    (pump.operationalCategory as OperationalCategory) || "none"
  );
  const [repairStatus, setRepairStatus] = useState(pump.repairStatus ?? "");
  const [isPreOrder, setIsPreOrder] = useState(pump.isPreOrder);
  const [breakdownStartDate, setBreakdownStartDate] = useState(
    pump.breakdownStartDate ?? ""
  );

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape" && !saving) {
        onClose();
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose, saving]);

  const filteredBlocks = useMemo(() => {
    if (!estateId) return [];
    return master.blocks.filter((b) => String(b.estateId) === estateId);
  }, [estateId, master.blocks]);

  const selectedBlockCode = useMemo(() => {
    if (blockMode === "clear") return null;
    if (blockMode === "new") return newBlockCode.trim() || null;
    const found = filteredBlocks.find((b) => String(b.id) === blockId);
    return found?.code ?? null;
  }, [blockId, blockMode, filteredBlocks, newBlockCode]);

  const selectedEstateCode = useMemo(() => {
    const found = master.estates.find((e) => String(e.id) === estateId);
    return found?.code ?? null;
  }, [estateId, master.estates]);

  const previewLocation = getPumpLocationBadgeInfo({
    blockId:
      blockMode === "clear"
        ? null
        : blockMode === "new"
          ? newBlockCode.trim()
            ? 1
            : null
          : blockId
            ? Number(blockId)
            : null,
    blockCode: selectedBlockCode,
    estateCode: selectedEstateCode,
  });

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);

    try {
      const payload: Record<string, unknown> = {
        operationalNote: operationalNote.trim() || null,
        operationalCategory,
        repairStatus: repairStatus.trim() || null,
        isPreOrder,
        breakdownStartDate: breakdownStartDate || null,
      };

      if (blockMode === "clear") {
        payload.clearLocation = true;
        payload.estateId = estateId ? Number(estateId) : null;
      } else if (blockMode === "new") {
        if (!estateId) {
          throw new Error("Pilih Estate/Kebun terlebih dahulu.");
        }
        if (!newBlockCode.trim()) {
          throw new Error("Masukkan kode blok atau posisi pompa baru.");
        }
        payload.estateId = Number(estateId);
        payload.newBlockCode = newBlockCode.trim();
      } else {
        if (estateId) payload.estateId = Number(estateId);
        if (blockId) payload.blockId = Number(blockId);
      }

      const res = await fetchJson<{ createdBlock: boolean }>(
        `/api/pumps/${pump.id}/operational`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        }
      );

      await onSaved(res.createdBlock);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal menyimpan perubahan pompa.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/45 p-0 sm:items-center sm:p-4"
    >
      <div className="max-h-[92vh] w-full overflow-y-auto rounded-t-xl border border-field-border bg-field-surface shadow-xl sm:max-w-lg sm:rounded-xl">
        <div className="flex items-start justify-between gap-3 border-b border-field-border px-4 py-3.5 sm:px-5">
          <div className="min-w-0">
            <p className="text-xs font-semibold text-field-muted">Pengaturan Unit Pompa</p>
            <h2 id={titleId} className="font-mono text-lg font-bold text-field-ink">
              {pump.pumpCode}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            aria-label="Tutup dialog"
            className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-md border border-field-border bg-field-bg text-field-ink hover:bg-[#EAEFEA]"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>

        <div className="border-b border-field-border bg-field-bg px-4 py-2 sm:px-5">
          <div role="tablist" aria-label="Kategori pengaturan pompa" className="flex gap-2">
            <button
              type="button"
              role="tab"
              aria-selected={tab === "location"}
              onClick={() => setTab("location")}
              className={`min-h-[44px] flex-1 rounded-md border px-3 text-xs font-semibold sm:text-sm ${
                tab === "location"
                  ? "border-[#15803D] bg-[#DCFCE7] text-[#166534]"
                  : "border-field-border bg-white text-field-ink"
              }`}
            >
              Lokasi Penempatan
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={tab === "operational"}
              onClick={() => setTab("operational")}
              className={`min-h-[44px] flex-1 rounded-md border px-3 text-xs font-semibold sm:text-sm ${
                tab === "operational"
                  ? "border-[#15803D] bg-[#DCFCE7] text-[#166534]"
                  : "border-field-border bg-white text-field-ink"
              }`}
            >
              Keterangan &amp; Status PO
            </button>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 p-4 sm:p-5">
          {error && (
            <div
              role="alert"
              className="rounded-md border border-[#FCA5A5] bg-[#FEE2E2] px-3 py-2 text-xs font-semibold text-[#991B1B]"
            >
              {error}
            </div>
          )}

          {tab === "location" ? (
            <div className="space-y-4">
              <div className="rounded-md border border-field-border bg-field-bg p-3 text-xs text-field-ink">
                <p className="font-semibold text-field-muted">Aturan Lokasi</p>
                <p className="mt-1">
                  Lokasi yang disimpan akan terus dipakai pada pencatatan harian hingga
                  diganti kembali. Unit tanpa blok atau berada di Workshop (WSC) tidak
                  dapat diisi jam kerjanya.
                </p>
              </div>

              <div>
                <label
                  htmlFor="loc-estate"
                  className="mb-1 block text-xs font-semibold text-field-muted"
                >
                  Kebun / Estate
                </label>
                <select
                  id="loc-estate"
                  value={estateId}
                  onChange={(e) => {
                    const nextEstateId = e.target.value;
                    setEstateId(nextEstateId);
                    const firstBlk = master.blocks.find(
                      (b) => String(b.estateId) === nextEstateId
                    );
                    setBlockId(firstBlk ? String(firstBlk.id) : "");
                  }}
                  className="min-h-[44px] w-full rounded-md border border-field-border bg-white px-3 text-sm text-field-ink"
                >
                  <option value="">Pilih Kebun / Estate</option>
                  {master.estates.map((est) => (
                    <option key={est.id} value={String(est.id)}>
                      {est.code} - {est.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-2">
                <span className="block text-xs font-semibold text-field-muted">
                  Mode Penempatan Blok / Posisi
                </span>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { val: "existing" as const, label: "Pilih Blok" },
                    { val: "new" as const, label: "Ketik Blok Baru" },
                    { val: "clear" as const, label: "Kosongkan" },
                  ].map((opt) => (
                    <button
                      key={opt.val}
                      type="button"
                      aria-pressed={blockMode === opt.val}
                      onClick={() => setBlockMode(opt.val)}
                      className={`min-h-[44px] rounded-md border px-2 text-xs font-semibold ${
                        blockMode === opt.val
                          ? "border-[#15803D] bg-[#DCFCE7] text-[#166534]"
                          : "border-field-border bg-white text-field-ink"
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              {blockMode === "existing" && (
                <div>
                  <label
                    htmlFor="loc-block"
                    className="mb-1 block text-xs font-semibold text-field-muted"
                  >
                    Blok / Posisi Pompa
                  </label>
                  <select
                    id="loc-block"
                    value={blockId}
                    onChange={(e) => setBlockId(e.target.value)}
                    disabled={!estateId}
                    className="min-h-[44px] w-full rounded-md border border-field-border bg-white px-3 text-sm text-field-ink disabled:bg-field-bg"
                  >
                    <option value="">
                      {estateId ? "Pilih Blok / Posisi" : "Pilih Estate dulu"}
                    </option>
                    {filteredBlocks.map((b) => (
                      <option key={b.id} value={String(b.id)}>
                        {b.code}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {blockMode === "new" && (
                <div>
                  <label
                    htmlFor="loc-new-block"
                    className="mb-1 block text-xs font-semibold text-field-muted"
                  >
                    Kode Blok / Posisi Baru
                  </label>
                  <input
                    id="loc-new-block"
                    type="text"
                    value={newBlockCode}
                    onChange={(e) => setNewBlockCode(e.target.value)}
                    placeholder="Contoh: 73-02, 74-10, atau WSC"
                    className="min-h-[44px] w-full rounded-md border border-field-border bg-white px-3 font-mono text-sm text-field-ink"
                  />
                </div>
              )}

              <div
                className={`flex items-center gap-2 rounded-md border px-3 py-2.5 text-xs font-semibold ${
                  previewLocation.assigned
                    ? "border-[#86EFAC] bg-[#DCFCE7] text-[#166534]"
                    : previewLocation.tone === "workshop"
                      ? "border-[#FCD34D] bg-[#FEF3C7] text-[#92400E]"
                      : "border-[#FCA5A5] bg-[#FEE2E2] text-[#991B1B]"
                }`}
              >
                <MapPin className="h-4 w-4 shrink-0" aria-hidden="true" />
                <span>
                  {previewLocation.assigned
                    ? `Siap input jam kerja di ${previewLocation.label}`
                    : `${previewLocation.label} (input jam kerja terkunci)`}
                </span>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div>
                <label
                  htmlFor="op-preset"
                  className="mb-1 block text-xs font-semibold text-field-muted"
                >
                  Pilih Preset Keterangan (Opsional)
                </label>
                <select
                  id="op-preset"
                  value=""
                  onChange={(e) => {
                    const chosen = OPERATIONAL_NOTE_PRESETS.find(
                      (p) => p.note === e.target.value
                    );
                    if (chosen) {
                      setOperationalNote(chosen.note);
                      setOperationalCategory(chosen.category);
                    }
                  }}
                  className="min-h-[44px] w-full rounded-md border border-field-border bg-white px-3 text-sm text-field-ink"
                >
                  <option value="">Isi otomatis dari template...</option>
                  {OPERATIONAL_NOTE_PRESETS.map((p) => (
                    <option key={p.note} value={p.note}>
                      {p.note}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label
                  htmlFor="op-note"
                  className="mb-1 block text-xs font-semibold text-field-muted"
                >
                  Keterangan Laporan Monitoring
                </label>
                <input
                  id="op-note"
                  type="text"
                  value={operationalNote}
                  onChange={(e) => setOperationalNote(e.target.value)}
                  placeholder="Contoh: Aktif, lokasi rawan banjir (TBM)"
                  className="min-h-[44px] w-full rounded-md border border-field-border bg-white px-3 text-sm text-field-ink"
                />
              </div>

              <div>
                <label
                  htmlFor="op-category"
                  className="mb-1 block text-xs font-semibold text-field-muted"
                >
                  Kategori Warna Keterangan
                </label>
                <select
                  id="op-category"
                  value={operationalCategory}
                  onChange={(e) =>
                    setOperationalCategory(e.target.value as OperationalCategory)
                  }
                  className="min-h-[44px] w-full rounded-md border border-field-border bg-white px-3 text-sm text-field-ink"
                >
                  {OPERATIONAL_CATEGORY_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label
                  htmlFor="op-repair-status"
                  className="mb-1 block text-xs font-semibold text-field-muted"
                >
                  Status Tindak Lanjut (Kolom Status Kanan)
                </label>
                <input
                  id="op-repair-status"
                  type="text"
                  value={repairStatus}
                  onChange={(e) => setRepairStatus(e.target.value)}
                  placeholder="Contoh: Perbaikan Tim Traksi"
                  className="min-h-[44px] w-full rounded-md border border-field-border bg-white px-3 text-sm text-field-ink"
                />
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label
                    htmlFor="op-breakdown-date"
                    className="mb-1 block text-xs font-semibold text-field-muted"
                  >
                    Tanggal Mulai Rusak (Hitungan R1..)
                  </label>
                  <input
                    id="op-breakdown-date"
                    type="date"
                    value={breakdownStartDate}
                    onChange={(e) => setBreakdownStartDate(e.target.value)}
                    className="min-h-[44px] w-full rounded-md border border-field-border bg-white px-3 text-sm text-field-ink"
                  />
                </div>

                <div className="flex items-end">
                  <label className="flex min-h-[44px] w-full items-center gap-2 rounded-md border border-field-border bg-field-bg px-3 text-xs font-semibold text-field-ink">
                    <input
                      type="checkbox"
                      checked={isPreOrder}
                      onChange={(e) => setIsPreOrder(e.target.checked)}
                      className="h-4 w-4 accent-[#15803D]"
                    />
                    <span>Tandai PRE ORDER (PO)</span>
                  </label>
                </div>
              </div>
            </div>
          )}

          <div className="flex flex-wrap justify-end gap-2 border-t border-field-border pt-3">
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="min-h-[44px] rounded-md border border-field-border bg-field-bg px-4 text-sm font-semibold text-field-ink hover:bg-[#EAEFEA]"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={saving}
              className="min-h-[44px] rounded-md bg-field-accent px-5 text-sm font-semibold text-white hover:bg-field-accent-hover disabled:opacity-60"
            >
              {saving ? "Menyimpan..." : "Simpan Perubahan"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
