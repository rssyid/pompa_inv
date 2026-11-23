"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Camera, Check, Lock, MapPin, Trash2 } from "lucide-react";
import { useAppData } from "@/components/AppDataProvider";
import { AppShell } from "@/components/AppShell";
import {
  MasterIssuePreset,
  MasterPumpTypePart,
} from "@/components/HierarchyFilterBar";
import { PumpLocationDialog } from "@/components/PumpLocationDialog";
import { ErrorState, LoadingState } from "@/components/UiStates";
import { fetchJson } from "@/lib/client-fetch";
import { compressImageFile } from "@/lib/image-compress";
import { getPumpLocationBadgeInfo, OperationalCategory } from "@/lib/pump-location";

interface PumpInfo {
  id: number;
  pumpCode: string;
  currentUnitStatus: string;
  estateId: number | null;
  estateCode: string | null;
  blockId: number | null;
  blockCode: string | null;
  pumpTypeName: string;
  engineBrandName: string;
  isLocationAssigned: boolean;
  operationalNote: string | null;
  operationalCategory: string;
  repairStatus: string | null;
  isPreOrder: boolean;
  breakdownStartDate: string | null;
}

interface PreviousInspectionItem {
  partId: number | null;
  sectionCode: string;
  sectionName: string;
  itemNo: number;
  partName: string;
  expectedQty: number;
  availability: "ada" | "tidak_lengkap" | "hilang";
  condition: "baik" | "rusak";
  issuePresetId: number | null;
  notes: string | null;
}

interface FormItemState {
  partId: number | null;
  sectionCode: string;
  sectionName: string;
  itemNo: number;
  partName: string;
  expectedQty: number;
  availability: "ada" | "tidak_lengkap" | "hilang";
  condition: "baik" | "rusak";
  issuePresetId: number | null;
  notes: string;
  sortOrder: number;
}

interface UploadedPhotoState {
  storageProvider: "gdrive" | "local";
  storageKey: string;
  fileName: string;
  mimeType: string;
  caption: string;
  previewUrl: string;
}

