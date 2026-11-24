"use client";

import { useCallback, useEffect, useState } from "react";
import { useAppData } from "@/components/AppDataProvider";
import { AppShell } from "@/components/AppShell";
import { ConfirmDeleteDialog } from "@/components/ConfirmDeleteDialog";
import { MasterTreeData } from "@/components/HierarchyFilterBar";
import { MasterEditDialog, MasterEditTarget } from "@/components/MasterEditDialog";
import { EmptyState, ErrorState, LoadingState } from "@/components/UiStates";
import { fetchJson } from "@/lib/client-fetch";

interface MasterDeleteTarget {
  title: string;
  description: string;
  url: string;
  payload: Record<string, unknown>;
  successMsg: string;
}

type MasterTab =
  | "pt"
  | "region"
  | "estate"
  | "block"
  | "pump_type"
  | "engine"
  | "preset";

export default function AdminMasterPage() {
  const { user, ensureLoaded, refreshMaster, error: bootError } = useAppData();
  const [master, setMaster] = useState<MasterTreeData | null>(null);
  const [tab, setTab] = useState<MasterTab>("pt");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  // Form states per tab
  const [ptCode, setPtCode] = useState("");
  const [ptName, setPtName] = useState("");

  const [regCompanyId, setRegCompanyId] = useState("");
  const [regCode, setRegCode] = useState("");
  const [regName, setRegName] = useState("");

  const [estRegionId, setEstRegionId] = useState("");
  const [estCode, setEstCode] = useState("");
  const [estName, setEstName] = useState("");
  const [estSortOrder, setEstSortOrder] = useState("");
  const [estateOrderDrafts, setEstateOrderDrafts] = useState<Record<number, string>>({});

  const [blkEstateId, setBlkEstateId] = useState("");
  const [blkCode, setBlkCode] = useState("");
  const [blkName, setBlkName] = useState("");

  const [ptTypeCode, setPtTypeCode] = useState("");
  const [ptTypeName, setPtTypeName] = useState("");
  const [ptTypeDesc, setPtTypeDesc] = useState("");
  const [selectedPumpTypeId, setSelectedPumpTypeId] = useState("");
  const [partSectionCode, setPartSectionCode] = useState("C");
  const [partSectionName, setPartSectionName] = useState("POMPA 1");
  const [partNo, setPartNo] = useState("1");
  const [partName, setPartName] = useState("");
  const [partQty, setPartQty] = useState("1");

  const [engineName, setEngineName] = useState("");

  const [presetLabel, setPresetLabel] = useState("");
  const [presetAvail, setPresetAvail] = useState<"ada" | "tidak_lengkap" | "hilang">("ada");
  const [presetCond, setPresetCond] = useState<"baik" | "rusak">("rusak");

  const [editTarget, setEditTarget] = useState<MasterEditTarget | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<MasterDeleteTarget | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [, treeRes] = await Promise.all([
        ensureLoaded(),
        fetchJson<MasterTreeData>("/api/master/tree?includeInactive=true", {
          cache: "no-store",
        }),
      ]);
      setMaster(treeRes);

      const nextDrafts: Record<number, string> = {};
      for (const es of treeRes.estates) {
        nextDrafts[es.id] = String(es.sortOrder ?? 0);
      }
      setEstateOrderDrafts(nextDrafts);

      if (!regCompanyId || !treeRes.companies.some((c) => String(c.id) === regCompanyId)) {
        setRegCompanyId(treeRes.companies[0] ? String(treeRes.companies[0].id) : "");
      }
      if (!estRegionId || !treeRes.regions.some((r) => String(r.id) === estRegionId)) {
        setEstRegionId(treeRes.regions[0] ? String(treeRes.regions[0].id) : "");
      }
      if (!blkEstateId || !treeRes.estates.some((es) => String(es.id) === blkEstateId)) {
        setBlkEstateId(treeRes.estates[0] ? String(treeRes.estates[0].id) : "");
      }
      if (
        !selectedPumpTypeId ||
        !treeRes.pumpTypes.some((pt) => String(pt.id) === selectedPumpTypeId)
      ) {
        setSelectedPumpTypeId(treeRes.pumpTypes[0] ? String(treeRes.pumpTypes[0].id) : "");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal memuat master data.");
    } finally {
      setLoading(false);
    }
  }, [blkEstateId, ensureLoaded, estRegionId, regCompanyId, selectedPumpTypeId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  async function mutate(
    url: string,
    method: "POST" | "PATCH" | "DELETE",
    payload: unknown,
    successMsg: string
  ) {
    setSaving(true);
    setError(null);
    setNotice(null);
    try {
      await fetchJson(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      setNotice(successMsg);
      await Promise.all([loadData(), refreshMaster()]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal menyimpan perubahan.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-field-bg p-6">
        <LoadingState message="Memuat master data..." />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-field-bg p-6">
        <ErrorState
          title="Gagal memuat master data"
          message={error || bootError || "Terjadi gangguan koneksi ke server."}
          onRetry={loadData}
        />
      </div>
    );
  }

  const tabs: Array<{ id: MasterTab; label: string }> = [
    { id: "pt", label: "PT" },
    { id: "region", label: "Region" },
    { id: "estate", label: "Estate" },
    { id: "block", label: "Block" },
    { id: "pump_type", label: "Jenis Pompa & Part" },
    { id: "engine", label: "Merek Mesin" },
    { id: "preset", label: "Temuan Standar" },
  ];

  const activeParts =
    master?.pumpTypeParts.filter((p) => String(p.pumpTypeId) === selectedPumpTypeId) ?? [];

  const dirtyEstateOrders = (master?.estates ?? []).filter((es) => {
    const draftVal = estateOrderDrafts[es.id];
    if (draftVal === undefined) return false;
    const normalized = draftVal.trim() === "" ? "0" : draftVal.trim();
    return normalized !== String(es.sortOrder ?? 0);
  });

  async function handleSaveEstateOrders() {
    if (dirtyEstateOrders.length === 0) return;
    const orders: Array<{ id: number; sortOrder: number }> = [];
    for (const es of dirtyEstateOrders) {
      const raw = (estateOrderDrafts[es.id] ?? "").trim();
      const num = raw === "" ? 0 : Number(raw);
      if (!Number.isInteger(num) || num < 0 || num > 9999) {
        setError(
          `Nomor urut untuk Estate ${es.code} harus bilangan bulat antara 0 sampai 9999.`
        );
        return;
      }
      orders.push({ id: es.id, sortOrder: num });
    }
    await mutate(
      "/api/master/estates",
      "PATCH",
      { orders },
      "Urutan Estate berhasil diperbarui."
    );
  }

  function renderRowActions(params: {
    editTarget: MasterEditTarget;
    toggleUrl: string;
    togglePayload: Record<string, unknown>;
    toggleSuccessMsg: string;
    isActive: boolean;
    deleteTarget: MasterDeleteTarget;
  }) {
    return (
      <div className="inline-flex flex-wrap items-center justify-end gap-1.5">
        <button
          type="button"
          onClick={() => setEditTarget(params.editTarget)}
          className="min-h-[44px] rounded border border-field-border bg-white px-3 text-xs font-semibold text-field-ink hover:bg-field-bg"
        >
          Edit
        </button>
        <button
          type="button"
          onClick={() =>
            mutate(
              params.toggleUrl,
              "PATCH",
              params.togglePayload,
              params.toggleSuccessMsg
            )
          }
          className="min-h-[44px] rounded border border-field-border bg-field-bg px-3 text-xs font-semibold text-field-ink hover:bg-[#EAEFEA]"
        >
          {params.isActive ? "Nonaktifkan" : "Aktifkan"}
        </button>
        <button
          type="button"
          onClick={() => setDeleteTarget(params.deleteTarget)}
          className="min-h-[44px] rounded border border-[#FCA5A5] bg-[#FEF2F2] px-3 text-xs font-semibold text-[#991B1B] hover:bg-[#FEE2E2]"
        >
          Hapus
        </button>
      </div>
    );
  }

  return (
    <AppShell
      user={user}
      title="Kelola Master Data"
      subtitle="Atur struktur PT, Region, Estate, Block, Jenis Pompa, Merek Mesin, dan Temuan Standar."
    >
      <div className="space-y-5">
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

        <div role="tablist" aria-label="Kategori master data" className="flex flex-wrap gap-2">
          {tabs.map((t) => (
            <button
              key={t.id}
              role="tab"
              type="button"
              aria-selected={tab === t.id}
              onClick={() => setTab(t.id)}
              className={`min-h-[44px] rounded-md border px-3.5 text-sm font-semibold ${
                tab === t.id
                  ? "border-[#15803D] bg-[#DCFCE7] text-[#166534]"
                  : "border-field-border bg-field-surface text-field-ink hover:bg-field-bg"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {master && tab === "pt" && (
          <section className="space-y-4 rounded-lg border border-field-border bg-field-surface p-4">
            <h2 className="text-base font-bold text-field-ink">Daftar PT / Perusahaan</h2>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                mutate(
                  "/api/master/companies",
                  "POST",
                  { code: ptCode, name: ptName },
                  "PT berhasil ditambahkan."
                ).then(() => {
                  setPtCode("");
                  setPtName("");
                });
              }}
              className="grid grid-cols-1 gap-3 sm:grid-cols-3"
            >
              <div>
                <label htmlFor="pt-code" className="mb-1 block text-xs font-semibold text-field-muted">
                  Kode PT
                </label>
                <input
                  id="pt-code"
                  required
                  value={ptCode}
                  onChange={(e) => setPtCode(e.target.value)}
                  placeholder="Contoh: THIP"
                  className="min-h-[44px] w-full rounded-md border border-field-border px-3 text-sm"
                />
              </div>
              <div>
                <label htmlFor="pt-name" className="mb-1 block text-xs font-semibold text-field-muted">
                  Nama PT
                </label>
                <input
                  id="pt-name"
                  required
                  value={ptName}
                  onChange={(e) => setPtName(e.target.value)}
                  placeholder="Contoh: PT TH Indoplantation"
                  className="min-h-[44px] w-full rounded-md border border-field-border px-3 text-sm"
                />
              </div>
              <div className="flex items-end">
                <button
                  type="submit"
                  disabled={saving}
                  className="min-h-[44px] w-full rounded-md bg-field-accent px-4 text-sm font-semibold text-white hover:bg-field-accent-hover disabled:opacity-60"
                >
                  Tambah PT
                </button>
              </div>
            </form>

            <div className="overflow-x-auto">
              <table className="w-full min-w-[480px] text-left text-sm">
                <thead className="border-b border-field-border bg-field-bg text-xs font-semibold text-field-muted">
                  <tr>
                    <th className="px-3 py-2.5">Kode</th>
                    <th className="px-3 py-2.5">Nama PT</th>
                    <th className="px-3 py-2.5">Status</th>
                    <th className="px-3 py-2.5 text-right">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-field-border">
                  {master.companies.map((c) => (
                    <tr key={c.id}>
                      <td className="px-3 py-2.5 font-mono font-semibold">{c.code}</td>
                      <td className="px-3 py-2.5">{c.name}</td>
                      <td className="px-3 py-2.5 text-xs">
                        {c.isActive ? "Aktif" : "Nonaktif"}
                      </td>
                      <td className="px-3 py-2.5 text-right">
                        {renderRowActions({
                          editTarget: { kind: "company", item: c },
                          toggleUrl: "/api/master/companies",
                          togglePayload: { id: c.id, isActive: !c.isActive },
                          toggleSuccessMsg: `Status PT ${c.code} diperbarui.`,
                          isActive: c.isActive,
                          deleteTarget: {
                            title: `Hapus PT ${c.code}`,
                            description: `Hapus permanen PT "${c.name}" (${c.code})? PT yang masih memiliki Region akan ditolak.`,
                            url: "/api/master/companies",
                            payload: { id: c.id },
                            successMsg: `PT ${c.code} berhasil dihapus.`,
                          },
                        })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {master && tab === "region" && (
          <section className="space-y-4 rounded-lg border border-field-border bg-field-surface p-4">
            <h2 className="text-base font-bold text-field-ink">Daftar Region</h2>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                mutate(
                  "/api/master/regions",
                  "POST",
                  { companyId: Number(regCompanyId), code: regCode, name: regName },
                  "Region berhasil ditambahkan."
                ).then(() => {
                  setRegCode("");
                  setRegName("");
                });
              }}
              className="grid grid-cols-1 gap-3 sm:grid-cols-4"
            >
              <div>
                <label htmlFor="reg-pt" className="mb-1 block text-xs font-semibold text-field-muted">
                  PT Induk
                </label>
                <select
                  id="reg-pt"
                  required
                  value={regCompanyId}
                  onChange={(e) => setRegCompanyId(e.target.value)}
                  className="min-h-[44px] w-full rounded-md border border-field-border bg-white px-3 text-sm"
                >
                  {master.companies.map((c) => (
                    <option key={c.id} value={String(c.id)}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="reg-code" className="mb-1 block text-xs font-semibold text-field-muted">
                  Kode Region
                </label>
                <input
                  id="reg-code"
                  required
                  value={regCode}
                  onChange={(e) => setRegCode(e.target.value)}
                  placeholder="Contoh: R1-W3"
                  className="min-h-[44px] w-full rounded-md border border-field-border px-3 text-sm"
                />
              </div>
              <div>
                <label htmlFor="reg-name" className="mb-1 block text-xs font-semibold text-field-muted">
                  Nama Region
                </label>
                <input
                  id="reg-name"
                  required
                  value={regName}
                  onChange={(e) => setRegName(e.target.value)}
                  placeholder="Contoh: Region 1 / Wilayah 3"
                  className="min-h-[44px] w-full rounded-md border border-field-border px-3 text-sm"
                />
              </div>
              <div className="flex items-end">
                <button
                  type="submit"
                  disabled={saving}
                  className="min-h-[44px] w-full rounded-md bg-field-accent px-4 text-sm font-semibold text-white hover:bg-field-accent-hover disabled:opacity-60"
                >
                  Tambah Region
                </button>
              </div>
            </form>

            <div className="overflow-x-auto">
              <table className="w-full min-w-[560px] text-left text-sm">
                <thead className="border-b border-field-border bg-field-bg text-xs font-semibold text-field-muted">
                  <tr>
                    <th className="px-3 py-2.5">PT</th>
                    <th className="px-3 py-2.5">Kode</th>
                    <th className="px-3 py-2.5">Nama Region</th>
                    <th className="px-3 py-2.5">Status</th>
                    <th className="px-3 py-2.5 text-right">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-field-border">
                  {master.regions.map((r) => {
                    const comp = master.companies.find((c) => c.id === r.companyId);
                    return (
                      <tr key={r.id}>
                        <td className="px-3 py-2.5 text-xs text-field-muted">
                          {comp?.name ?? r.companyId}
                        </td>
                        <td className="px-3 py-2.5 font-mono font-semibold">{r.code}</td>
                        <td className="px-3 py-2.5">{r.name}</td>
                        <td className="px-3 py-2.5 text-xs">
                          {r.isActive ? "Aktif" : "Nonaktif"}
                        </td>
                        <td className="px-3 py-2.5 text-right">
                          {renderRowActions({
                            editTarget: { kind: "region", item: r },
                            toggleUrl: "/api/master/regions",
                            togglePayload: { id: r.id, isActive: !r.isActive },
                            toggleSuccessMsg: `Status Region ${r.code} diperbarui.`,
                            isActive: r.isActive,
                            deleteTarget: {
                              title: `Hapus Region ${r.code}`,
                              description: `Hapus permanen Region "${r.name}" (${r.code})? Region yang masih memiliki Estate akan ditolak.`,
                              url: "/api/master/regions",
                              payload: { id: r.id },
                              successMsg: `Region ${r.code} berhasil dihapus.`,
                            },
                          })}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {master && tab === "estate" && (
          <section className="space-y-4 rounded-lg border border-field-border bg-field-surface p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-base font-bold text-field-ink">Daftar Estate</h2>
                <p className="mt-0.5 text-xs text-field-muted">
                  Nomor lebih kecil tampil lebih awal di seluruh tabel dan dropdown (0 = di akhir).
                </p>
              </div>
              <button
                type="button"
                disabled={saving || dirtyEstateOrders.length === 0}
                onClick={handleSaveEstateOrders}
                className="min-h-[44px] rounded-md bg-field-accent px-4 text-sm font-semibold text-white hover:bg-field-accent-hover disabled:opacity-50"
              >
                {saving ? "Menyimpan..." : `Simpan Urutan (${dirtyEstateOrders.length})`}
              </button>
            </div>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                const parsedOrder = estSortOrder.trim() === "" ? 0 : Number(estSortOrder.trim());
                if (!Number.isInteger(parsedOrder) || parsedOrder < 0 || parsedOrder > 9999) {
                  setError("Nomor urut Estate harus bilangan bulat antara 0 sampai 9999.");
                  return;
                }
                mutate(
                  "/api/master/estates",
                  "POST",
                  {
                    regionId: Number(estRegionId),
                    code: estCode,
                    name: estName,
                    sortOrder: parsedOrder,
                  },
                  "Estate berhasil ditambahkan."
                ).then(() => {
                  setEstCode("");
                  setEstName("");
                  setEstSortOrder("");
                });
              }}
              className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5"
            >
              <div>
                <label htmlFor="est-reg" className="mb-1 block text-xs font-semibold text-field-muted">
                  Region Induk
                </label>
                <select
                  id="est-reg"
                  required
                  value={estRegionId}
                  onChange={(e) => setEstRegionId(e.target.value)}
                  className="min-h-[44px] w-full rounded-md border border-field-border bg-white px-3 text-sm"
                >
                  {master.regions.map((r) => (
                    <option key={r.id} value={String(r.id)}>
                      {r.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="est-code" className="mb-1 block text-xs font-semibold text-field-muted">
                  Kode Estate
                </label>
                <input
                  id="est-code"
                  required
                  value={estCode}
                  onChange={(e) => setEstCode(e.target.value)}
                  placeholder="Contoh: PUL"
                  className="min-h-[44px] w-full rounded-md border border-field-border px-3 text-sm"
                />
              </div>
              <div>
                <label htmlFor="est-name" className="mb-1 block text-xs font-semibold text-field-muted">
                  Nama Estate
                </label>
                <input
                  id="est-name"
                  required
                  value={estName}
                  onChange={(e) => setEstName(e.target.value)}
                  placeholder="Contoh: Estate Pulau"
                  className="min-h-[44px] w-full rounded-md border border-field-border px-3 text-sm"
                />
              </div>
              <div>
                <label htmlFor="est-sort" className="mb-1 block text-xs font-semibold text-field-muted">
                  No. Urut
                </label>
                <input
                  id="est-sort"
                  type="number"
                  min={0}
                  max={9999}
                  step={1}
                  inputMode="numeric"
                  value={estSortOrder}
                  onChange={(e) => setEstSortOrder(e.target.value)}
                  placeholder="Contoh: 1"
                  className="min-h-[44px] w-full rounded-md border border-field-border px-3 font-mono text-sm tabular-nums"
                />
              </div>
              <div className="flex items-end">
                <button
                  type="submit"
                  disabled={saving}
                  className="min-h-[44px] w-full rounded-md bg-field-accent px-4 text-sm font-semibold text-white hover:bg-field-accent-hover disabled:opacity-60"
                >
                  Tambah Estate
                </button>
              </div>
            </form>

            <div className="overflow-x-auto">
              <table className="w-full min-w-[620px] text-left text-sm">
                <thead className="border-b border-field-border bg-field-bg text-xs font-semibold text-field-muted">
                  <tr>
                    <th className="w-28 px-3 py-2.5">No. Urut</th>
                    <th className="px-3 py-2.5">Region</th>
                    <th className="px-3 py-2.5">Kode Estate</th>
                    <th className="px-3 py-2.5">Nama Estate</th>
                    <th className="px-3 py-2.5">Status</th>
                    <th className="px-3 py-2.5 text-right">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-field-border">
                  {master.estates.map((es) => {
                    const reg = master.regions.find((r) => r.id === es.regionId);
                    const draftVal = estateOrderDrafts[es.id] ?? String(es.sortOrder ?? 0);
                    const normalizedDraft = draftVal.trim() === "" ? "0" : draftVal.trim();
                    const isDirty = normalizedDraft !== String(es.sortOrder ?? 0);
                    return (
                      <tr key={es.id} className={isDirty ? "bg-[#F0FDF4]" : undefined}>
                        <td className="px-3 py-2.5">
                          <input
                            type="number"
                            min={0}
                            max={9999}
                            step={1}
                            inputMode="numeric"
                            aria-label={`Nomor urut Estate ${es.code}`}
                            value={draftVal}
                            onChange={(e) => {
                              setNotice(null);
                              setEstateOrderDrafts((prev) => ({
                                ...prev,
                                [es.id]: e.target.value,
                              }));
                            }}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") {
                                e.preventDefault();
                                void handleSaveEstateOrders();
                              }
                            }}
                            className="min-h-[44px] w-20 rounded-md border border-field-border bg-white px-2.5 text-right font-mono text-sm tabular-nums text-field-ink"
                          />
                        </td>
                        <td className="px-3 py-2.5 text-xs text-field-muted">
                          {reg?.name ?? es.regionId}
                        </td>
                        <td className="px-3 py-2.5 font-mono font-semibold">{es.code}</td>
                        <td className="px-3 py-2.5">{es.name}</td>
                        <td className="px-3 py-2.5 text-xs">
                          {es.isActive ? "Aktif" : "Nonaktif"}
                        </td>
                        <td className="px-3 py-2.5 text-right">
                          {renderRowActions({
                            editTarget: { kind: "estate", item: es },
                            toggleUrl: "/api/master/estates",
                            togglePayload: { id: es.id, isActive: !es.isActive },
                            toggleSuccessMsg: `Status Estate ${es.code} diperbarui.`,
                            isActive: es.isActive,
                            deleteTarget: {
                              title: `Hapus Estate ${es.code}`,
                              description: `Hapus permanen Estate "${es.name}" (${es.code})? Estate yang masih memiliki Block atau unit Pompa akan ditolak.`,
                              url: "/api/master/estates",
                              payload: { id: es.id },
                              successMsg: `Estate ${es.code} berhasil dihapus.`,
                            },
                          })}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {master && tab === "block" && (
          <section className="space-y-4 rounded-lg border border-field-border bg-field-surface p-4">
            <h2 className="text-base font-bold text-field-ink">Daftar Block / Lokasi</h2>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                mutate(
                  "/api/master/blocks",
                  "POST",
                  { estateId: Number(blkEstateId), code: blkCode, name: blkName || blkCode },
                  "Block berhasil ditambahkan."
                ).then(() => {
                  setBlkCode("");
                  setBlkName("");
                });
              }}
              className="grid grid-cols-1 gap-3 sm:grid-cols-4"
            >
              <div>
                <label htmlFor="blk-est" className="mb-1 block text-xs font-semibold text-field-muted">
                  Estate Induk
                </label>
                <select
                  id="blk-est"
                  required
                  value={blkEstateId}
                  onChange={(e) => setBlkEstateId(e.target.value)}
                  className="min-h-[44px] w-full rounded-md border border-field-border bg-white px-3 text-sm"
                >
                  {master.estates.map((es) => (
                    <option key={es.id} value={String(es.id)}>
                      {es.code}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="blk-code" className="mb-1 block text-xs font-semibold text-field-muted">
                  Kode Block / Lokasi
                </label>
                <input
                  id="blk-code"
                  required
                  value={blkCode}
                  onChange={(e) => setBlkCode(e.target.value)}
                  placeholder="Contoh: 28-17"
                  className="min-h-[44px] w-full rounded-md border border-field-border px-3 text-sm"
                />
              </div>
              <div>
                <label htmlFor="blk-name" className="mb-1 block text-xs font-semibold text-field-muted">
                  Keterangan Block
                </label>
                <input
                  id="blk-name"
                  value={blkName}
                  onChange={(e) => setBlkName(e.target.value)}
                  placeholder="Opsional (sama dengan kode)"
                  className="min-h-[44px] w-full rounded-md border border-field-border px-3 text-sm"
                />
              </div>
              <div className="flex items-end">
                <button
                  type="submit"
                  disabled={saving}
                  className="min-h-[44px] w-full rounded-md bg-field-accent px-4 text-sm font-semibold text-white hover:bg-field-accent-hover disabled:opacity-60"
                >
                  Tambah Block
                </button>
              </div>
            </form>

            <div className="overflow-x-auto">
              <table className="w-full min-w-[540px] text-left text-sm">
                <thead className="border-b border-field-border bg-field-bg text-xs font-semibold text-field-muted">
                  <tr>
                    <th className="px-3 py-2.5">Estate</th>
                    <th className="px-3 py-2.5">Kode Block</th>
                    <th className="px-3 py-2.5">Nama</th>
                    <th className="px-3 py-2.5">Status</th>
                    <th className="px-3 py-2.5 text-right">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-field-border">
                  {master.blocks.map((b) => {
                    const est = master.estates.find((es) => es.id === b.estateId);
                    return (
                      <tr key={b.id}>
                        <td className="px-3 py-2.5 font-mono text-xs">{est?.code ?? b.estateId}</td>
                        <td className="px-3 py-2.5 font-mono font-semibold">{b.code}</td>
                        <td className="px-3 py-2.5">{b.name}</td>
                        <td className="px-3 py-2.5 text-xs">
                          {b.isActive ? "Aktif" : "Nonaktif"}
                        </td>
                        <td className="px-3 py-2.5 text-right">
                          {renderRowActions({
                            editTarget: { kind: "block", item: b },
                            toggleUrl: "/api/master/blocks",
                            togglePayload: { id: b.id, isActive: !b.isActive },
                            toggleSuccessMsg: `Status Block ${b.code} diperbarui.`,
                            isActive: b.isActive,
                            deleteTarget: {
                              title: `Hapus Block ${b.code}`,
                              description: `Hapus permanen Block "${b.code}" pada Estate ${est?.code ?? "-"}? Block yang masih dipakai pompa akan ditolak.`,
                              url: "/api/master/blocks",
                              payload: { id: b.id },
                              successMsg: `Block ${b.code} berhasil dihapus.`,
                            },
                          })}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {master && tab === "pump_type" && (
          <div className="space-y-5">
            <section className="space-y-4 rounded-lg border border-field-border bg-field-surface p-4">
              <h2 className="text-base font-bold text-field-ink">Daftar Jenis Pompa</h2>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  mutate(
                    "/api/master/pump-types",
                    "POST",
                    {
                      code: ptTypeCode,
                      name: ptTypeName,
                      description: ptTypeDesc.trim() || undefined,
                    },
                    "Jenis Pompa berhasil ditambahkan."
                  ).then(() => {
                    setPtTypeCode("");
                    setPtTypeName("");
                    setPtTypeDesc("");
                  });
                }}
                className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4"
              >
                <div>
                  <label htmlFor="ptype-code" className="mb-1 block text-xs font-semibold text-field-muted">
                    Kode Jenis
                  </label>
                  <input
                    id="ptype-code"
                    required
                    value={ptTypeCode}
                    onChange={(e) => setPtTypeCode(e.target.value)}
                    placeholder="Contoh: axial_quad"
                    className="min-h-[44px] w-full rounded-md border border-field-border px-3 text-sm"
                  />
                </div>
                <div>
                  <label htmlFor="ptype-name" className="mb-1 block text-xs font-semibold text-field-muted">
                    Nama Jenis Pompa
                  </label>
                  <input
                    id="ptype-name"
                    required
                    value={ptTypeName}
                    onChange={(e) => setPtTypeName(e.target.value)}
                    placeholder="Contoh: Axial Quad"
                    className="min-h-[44px] w-full rounded-md border border-field-border px-3 text-sm"
                  />
                </div>
                <div>
                  <label htmlFor="ptype-desc" className="mb-1 block text-xs font-semibold text-field-muted">
                    Deskripsi (Opsional)
                  </label>
                  <input
                    id="ptype-desc"
                    value={ptTypeDesc}
                    onChange={(e) => setPtTypeDesc(e.target.value)}
                    placeholder="Keterangan singkat"
                    className="min-h-[44px] w-full rounded-md border border-field-border px-3 text-sm"
                  />
                </div>
                <div className="flex items-end">
                  <button
                    type="submit"
                    disabled={saving}
                    className="min-h-[44px] w-full rounded-md bg-field-accent px-4 text-sm font-semibold text-white hover:bg-field-accent-hover disabled:opacity-60"
                  >
                    Tambah Jenis Pompa
                  </button>
                </div>
              </form>

              <div className="overflow-x-auto">
                <table className="w-full min-w-[620px] text-left text-sm">
                  <thead className="border-b border-field-border bg-field-bg text-xs font-semibold text-field-muted">
                    <tr>
                      <th className="px-3 py-2.5">Kode</th>
                      <th className="px-3 py-2.5">Nama Jenis</th>
                      <th className="px-3 py-2.5">Deskripsi</th>
                      <th className="px-3 py-2.5">Status</th>
                      <th className="px-3 py-2.5 text-right">Aksi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-field-border">
                    {master.pumpTypes.map((pt) => (
                      <tr key={pt.id}>
                        <td className="px-3 py-2.5 font-mono text-xs font-semibold">{pt.code}</td>
                        <td className="px-3 py-2.5 font-medium">{pt.name}</td>
                        <td className="px-3 py-2.5 text-xs text-field-muted">
                          {pt.description || "-"}
                        </td>
                        <td className="px-3 py-2.5 text-xs">
                          {pt.isActive ? "Aktif" : "Nonaktif"}
                        </td>
                        <td className="px-3 py-2.5 text-right">
                          {renderRowActions({
                            editTarget: { kind: "pump_type", item: pt },
                            toggleUrl: "/api/master/pump-types",
                            togglePayload: { id: pt.id, isActive: !pt.isActive },
                            toggleSuccessMsg: `Status Jenis Pompa ${pt.name} diperbarui.`,
                            isActive: pt.isActive,
                            deleteTarget: {
                              title: `Hapus Jenis Pompa ${pt.name}`,
                              description: `Hapus permanen Jenis Pompa "${pt.name}" (${pt.code}) beserta template komponennya? Jenis Pompa yang masih dipakai unit akan ditolak.`,
                              url: "/api/master/pump-types",
                              payload: { id: pt.id },
                              successMsg: `Jenis Pompa ${pt.name} berhasil dihapus.`,
                            },
                          })}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            <section className="space-y-4 rounded-lg border border-field-border bg-field-surface p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h2 className="text-base font-bold text-field-ink">
                  Template Komponen per Jenis Pompa
                </h2>
                <div className="w-full sm:w-64">
                  <label htmlFor="select-ptype" className="sr-only">
                    Pilih Jenis Pompa
                  </label>
                  <select
                    id="select-ptype"
                    value={selectedPumpTypeId}
                    onChange={(e) => setSelectedPumpTypeId(e.target.value)}
                    className="min-h-[44px] w-full rounded-md border border-field-border bg-white px-3 text-sm font-semibold"
                  >
                    {master.pumpTypes.map((pt) => (
                      <option key={pt.id} value={String(pt.id)}>
                        {pt.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {selectedPumpTypeId && (
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    mutate(
                      `/api/master/pump-types/${selectedPumpTypeId}/parts`,
                      "POST",
                      {
                        sectionCode: partSectionCode,
                        sectionName: partSectionName,
                        itemNo: Number(partNo) || 0,
                        partName,
                        defaultQty: Number(partQty) || 1,
                        sortOrder: activeParts.length + 1,
                      },
                      "Komponen baru berhasil ditambahkan ke template."
                    ).then(() => setPartName(""));
                  }}
                  className="grid grid-cols-2 gap-2.5 sm:grid-cols-6"
                >
                  <div>
                    <label htmlFor="part-sec-code" className="mb-1 block text-xs font-semibold text-field-muted">
                      Kode Bagian
                    </label>
                    <input
                      id="part-sec-code"
                      required
                      value={partSectionCode}
                      onChange={(e) => setPartSectionCode(e.target.value)}
                      className="min-h-[44px] w-full rounded-md border border-field-border px-3 text-sm"
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <label htmlFor="part-sec-name" className="mb-1 block text-xs font-semibold text-field-muted">
                      Nama Bagian
                    </label>
                    <input
                      id="part-sec-name"
                      required
                      value={partSectionName}
                      onChange={(e) => setPartSectionName(e.target.value)}
                      className="min-h-[44px] w-full rounded-md border border-field-border px-3 text-sm"
                    />
                  </div>
                  <div>
                    <label htmlFor="part-no" className="mb-1 block text-xs font-semibold text-field-muted">
                      No Urut
                    </label>
                    <input
                      id="part-no"
                      type="number"
                      min={0}
                      required
                      value={partNo}
                      onChange={(e) => setPartNo(e.target.value)}
                      className="min-h-[44px] w-full rounded-md border border-field-border px-3 text-sm"
                    />
                  </div>
                  <div>
                    <label htmlFor="part-qty" className="mb-1 block text-xs font-semibold text-field-muted">
                      Qty Standar
                    </label>
                    <input
                      id="part-qty"
                      type="number"
                      min={1}
                      required
                      value={partQty}
                      onChange={(e) => setPartQty(e.target.value)}
                      className="min-h-[44px] w-full rounded-md border border-field-border px-3 text-sm"
                    />
                  </div>
                  <div className="col-span-2 sm:col-span-5">
                    <label htmlFor="part-name" className="mb-1 block text-xs font-semibold text-field-muted">
                      Nama Komponen
                    </label>
                    <input
                      id="part-name"
                      required
                      value={partName}
                      onChange={(e) => setPartName(e.target.value)}
                      placeholder="Contoh: Impeller Stainless"
                      className="min-h-[44px] w-full rounded-md border border-field-border px-3 text-sm"
                    />
                  </div>
                  <div className="col-span-2 flex items-end sm:col-span-1">
                    <button
                      type="submit"
                      disabled={saving}
                      className="min-h-[44px] w-full rounded-md bg-field-accent px-3 text-sm font-semibold text-white hover:bg-field-accent-hover"
                    >
                      Tambah Part
                    </button>
                  </div>
                </form>
              )}

              {activeParts.length === 0 ? (
                <EmptyState
                  title="Belum ada komponen"
                  description="Tambahkan komponen checklist untuk jenis pompa ini."
                />
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[660px] text-left text-sm">
                    <thead className="border-b border-field-border bg-field-bg text-xs font-semibold text-field-muted">
                      <tr>
                        <th className="px-3 py-2">Bagian</th>
                        <th className="px-3 py-2">No</th>
                        <th className="px-3 py-2">Nama Komponen</th>
                        <th className="px-3 py-2 text-right">Qty</th>
                        <th className="px-3 py-2 text-right">Urutan</th>
                        <th className="px-3 py-2">Status</th>
                        <th className="px-3 py-2 text-right">Aksi</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-field-border">
                      {activeParts.map((part) => (
                        <tr key={part.id}>
                          <td className="px-3 py-2 text-xs font-semibold">
                            {part.sectionCode} ({part.sectionName})
                          </td>
                          <td className="px-3 py-2 font-mono text-xs">{part.itemNo}</td>
                          <td className="px-3 py-2">{part.partName}</td>
                          <td className="px-3 py-2 text-right font-mono tabular-nums">
                            {part.defaultQty}
                          </td>
                          <td className="px-3 py-2 text-right font-mono text-xs tabular-nums text-field-muted">
                            {part.sortOrder}
                          </td>
                          <td className="px-3 py-2 text-xs">
                            {part.isActive ? "Aktif" : "Nonaktif"}
                          </td>
                          <td className="px-3 py-2 text-right">
                            {renderRowActions({
                              editTarget: { kind: "pump_type_part", item: part },
                              toggleUrl: `/api/master/pump-types/${selectedPumpTypeId}/parts`,
                              togglePayload: { partId: part.id, isActive: !part.isActive },
                              toggleSuccessMsg: `Status komponen ${part.partName} diperbarui.`,
                              isActive: part.isActive,
                              deleteTarget: {
                                title: `Hapus Komponen ${part.partName}`,
                                description: `Hapus komponen "${part.partName}" dari template? Data inspeksi lama tidak ikut terhapus.`,
                                url: `/api/master/pump-types/${selectedPumpTypeId}/parts`,
                                payload: { partId: part.id },
                                successMsg: `Komponen "${part.partName}" berhasil dihapus.`,
                              },
                            })}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          </div>
        )}

        {master && tab === "engine" && (
          <section className="space-y-4 rounded-lg border border-field-border bg-field-surface p-4">
            <h2 className="text-base font-bold text-field-ink">Master Merek Mesin</h2>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                mutate(
                  "/api/master/engine-brands",
                  "POST",
                  { name: engineName },
                  "Merek Mesin ditambahkan."
                ).then(() => setEngineName(""));
              }}
              className="flex flex-wrap gap-3"
            >
              <div className="min-w-[220px] flex-1">
                <label htmlFor="engine-name" className="sr-only">
                  Nama Merek Mesin
                </label>
                <input
                  id="engine-name"
                  required
                  value={engineName}
                  onChange={(e) => setEngineName(e.target.value)}
                  placeholder="Contoh: Yanmar"
                  className="min-h-[44px] w-full rounded-md border border-field-border px-3 text-sm"
                />
              </div>
              <button
                type="submit"
                disabled={saving}
                className="min-h-[44px] rounded-md bg-field-accent px-5 text-sm font-semibold text-white hover:bg-field-accent-hover"
              >
                Tambah Merek Mesin
              </button>
            </form>

            <div className="overflow-x-auto">
              <table className="w-full min-w-[460px] text-left text-sm">
                <thead className="border-b border-field-border bg-field-bg text-xs font-semibold text-field-muted">
                  <tr>
                    <th className="px-3 py-2.5">Nama Merek Mesin</th>
                    <th className="px-3 py-2.5">Status</th>
                    <th className="px-3 py-2.5 text-right">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-field-border">
                  {master.engineBrands.map((eb) => (
                    <tr key={eb.id}>
                      <td className="px-3 py-2.5 font-medium">{eb.name}</td>
                      <td className="px-3 py-2.5 text-xs">
                        {eb.isActive ? "Aktif" : "Nonaktif"}
                      </td>
                      <td className="px-3 py-2.5 text-right">
                        {renderRowActions({
                          editTarget: { kind: "engine_brand", item: eb },
                          toggleUrl: "/api/master/engine-brands",
                          togglePayload: { id: eb.id, isActive: !eb.isActive },
                          toggleSuccessMsg: `Merek ${eb.name} diperbarui.`,
                          isActive: eb.isActive,
                          deleteTarget: {
                            title: `Hapus Merek ${eb.name}`,
                            description: `Hapus permanen Merek Mesin "${eb.name}"? Merek yang masih dipakai unit pompa akan ditolak.`,
                            url: "/api/master/engine-brands",
                            payload: { id: eb.id },
                            successMsg: `Merek Mesin "${eb.name}" berhasil dihapus.`,
                          },
                        })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {master && tab === "preset" && (
          <section className="space-y-4 rounded-lg border border-field-border bg-field-surface p-4">
            <h2 className="text-base font-bold text-field-ink">
              Master Temuan Standar (Pengganti Free Text)
            </h2>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                mutate(
                  "/api/master/issue-presets",
                  "POST",
                  {
                    label: presetLabel,
                    defaultAvailability: presetAvail,
                    defaultCondition: presetCond,
                    sortOrder: master.issuePresets.length + 1,
                  },
                  "Temuan standar ditambahkan."
                ).then(() => setPresetLabel(""));
              }}
              className="grid grid-cols-1 gap-3 sm:grid-cols-4"
            >
              <div>
                <label htmlFor="preset-label" className="mb-1 block text-xs font-semibold text-field-muted">
                  Label Temuan
                </label>
                <input
                  id="preset-label"
                  required
                  value={presetLabel}
                  onChange={(e) => setPresetLabel(e.target.value)}
                  placeholder="Contoh: Korosi Berat"
                  className="min-h-[44px] w-full rounded-md border border-field-border px-3 text-sm"
                />
              </div>
              <div>
                <label htmlFor="preset-avail" className="mb-1 block text-xs font-semibold text-field-muted">
                  Default Ketersediaan
                </label>
                <select
                  id="preset-avail"
                  value={presetAvail}
                  onChange={(e) =>
                    setPresetAvail(e.target.value as "ada" | "tidak_lengkap" | "hilang")
                  }
                  className="min-h-[44px] w-full rounded-md border border-field-border bg-white px-3 text-sm"
                >
                  <option value="ada">Ada</option>
                  <option value="tidak_lengkap">Tidak Lengkap</option>
                  <option value="hilang">Hilang</option>
                </select>
              </div>
              <div>
                <label htmlFor="preset-cond" className="mb-1 block text-xs font-semibold text-field-muted">
                  Default Kondisi
                </label>
                <select
                  id="preset-cond"
                  value={presetCond}
                  onChange={(e) => setPresetCond(e.target.value as "baik" | "rusak")}
                  className="min-h-[44px] w-full rounded-md border border-field-border bg-white px-3 text-sm"
                >
                  <option value="baik">Baik</option>
                  <option value="rusak">Rusak</option>
                </select>
              </div>
              <div className="flex items-end">
                <button
                  type="submit"
                  disabled={saving}
                  className="min-h-[44px] w-full rounded-md bg-field-accent px-4 text-sm font-semibold text-white hover:bg-field-accent-hover"
                >
                  Tambah Temuan
                </button>
              </div>
            </form>

            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] text-left text-sm">
                <thead className="border-b border-field-border bg-field-bg text-xs font-semibold text-field-muted">
                  <tr>
                    <th className="w-20 px-3 py-2">Urutan</th>
                    <th className="px-3 py-2">Label Temuan</th>
                    <th className="px-3 py-2">Default Ketersediaan</th>
                    <th className="px-3 py-2">Default Kondisi</th>
                    <th className="px-3 py-2">Status</th>
                    <th className="px-3 py-2 text-right">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-field-border">
                  {master.issuePresets.map((ip) => (
                    <tr key={ip.id}>
                      <td className="px-3 py-2 font-mono text-xs tabular-nums text-field-muted">
                        {ip.sortOrder}
                      </td>
                      <td className="px-3 py-2 font-medium">{ip.label}</td>
                      <td className="px-3 py-2 text-xs">{ip.defaultAvailability}</td>
                      <td className="px-3 py-2 text-xs">{ip.defaultCondition}</td>
                      <td className="px-3 py-2 text-xs">
                        {ip.isActive ? "Aktif" : "Nonaktif"}
                      </td>
                      <td className="px-3 py-2 text-right">
                        {renderRowActions({
                          editTarget: { kind: "issue_preset", item: ip },
                          toggleUrl: "/api/master/issue-presets",
                          togglePayload: { id: ip.id, isActive: !ip.isActive },
                          toggleSuccessMsg: `Status temuan "${ip.label}" diperbarui.`,
                          isActive: ip.isActive,
                          deleteTarget: {
                            title: `Hapus Temuan "${ip.label}"`,
                            description: `Hapus permanen Temuan Standar "${ip.label}"? Histori inspeksi yang sudah tercatat tetap aman.`,
                            url: "/api/master/issue-presets",
                            payload: { id: ip.id },
                            successMsg: `Temuan Standar "${ip.label}" berhasil dihapus.`,
                          },
                        })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}
      </div>

      {editTarget && master && (
        <MasterEditDialog
          target={editTarget}
          master={master}
          onClose={() => setEditTarget(null)}
          onSaved={async (msg) => {
            setError(null);
            setNotice(msg);
            await Promise.all([loadData(), refreshMaster()]);
          }}
        />
      )}

      {deleteTarget && (
        <ConfirmDeleteDialog
          title={deleteTarget.title}
          description={deleteTarget.description}
          onClose={() => setDeleteTarget(null)}
          onConfirm={async () => {
            await fetchJson(deleteTarget.url, {
              method: "DELETE",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(deleteTarget.payload),
            });
            setError(null);
            setNotice(deleteTarget.successMsg);
            await Promise.all([loadData(), refreshMaster()]);
          }}
        />
      )}
    </AppShell>
  );
}
