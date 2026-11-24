"use client";

import { useEffect, useId, useState } from "react";
import { X } from "lucide-react";
import {
  MasterBlock,
  MasterCompany,
  MasterEngineBrand,
  MasterEstate,
  MasterIssuePreset,
  MasterPumpType,
  MasterPumpTypePart,
  MasterRegion,
  MasterTreeData,
} from "@/components/HierarchyFilterBar";
import { fetchJson } from "@/lib/client-fetch";

export type MasterEditTarget =
  | { kind: "company"; item: MasterCompany }
  | { kind: "region"; item: MasterRegion }
  | { kind: "estate"; item: MasterEstate }
  | { kind: "block"; item: MasterBlock }
  | { kind: "pump_type"; item: MasterPumpType }
  | { kind: "pump_type_part"; item: MasterPumpTypePart }
  | { kind: "engine_brand"; item: MasterEngineBrand }
  | { kind: "issue_preset"; item: MasterIssuePreset };

const TARGET_TITLES: Record<MasterEditTarget["kind"], string> = {
  company: "Edit PT / Perusahaan",
  region: "Edit Region",
  estate: "Edit Estate",
  block: "Edit Block / Lokasi",
  pump_type: "Edit Jenis Pompa",
  pump_type_part: "Edit Komponen Template",
  engine_brand: "Edit Merek Mesin",
  issue_preset: "Edit Temuan Standar",
};