export default function InspectPumpPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { user, master, ensureLoaded, refreshMaster, error: bootError } = useAppData();
  const [pump, setPump] = useState<PumpInfo | null>(null);
  const [presets, setPresets] = useState<MasterIssuePreset[]>([]);
  const [lastItems, setLastItems] = useState<PreviousInspectionItem[]>([]);

  const [inspectedAt, setInspectedAt] = useState(() => new Date().toISOString().slice(0, 10));
  const [unitStatus, setUnitStatus] = useState<"aktif" | "perlu_perbaikan" | "rusak_total">(
    "aktif"
  );
  const [generalNotes, setGeneralNotes] = useState("");
  const [operatingHoursInput, setOperatingHoursInput] = useState("");
  const [operationalNote, setOperationalNote] = useState("");
  const [operationalCategory, setOperationalCategory] = useState<OperationalCategory>("none");
  const [repairStatus, setRepairStatus] = useState("");
  const [isPreOrder, setIsPreOrder] = useState(false);
  const [showLocationModal, setShowLocationModal] = useState(false);

  const [items, setItems] = useState<FormItemState[]>([]);
  const [photos, setPhotos] = useState<UploadedPhotoState[]>([]);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [boot, detailRes] = await Promise.all([
        ensureLoaded(),
        fetchJson<{
          pump: PumpInfo;
          templateParts: MasterPumpTypePart[];
          inspections: Array<{
            unitStatus: "aktif" | "perlu_perbaikan" | "rusak_total";
            items: PreviousInspectionItem[];
          }>;
        }>(`/api/pumps/${params.id}`),
      ]);

      const issuePresets = boot?.master.issuePresets ?? [];
      setPump(detailRes.pump);
      setOperationalNote(detailRes.pump.operationalNote ?? "");
      setOperationalCategory(
        (detailRes.pump.operationalCategory as OperationalCategory) || "none"
      );
      setRepairStatus(detailRes.pump.repairStatus ?? "");
      setIsPreOrder(Boolean(detailRes.pump.isPreOrder));
      setPresets(issuePresets);

      const normalPreset = issuePresets.find(
        (p) => p.label.toLowerCase() === "normal / baik"
      );

      const latest = detailRes.inspections[0];
      if (latest) {
        setUnitStatus(latest.unitStatus);
        setLastItems(latest.items);
      }

      const initialItems: FormItemState[] = detailRes.templateParts.map((part, idx) => ({
        partId: part.id,
        sectionCode: part.sectionCode,
        sectionName: part.sectionName,
        itemNo: part.itemNo,
        partName: part.partName,
        expectedQty: part.defaultQty,
        availability: "ada",
        condition: "baik",
        issuePresetId: normalPreset?.id ?? null,
        notes: "",
        sortOrder: part.sortOrder || idx + 1,
      }));
      setItems(initialItems);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal memuat formulir pemeriksaan.");
    } finally {
      setLoading(false);
    }
  }, [ensureLoaded, params.id]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  function applyAllNormal() {
    const normalPreset = presets.find((p) => p.label.toLowerCase() === "normal / baik");
    setItems((prev) =>
      prev.map((item) => ({
        ...item,
        availability: "ada",
        condition: "baik",
        issuePresetId: normalPreset?.id ?? null,
        notes: "",
      }))
    );
    setUnitStatus("aktif");
  }

  function copyFromLastInspection() {
    if (lastItems.length === 0) return;
    setItems((prev) =>
      prev.map((item) => {
        const match = lastItems.find(
          (li) =>
            (li.partId && li.partId === item.partId) ||
            (li.sectionCode === item.sectionCode && li.itemNo === item.itemNo)
        );
        if (!match) return item;
        return {
          ...item,
          availability: match.availability,
          condition: match.condition,
          issuePresetId: match.issuePresetId,
          notes: match.notes ?? "",
        };
      })
    );
  }

  function updateItem(index: number, patch: Partial<FormItemState>) {
    setItems((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], ...patch };
      return next;
    });
  }

  function handlePresetSelect(index: number, presetIdStr: string) {
    const presetId = presetIdStr ? Number(presetIdStr) : null;
    const found = presets.find((p) => p.id === presetId);
    if (!found) {
      updateItem(index, { issuePresetId: null });
      return;
    }
    updateItem(index, {
      issuePresetId: found.id,
      availability: found.defaultAvailability,
      condition: found.defaultCondition,
    });
  }

  async function handlePhotoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files;
    if (!files || files.length === 0 || !pump) return;

    setUploadingPhoto(true);
    setError(null);
    try {
      const fileList = Array.from(files);
      const baseSeq = photos.length;
      const uploadedBatch: UploadedPhotoState[] = [];
      const concurrency = 3;

      for (let start = 0; start < fileList.length; start += concurrency) {
        const slice = fileList.slice(start, start + concurrency);
        const results = await Promise.all(
          slice.map(async (rawFile, offset) => {
            const seq = baseSeq + start + offset + 1;
            const compressed = await compressImageFile(rawFile);
            const fd = new FormData();
            fd.append("file", compressed);
            fd.append("pumpId", String(pump.id));
            fd.append("inspectedAt", inspectedAt);
            fd.append("sequence", String(seq));

            const res = await fetch("/api/photos/upload", {
              method: "POST",
              body: fd,
            });
            const data = await res.json();
            if (!res.ok) {
              throw new Error(data.error || "Gagal mengunggah foto.");
            }

            return {
              ...data.photo,
              caption: "",
              previewUrl: URL.createObjectURL(compressed),
            } as UploadedPhotoState;
          })
        );
        uploadedBatch.push(...results);
      }

      setPhotos((prev) => [...prev, ...uploadedBatch]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal mengunggah foto.");
    } finally {
      setUploadingPhoto(false);
      e.target.value = "";
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!pump) return;

    let parsedHours: number | null = null;
    if (operatingHoursInput.trim() !== "") {
      const n = Number(operatingHoursInput.trim());
      if (!Number.isFinite(n) || n < 0 || n > 24) {
        setError("Jam operasional harus bernilai antara 0 sampai 24 jam.");
        return;
      }
      parsedHours = n;
    }

    setSubmitting(true);
    setError(null);

    try {
      await fetchJson("/api/inspections", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pumpId: pump.id,
          inspectedAt,
          unitStatus,
          notes: generalNotes.trim() || null,
          operatingHours: parsedHours,
          operationalNote: operationalNote.trim() || null,
          operationalCategory,
          repairStatus: repairStatus.trim() || null,
          isPreOrder,
          items: items.map((item) => ({
            ...item,
            notes: item.notes.trim() || null,
          })),
          photos: photos.map((p) => ({
            storageProvider: p.storageProvider,
            storageKey: p.storageKey,
            fileName: p.fileName,
            mimeType: p.mimeType,
            caption: p.caption.trim() || null,
          })),
        }),
      });

      router.push(`/pumps/${pump.id}`);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal menyimpan pemeriksaan.");
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-field-bg p-6">
        <LoadingState message="Menyiapkan formulir pemeriksaan..." />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-field-bg p-6">
        <ErrorState
          title="Gagal memuat formulir pemeriksaan"
          message={error || bootError || "Terjadi gangguan koneksi ke server."}
          onRetry={loadData}
        />
      </div>
    );
  }

  if (!pump) {
    return (
      <AppShell user={user} title="Form Pemeriksaan">
        <ErrorState message={error || "Pompa tidak ditemukan."} onRetry={loadData} />
      </AppShell>
    );
  }

  // Group items by section
  const sections: Array<{ key: string; title: string; indices: number[] }> = [];
  items.forEach((item, idx) => {
    const key = `${item.sectionCode}:${item.sectionName}`;
    let grp = sections.find((s) => s.key === key);
    if (!grp) {
      grp = { key, title: `${item.sectionCode}. ${item.sectionName}`, indices: [] };
      sections.push(grp);
    }
    grp.indices.push(idx);
  });

  const locBadge = getPumpLocationBadgeInfo({
    blockId: pump.blockId,
    blockCode: pump.blockCode,
    estateCode: pump.estateCode,
  });

  return (
    <AppShell
      user={user}
      title={`Periksa ${pump.pumpCode}`}
      subtitle={`${locBadge.label} • ${pump.pumpTypeName} • ${pump.engineBrandName}`}
    >
      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <Link
            href={`/pumps/${pump.id}`}
            className="inline-flex min-h-[44px] items-center gap-1.5 rounded-md border border-field-border bg-field-surface px-3 text-sm font-semibold text-field-ink"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            <span>Batal</span>
          </Link>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={applyAllNormal}
              className="min-h-[44px] rounded-md border border-field-border bg-field-surface px-3 text-xs font-semibold text-field-ink hover:bg-[#EAEFEA]"
            >
              Set Semua Ada & Baik
            </button>
            {lastItems.length > 0 && (
              <button
                type="button"
                onClick={copyFromLastInspection}
                className="min-h-[44px] rounded-md border border-field-border bg-field-surface px-3 text-xs font-semibold text-field-ink hover:bg-[#EAEFEA]"
              >
                Samakan Pemeriksaan Terakhir
              </button>
            )}
          </div>
        </div>

        {error && <ErrorState message={error} />}

        {/* Header Info */}
        <section className="rounded-lg border border-field-border bg-field-surface p-4 space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label
                htmlFor="inspect-date"
                className="mb-1 block text-xs font-semibold text-field-muted"
              >
                Tanggal Pemeriksaan
              </label>
              <input
                id="inspect-date"
                type="date"
                required
                value={inspectedAt}
                onChange={(e) => setInspectedAt(e.target.value)}
                className="min-h-[44px] w-full rounded-md border border-field-border bg-white px-3 text-sm text-field-ink"
              />
            </div>

            <div>
              <label
                htmlFor="inspect-user"
                className="mb-1 block text-xs font-semibold text-field-muted"
              >
                Pemeriksa (Otomatis dari Akun)
              </label>
              <input
                id="inspect-user"
                type="text"
                readOnly
                value={user.name}
                className="min-h-[44px] w-full rounded-md border border-field-border bg-field-bg px-3 text-sm font-medium text-field-ink"
              />
            </div>
          </div>

          <div>
            <span className="mb-2 block text-xs font-semibold text-field-muted">
              Status Operasional Unit Keseluruhan
            </span>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
              {[
                {
                  val: "aktif" as const,
                  label: "Aktif",
                  activeCls: "border-[#15803D] bg-[#DCFCE7] text-[#166534]",
                },
                {
                  val: "perlu_perbaikan" as const,
                  label: "Perlu Perbaikan",
                  activeCls: "border-[#D97706] bg-[#FEF3C7] text-[#92400E]",
                },
                {
                  val: "rusak_total" as const,
                  label: "Rusak Total",
                  activeCls: "border-[#DC2626] bg-[#FEE2E2] text-[#991B1B]",
                },
              ].map((opt) => (
                <button
                  key={opt.val}
                  type="button"
                  aria-pressed={unitStatus === opt.val}
                  onClick={() => setUnitStatus(opt.val)}
                  className={`flex min-h-[48px] items-center justify-center gap-2 rounded-md border-2 px-4 text-sm font-bold ${
                    unitStatus === opt.val
                      ? opt.activeCls
                      : "border-field-border bg-white text-field-ink hover:bg-field-bg"
                  }`}
                >
                  {unitStatus === opt.val && <Check className="h-4 w-4" aria-hidden="true" />}
                  <span>{opt.label}</span>
                </button>
              ))}
            </div>
          </div>

          <div>
            <label
              htmlFor="inspect-notes"
              className="mb-1 block text-xs font-semibold text-field-muted"
            >
              Catatan Ringkas Unit (Opsional)
            </label>
            <input
              id="inspect-notes"
              type="text"
              value={generalNotes}
              onChange={(e) => setGeneralNotes(e.target.value)}
              placeholder="Isi hanya jika ada informasi tambahan di luar checklist"
              className="min-h-[44px] w-full rounded-md border border-field-border bg-white px-3 text-sm text-field-ink"
            />
          </div>

          <div className="grid grid-cols-1 gap-4 border-t border-field-border pt-4 sm:grid-cols-2">
            <div>
              <div className="mb-1 flex items-center justify-between gap-2">
                <span className="text-xs font-semibold text-field-muted">
                  Lokasi Penempatan Pompa
                </span>
                <button
                  type="button"
                  onClick={() => setShowLocationModal(true)}
                  className="inline-flex min-h-[32px] items-center gap-1 rounded border border-field-border bg-field-bg px-2 text-xs font-semibold text-field-ink hover:bg-[#EAEFEA]"
                >
                  <MapPin className="h-3 w-3" aria-hidden="true" />
                  <span>{locBadge.assigned ? "Ganti Lokasi" : "Assign Lokasi"}</span>
                </button>
              </div>
              <div
                className={`flex min-h-[44px] items-center gap-2 rounded-md border px-3 text-xs font-semibold ${
                  locBadge.assigned
                    ? "border-[#86EFAC] bg-[#DCFCE7] font-mono text-[#166534]"
                    : "border-[#FCD34D] bg-[#FEF3C7] text-[#92400E]"
                }`}
              >
                <MapPin className="h-4 w-4 shrink-0" aria-hidden="true" />
                <span>{locBadge.label}</span>
              </div>
            </div>

            <div>
              <label
                htmlFor="inspect-op-hours"
                className="mb-1 block text-xs font-semibold text-field-muted"
              >
                Jam Operasional Tanggal Ini (Opsional)
              </label>
              {pump.isLocationAssigned ? (
                <input
                  id="inspect-op-hours"
                  type="number"
                  inputMode="decimal"
                  min={0}
                  max={24}
                  step="0.5"
                  value={operatingHoursInput}
                  onChange={(e) => setOperatingHoursInput(e.target.value)}
                  placeholder="Kosongkan jika tidak beroperasi"
                  className="min-h-[44px] w-full rounded-md border border-field-border bg-white px-3 font-mono text-sm text-field-ink"
                />
              ) : (
                <div className="flex min-h-[44px] items-center gap-2 rounded-md border border-field-border bg-field-bg px-3 text-xs text-field-muted">
                  <Lock className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                  <span>Assign lokasi blok lapangan dulu untuk mencatat jam kerja.</span>
                </div>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div>
              <label
                htmlFor="inspect-op-note"
                className="mb-1 block text-xs font-semibold text-field-muted"
              >
                Keterangan Monitoring (Opsional)
              </label>
              <input
                id="inspect-op-note"
                type="text"
                value={operationalNote}
                onChange={(e) => setOperationalNote(e.target.value)}
                placeholder="Mis. Aktif, lokasi rawan banjir (TBM)"
                className="min-h-[44px] w-full rounded-md border border-field-border bg-white px-3 text-sm text-field-ink"
              />
            </div>
            <div>
              <label
                htmlFor="inspect-repair-status"
                className="mb-1 block text-xs font-semibold text-field-muted"
              >
                Status Tindak Lanjut (Opsional)
              </label>
              <input
                id="inspect-repair-status"
                type="text"
                value={repairStatus}
                onChange={(e) => setRepairStatus(e.target.value)}
                placeholder="Mis. Perbaikan Tim Traksi"
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
        </section>

        {/* Component Checklist */}
        {sections.map((section) => (
          <section
            key={section.key}
            className="rounded-lg border border-field-border bg-field-surface"
          >
            <div className="border-b border-field-border bg-field-bg px-4 py-2.5">
              <h2 className="text-sm font-bold text-field-ink">{section.title}</h2>
            </div>

            <div className="divide-y divide-field-border">
              {section.indices.map((idx) => {
                const item = items[idx];
                const isIssue =
                  item.availability !== "ada" || item.condition === "rusak";
                return (
                  <div
                    key={`${item.sectionCode}-${item.itemNo}-${idx}`}
                    className={`space-y-3 p-4 ${isIssue ? "bg-[#FFFBEB]/60" : ""}`}
                  >
                    <div className="flex flex-wrap items-baseline justify-between gap-2">
                      <p className="text-sm font-semibold text-field-ink">
                        {item.itemNo > 0 ? `${item.itemNo}. ` : ""}
                        {item.partName}
                      </p>
                      <span className="font-mono text-xs text-field-muted">
                        Qty standar: {item.expectedQty}
                      </span>
                    </div>

                    <div className="grid grid-cols-1 gap-3 lg:grid-cols-12">
                      {/* Ketersediaan */}
                      <div className="lg:col-span-4">
                        <span className="mb-1 block text-xs font-medium text-field-muted">
                          Ketersediaan
                        </span>
                        <div className="grid grid-cols-3 gap-1.5">
                          {(
                            [
                              { val: "ada", label: "Ada" },
                              { val: "tidak_lengkap", label: "Kurang" },
                              { val: "hilang", label: "Hilang" },
                            ] as const
                          ).map((opt) => (
                            <button
                              key={opt.val}
                              type="button"
                              aria-pressed={item.availability === opt.val}
                              onClick={() => updateItem(idx, { availability: opt.val })}
                              className={`min-h-[44px] rounded border px-2 text-xs font-semibold ${
                                item.availability === opt.val
                                  ? opt.val === "ada"
                                    ? "border-[#15803D] bg-[#DCFCE7] text-[#166534]"
                                    : opt.val === "tidak_lengkap"
                                      ? "border-[#D97706] bg-[#FEF3C7] text-[#92400E]"
                                      : "border-[#DC2626] bg-[#FEE2E2] text-[#991B1B]"
                                  : "border-field-border bg-white text-field-ink"
                              }`}
                            >
                              {opt.label}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Kondisi */}
                      <div className="lg:col-span-3">
                        <span className="mb-1 block text-xs font-medium text-field-muted">
                          Kondisi
                        </span>
                        <div className="grid grid-cols-2 gap-1.5">
                          {(
                            [
                              { val: "baik", label: "Baik" },
                              { val: "rusak", label: "Rusak" },
                            ] as const
                          ).map((opt) => (
                            <button
                              key={opt.val}
                              type="button"
                              aria-pressed={item.condition === opt.val}
                              onClick={() => updateItem(idx, { condition: opt.val })}
                              className={`min-h-[44px] rounded border px-2 text-xs font-semibold ${
                                item.condition === opt.val
                                  ? opt.val === "baik"
                                    ? "border-[#15803D] bg-[#DCFCE7] text-[#166534]"
                                    : "border-[#DC2626] bg-[#FEE2E2] text-[#991B1B]"
                                  : "border-field-border bg-white text-field-ink"
                              }`}
                            >
                              {opt.label}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Temuan Standar Dropdown (Minimizing free text) */}
                      <div className="lg:col-span-3">
                        <label
                          htmlFor={`preset-${idx}`}
                          className="mb-1 block text-xs font-medium text-field-muted"
                        >
                          Temuan Standar
                        </label>
                        <select
                          id={`preset-${idx}`}
                          value={item.issuePresetId ? String(item.issuePresetId) : ""}
                          onChange={(e) => handlePresetSelect(idx, e.target.value)}
                          className="min-h-[44px] w-full rounded border border-field-border bg-white px-2.5 text-xs font-medium text-field-ink"
                        >
                          <option value="">Pilih Temuan</option>
                          {presets.map((p) => (
                            <option key={p.id} value={String(p.id)}>
                              {p.label}
                            </option>
                          ))}
                        </select>
                      </div>

                      {/* Optional short detail */}
                      <div className="lg:col-span-2">
                        <label
                          htmlFor={`note-${idx}`}
                          className="mb-1 block text-xs font-medium text-field-muted"
                        >
                          Detail (Opsional)
                        </label>
                        <input
                          id={`note-${idx}`}
                          type="text"
                          value={item.notes}
                          onChange={(e) => updateItem(idx, { notes: e.target.value })}
                          placeholder="Mis. sisa 2"
                          className="min-h-[44px] w-full rounded border border-field-border bg-white px-2.5 text-xs text-field-ink"
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        ))}

        {/* Photo Upload */}
        <section className="rounded-lg border border-field-border bg-field-surface p-4 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="text-sm font-bold text-field-ink">Dokumentasi Foto Lapangan</h2>
              <p className="text-xs text-field-muted">
                Foto dikompresi otomatis sebelum disimpan ke Google Drive.
              </p>
            </div>
            <label className="inline-flex min-h-[44px] items-center gap-2 rounded-md border border-field-accent bg-[#DCFCE7] px-4 text-sm font-semibold text-[#166534] hover:bg-[#BBF7D0]">
              <Camera className="h-4 w-4" aria-hidden="true" />
              <span>{uploadingPhoto ? "Mengunggah..." : "Ambil / Pilih Foto"}</span>
              <input
                type="file"
                accept="image/*"
                multiple
                capture="environment"
                disabled={uploadingPhoto}
                onChange={handlePhotoUpload}
                className="sr-only"
              />
            </label>
          </div>

          {photos.length > 0 && (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3">
              {photos.map((photo, idx) => (
                <div
                  key={photo.storageKey}
                  className="rounded-md border border-field-border bg-field-bg p-2.5 space-y-2"
                >
                  <img
                    src={photo.previewUrl}
                    alt={photo.caption || `Foto ${idx + 1}`}
                    width={400}
                    height={300}
                    className="aspect-[4/3] w-full rounded object-cover"
                  />
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      aria-label={`Keterangan foto ${idx + 1}`}
                      value={photo.caption}
                      onChange={(e) => {
                        const val = e.target.value;
                        setPhotos((prev) =>
                          prev.map((p, i) => (i === idx ? { ...p, caption: val } : p))
                        );
                      }}
                      placeholder="Keterangan singkat (opsional)"
                      className="min-h-[44px] min-w-0 flex-1 rounded border border-field-border bg-white px-2.5 text-xs"
                    />
                    <button
                      type="button"
                      aria-label={`Hapus foto ${idx + 1}`}
                      onClick={() =>
                        setPhotos((prev) => prev.filter((_, i) => i !== idx))
                      }
                      className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded border border-[#FCA5A5] bg-[#FEE2E2] text-[#991B1B]"
                    >
                      <Trash2 className="h-4 w-4" aria-hidden="true" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        <div className="flex justify-end">
          <button
            type="submit"
            disabled={submitting || uploadingPhoto}
            className="min-h-[48px] w-full rounded-md bg-field-accent px-6 text-sm font-bold text-white hover:bg-field-accent-hover disabled:opacity-60 sm:w-auto"
          >
            {submitting ? "Menyimpan Pemeriksaan..." : "Simpan Pemeriksaan"}
          </button>
        </div>
      </form>

      {showLocationModal && master && (
        <PumpLocationDialog
          pump={pump}
          master={master}
          initialTab="location"
          onClose={() => setShowLocationModal(false)}
          onSaved={async (createdBlock) => {
            if (createdBlock) {
              await refreshMaster();
            }
            await loadData();
          }}
        />
      )}
    </AppShell>
  );
}