export function MasterEditDialog({
  target,
  master,
  onClose,
  onSaved,
}: {
  target: MasterEditTarget;
  master: MasterTreeData;
  onClose: () => void;
  onSaved: (successMsg: string) => Promise<void> | void;
}) {
  const titleId = useId();
  const fieldPrefix = useId();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [code, setCode] = useState(() => {
    switch (target.kind) {
      case "company":
      case "region":
      case "estate":
      case "block":
      case "pump_type":
        return target.item.code;
      case "pump_type_part":
        return target.item.sectionCode;
      default:
        return "";
    }
  });

  const [name, setName] = useState(() => {
    switch (target.kind) {
      case "company":
      case "region":
      case "estate":
      case "block":
      case "pump_type":
      case "engine_brand":
        return target.item.name;
      case "pump_type_part":
        return target.item.partName;
      case "issue_preset":
        return target.item.label;
    }
  });

  const [parentId, setParentId] = useState(() => {
    if (target.kind === "region") return String(target.item.companyId);
    if (target.kind === "estate") return String(target.item.regionId);
    if (target.kind === "block") return String(target.item.estateId);
    return "";
  });

  const [description, setDescription] = useState(() =>
    target.kind === "pump_type" ? (target.item.description ?? "") : ""
  );

  const [sortOrder, setSortOrder] = useState(() => {
    if (target.kind === "estate") return String(target.item.sortOrder ?? 0);
    if (target.kind === "pump_type_part") return String(target.item.sortOrder ?? 0);
    if (target.kind === "issue_preset") return String(target.item.sortOrder ?? 0);
    return "0";
  });

  const [sectionName, setSectionName] = useState(() =>
    target.kind === "pump_type_part" ? target.item.sectionName : ""
  );
  const [itemNo, setItemNo] = useState(() =>
    target.kind === "pump_type_part" ? String(target.item.itemNo) : "1"
  );
  const [defaultQty, setDefaultQty] = useState(() =>
    target.kind === "pump_type_part" ? String(target.item.defaultQty) : "1"
  );

  const [defaultAvailability, setDefaultAvailability] = useState<
    "ada" | "tidak_lengkap" | "hilang"
  >(() => (target.kind === "issue_preset" ? target.item.defaultAvailability : "ada"));
  const [defaultCondition, setDefaultCondition] = useState<"baik" | "rusak">(() =>
    target.kind === "issue_preset" ? target.item.defaultCondition : "rusak"
  );

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape" && !saving) {
        onClose();
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose, saving]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);

    try {
      let url = "";
      let payload: Record<string, unknown> = {};
      let successMsg = "Data master berhasil diperbarui.";

      switch (target.kind) {
        case "company": {
          url = "/api/master/companies";
          payload = { id: target.item.id, code, name };
          successMsg = `PT ${code.trim().toUpperCase()} berhasil diperbarui.`;
          break;
        }
        case "region": {
          url = "/api/master/regions";
          payload = { id: target.item.id, companyId: Number(parentId), code, name };
          successMsg = `Region ${code.trim().toUpperCase()} berhasil diperbarui.`;
          break;
        }
        case "estate": {
          const parsedOrder = sortOrder.trim() === "" ? 0 : Number(sortOrder.trim());
          if (!Number.isInteger(parsedOrder) || parsedOrder < 0 || parsedOrder > 9999) {
            throw new Error("Nomor urut Estate harus bilangan bulat antara 0 sampai 9999.");
          }
          url = "/api/master/estates";
          payload = {
            id: target.item.id,
            regionId: Number(parentId),
            code,
            name,
            sortOrder: parsedOrder,
          };
          successMsg = `Estate ${code.trim().toUpperCase()} berhasil diperbarui.`;
          break;
        }
        case "block": {
          url = "/api/master/blocks";
          payload = { id: target.item.id, estateId: Number(parentId), code, name };
          successMsg = `Block ${code.trim()} berhasil diperbarui.`;
          break;
        }
        case "pump_type": {
          url = "/api/master/pump-types";
          payload = {
            id: target.item.id,
            code,
            name,
            description: description.trim() || null,
          };
          successMsg = `Jenis Pompa ${name.trim()} berhasil diperbarui.`;
          break;
        }
        case "pump_type_part": {
          const parsedItemNo = Number(itemNo);
          const parsedQty = Number(defaultQty);
          const parsedSort = Number(sortOrder);
          if (!Number.isInteger(parsedItemNo) || parsedItemNo < 0) {
            throw new Error("Nomor item komponen harus 0 atau lebih.");
          }
          if (!Number.isInteger(parsedQty) || parsedQty < 1) {
            throw new Error("Qty standar minimal 1.");
          }
          if (!Number.isInteger(parsedSort) || parsedSort < 0) {
            throw new Error("Urutan komponen harus 0 atau lebih.");
          }
          url = `/api/master/pump-types/${target.item.pumpTypeId}/parts`;
          payload = {
            partId: target.item.id,
            sectionCode: code,
            sectionName,
            itemNo: parsedItemNo,
            partName: name,
            defaultQty: parsedQty,
            sortOrder: parsedSort,
          };
          successMsg = `Komponen "${name.trim()}" berhasil diperbarui.`;
          break;
        }
        case "engine_brand": {
          url = "/api/master/engine-brands";
          payload = { id: target.item.id, name };
          successMsg = `Merek Mesin "${name.trim()}" berhasil diperbarui.`;
          break;
        }
        case "issue_preset": {
          const parsedSort = Number(sortOrder);
          if (!Number.isInteger(parsedSort) || parsedSort < 0) {
            throw new Error("Urutan temuan harus 0 atau lebih.");
          }
          url = "/api/master/issue-presets";
          payload = {
            id: target.item.id,
            label: name,
            defaultAvailability,
            defaultCondition,
            sortOrder: parsedSort,
          };
          successMsg = `Temuan standar "${name.trim()}" berhasil diperbarui.`;
          break;
        }
      }

      await fetchJson(url, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      await onSaved(successMsg);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal menyimpan perubahan.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      onClick={() => {
        if (!saving) onClose();
      }}
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/45 p-0 sm:items-center sm:p-4"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="max-h-[92vh] w-full overflow-y-auto rounded-t-xl border border-field-border bg-field-surface shadow-xl sm:max-w-lg sm:rounded-xl"
      >
        <div className="flex items-start justify-between gap-3 border-b border-field-border px-4 py-3.5 sm:px-5">
          <div>
            <p className="text-xs font-semibold text-field-muted">Kelola Master Data</p>
            <h2 id={titleId} className="text-base font-bold text-field-ink">
              {TARGET_TITLES[target.kind]}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            aria-label="Tutup dialog edit"
            className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-md border border-field-border bg-field-bg text-field-ink hover:bg-[#EAEFEA] disabled:opacity-50"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
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

          {target.kind === "region" && (
            <div>
              <label
                htmlFor={`${fieldPrefix}-company`}
                className="mb-1 block text-xs font-semibold text-field-muted"
              >
                PT Induk
              </label>
              <select
                id={`${fieldPrefix}-company`}
                required
                value={parentId}
                onChange={(e) => setParentId(e.target.value)}
                className="min-h-[44px] w-full rounded-md border border-field-border bg-white px-3 text-sm text-field-ink"
              >
                {master.companies.map((c) => (
                  <option key={c.id} value={String(c.id)}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {target.kind === "estate" && (
            <div>
              <label
                htmlFor={`${fieldPrefix}-region`}
                className="mb-1 block text-xs font-semibold text-field-muted"
              >
                Region Induk
              </label>
              <select
                id={`${fieldPrefix}-region`}
                required
                value={parentId}
                onChange={(e) => setParentId(e.target.value)}
                className="min-h-[44px] w-full rounded-md border border-field-border bg-white px-3 text-sm text-field-ink"
              >
                {master.regions.map((r) => (
                  <option key={r.id} value={String(r.id)}>
                    {r.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {target.kind === "block" && (
            <div>
              <label
                htmlFor={`${fieldPrefix}-estate`}
                className="mb-1 block text-xs font-semibold text-field-muted"
              >
                Estate Induk
              </label>
              <select
                id={`${fieldPrefix}-estate`}
                required
                value={parentId}
                onChange={(e) => setParentId(e.target.value)}
                className="min-h-[44px] w-full rounded-md border border-field-border bg-white px-3 text-sm text-field-ink"
              >
                {master.estates.map((es) => (
                  <option key={es.id} value={String(es.id)}>
                    {es.code} - {es.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {(target.kind === "company" ||
            target.kind === "region" ||
            target.kind === "estate" ||
            target.kind === "block" ||
            target.kind === "pump_type") && (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label
                  htmlFor={`${fieldPrefix}-code`}
                  className="mb-1 block text-xs font-semibold text-field-muted"
                >
                  Kode
                </label>
                <input
                  id={`${fieldPrefix}-code`}
                  required
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  className="min-h-[44px] w-full rounded-md border border-field-border px-3 font-mono text-sm text-field-ink"
                />
              </div>
              <div>
                <label
                  htmlFor={`${fieldPrefix}-name`}
                  className="mb-1 block text-xs font-semibold text-field-muted"
                >
                  Nama
                </label>
                <input
                  id={`${fieldPrefix}-name`}
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="min-h-[44px] w-full rounded-md border border-field-border px-3 text-sm text-field-ink"
                />
              </div>
            </div>
          )}

          {target.kind === "estate" && (
            <div>
              <label
                htmlFor={`${fieldPrefix}-sort`}
                className="mb-1 block text-xs font-semibold text-field-muted"
              >
                No. Urut (0 = tampil di akhir)
              </label>
              <input
                id={`${fieldPrefix}-sort`}
                type="number"
                min={0}
                max={9999}
                step={1}
                inputMode="numeric"
                value={sortOrder}
                onChange={(e) => setSortOrder(e.target.value)}
                className="min-h-[44px] w-full rounded-md border border-field-border px-3 font-mono text-sm tabular-nums text-field-ink"
              />
            </div>
          )}

          {target.kind === "pump_type" && (
            <div>
              <label
                htmlFor={`${fieldPrefix}-desc`}
                className="mb-1 block text-xs font-semibold text-field-muted"
              >
                Deskripsi (Opsional)
              </label>
              <input
                id={`${fieldPrefix}-desc`}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Keterangan singkat jenis pompa"
                className="min-h-[44px] w-full rounded-md border border-field-border px-3 text-sm text-field-ink"
              />
            </div>
          )}

          {target.kind === "pump_type_part" && (
            <div className="space-y-3">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <div>
                  <label
                    htmlFor={`${fieldPrefix}-sec-code`}
                    className="mb-1 block text-xs font-semibold text-field-muted"
                  >
                    Kode Bagian
                  </label>
                  <input
                    id={`${fieldPrefix}-sec-code`}
                    required
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                    className="min-h-[44px] w-full rounded-md border border-field-border px-3 font-mono text-sm text-field-ink"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label
                    htmlFor={`${fieldPrefix}-sec-name`}
                    className="mb-1 block text-xs font-semibold text-field-muted"
                  >
                    Nama Bagian
                  </label>
                  <input
                    id={`${fieldPrefix}-sec-name`}
                    required
                    value={sectionName}
                    onChange={(e) => setSectionName(e.target.value)}
                    className="min-h-[44px] w-full rounded-md border border-field-border px-3 text-sm text-field-ink"
                  />
                </div>
              </div>

              <div>
                <label
                  htmlFor={`${fieldPrefix}-part-name`}
                  className="mb-1 block text-xs font-semibold text-field-muted"
                >
                  Nama Komponen
                </label>
                <input
                  id={`${fieldPrefix}-part-name`}
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="min-h-[44px] w-full rounded-md border border-field-border px-3 text-sm text-field-ink"
                />
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label
                    htmlFor={`${fieldPrefix}-item-no`}
                    className="mb-1 block text-xs font-semibold text-field-muted"
                  >
                    No Item
                  </label>
                  <input
                    id={`${fieldPrefix}-item-no`}
                    type="number"
                    min={0}
                    required
                    value={itemNo}
                    onChange={(e) => setItemNo(e.target.value)}
                    className="min-h-[44px] w-full rounded-md border border-field-border px-3 font-mono text-sm tabular-nums text-field-ink"
                  />
                </div>
                <div>
                  <label
                    htmlFor={`${fieldPrefix}-qty`}
                    className="mb-1 block text-xs font-semibold text-field-muted"
                  >
                    Qty Standar
                  </label>
                  <input
                    id={`${fieldPrefix}-qty`}
                    type="number"
                    min={1}
                    required
                    value={defaultQty}
                    onChange={(e) => setDefaultQty(e.target.value)}
                    className="min-h-[44px] w-full rounded-md border border-field-border px-3 font-mono text-sm tabular-nums text-field-ink"
                  />
                </div>
                <div>
                  <label
                    htmlFor={`${fieldPrefix}-part-sort`}
                    className="mb-1 block text-xs font-semibold text-field-muted"
                  >
                    Urutan
                  </label>
                  <input
                    id={`${fieldPrefix}-part-sort`}
                    type="number"
                    min={0}
                    required
                    value={sortOrder}
                    onChange={(e) => setSortOrder(e.target.value)}
                    className="min-h-[44px] w-full rounded-md border border-field-border px-3 font-mono text-sm tabular-nums text-field-ink"
                  />
                </div>
              </div>
            </div>
          )}

          {target.kind === "engine_brand" && (
            <div>
              <label
                htmlFor={`${fieldPrefix}-engine`}
                className="mb-1 block text-xs font-semibold text-field-muted"
              >
                Nama Merek Mesin
              </label>
              <input
                id={`${fieldPrefix}-engine`}
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="min-h-[44px] w-full rounded-md border border-field-border px-3 text-sm text-field-ink"
              />
            </div>
          )}

          {target.kind === "issue_preset" && (
            <div className="space-y-3">
              <div>
                <label
                  htmlFor={`${fieldPrefix}-preset-label`}
                  className="mb-1 block text-xs font-semibold text-field-muted"
                >
                  Label Temuan
                </label>
                <input
                  id={`${fieldPrefix}-preset-label`}
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="min-h-[44px] w-full rounded-md border border-field-border px-3 text-sm text-field-ink"
                />
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <div>
                  <label
                    htmlFor={`${fieldPrefix}-preset-avail`}
                    className="mb-1 block text-xs font-semibold text-field-muted"
                  >
                    Default Ketersediaan
                  </label>
                  <select
                    id={`${fieldPrefix}-preset-avail`}
                    value={defaultAvailability}
                    onChange={(e) =>
                      setDefaultAvailability(
                        e.target.value as "ada" | "tidak_lengkap" | "hilang"
                      )
                    }
                    className="min-h-[44px] w-full rounded-md border border-field-border bg-white px-3 text-sm text-field-ink"
                  >
                    <option value="ada">Ada</option>
                    <option value="tidak_lengkap">Tidak Lengkap</option>
                    <option value="hilang">Hilang</option>
                  </select>
                </div>
                <div>
                  <label
                    htmlFor={`${fieldPrefix}-preset-cond`}
                    className="mb-1 block text-xs font-semibold text-field-muted"
                  >
                    Default Kondisi
                  </label>
                  <select
                    id={`${fieldPrefix}-preset-cond`}
                    value={defaultCondition}
                    onChange={(e) =>
                      setDefaultCondition(e.target.value as "baik" | "rusak")
                    }
                    className="min-h-[44px] w-full rounded-md border border-field-border bg-white px-3 text-sm text-field-ink"
                  >
                    <option value="baik">Baik</option>
                    <option value="rusak">Rusak</option>
                  </select>
                </div>
                <div>
                  <label
                    htmlFor={`${fieldPrefix}-preset-sort`}
                    className="mb-1 block text-xs font-semibold text-field-muted"
                  >
                    Urutan
                  </label>
                  <input
                    id={`${fieldPrefix}-preset-sort`}
                    type="number"
                    min={0}
                    required
                    value={sortOrder}
                    onChange={(e) => setSortOrder(e.target.value)}
                    className="min-h-[44px] w-full rounded-md border border-field-border px-3 font-mono text-sm tabular-nums text-field-ink"
                  />
                </div>
              </div>
            </div>
          )}

          <div className="flex flex-col-reverse gap-2 pt-2 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="min-h-[44px] rounded-md border border-field-border bg-field-bg px-4 text-sm font-semibold text-field-ink hover:bg-[#EAEFEA] disabled:opacity-50"
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
