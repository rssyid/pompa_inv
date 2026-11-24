"use client";

import { useCallback, useEffect, useState } from "react";
import { X } from "lucide-react";
import { useAppData } from "@/components/AppDataProvider";
import { AppShell } from "@/components/AppShell";
import { ConfirmDeleteDialog } from "@/components/ConfirmDeleteDialog";
import { PumpLocationDialog } from "@/components/PumpLocationDialog";
import { UnitStatusBadge } from "@/components/StatusBadge";
import { ErrorState, LoadingState } from "@/components/UiStates";
import { EnrichedPump, fetchJson } from "@/lib/client-fetch";
import { getPumpLocationBadgeInfo } from "@/lib/pump-location";

export default function AdminPumpsPage() {
  const { user, master, ensureLoaded, refreshMaster, error: bootError } = useAppData();
  const [pumps, setPumps] = useState<EnrichedPump[]>([]);
  const [editingPump, setEditingPump] = useState<EnrichedPump | null>(null);
  const [editingIdentityPump, setEditingIdentityPump] = useState<EnrichedPump | null>(null);
  const [editPumpCode, setEditPumpCode] = useState("");
  const [editPumpTypeId, setEditPumpTypeId] = useState("");
  const [editEngineBrandId, setEditEngineBrandId] = useState("");
  const [editPumpSaving, setEditPumpSaving] = useState(false);
  const [editPumpError, setEditPumpError] = useState<string | null>(null);
  const [deletingPump, setDeletingPump] = useState<EnrichedPump | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  // Cascading form fields
  const [pumpCode, setPumpCode] = useState("");
  const [companyId, setCompanyId] = useState("");
  const [regionId, setRegionId] = useState("");
  const [estateId, setEstateId] = useState("");
  const [blockId, setBlockId] = useState("");
  const [pumpTypeId, setPumpTypeId] = useState("");
  const [engineBrandId, setEngineBrandId] = useState("");

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [boot, pumpsRes] = await Promise.all([
        ensureLoaded(),
        fetchJson<{ pumps: EnrichedPump[] }>("/api/pumps?includeInactive=true"),
      ]);
      setPumps(pumpsRes.pumps);

      const masterRes = boot?.master;
      if (masterRes) {
        if (!companyId && masterRes.companies[0]) {
          const cId = String(masterRes.companies[0].id);
          setCompanyId(cId);
          const firstReg = masterRes.regions.find((r) => String(r.companyId) === cId);
          if (firstReg) {
            setRegionId(String(firstReg.id));
            const firstEst = masterRes.estates.find((e) => e.regionId === firstReg.id);
            if (firstEst) {
              setEstateId(String(firstEst.id));
              const firstBlk = masterRes.blocks.find((b) => b.estateId === firstEst.id);
              if (firstBlk) setBlockId(String(firstBlk.id));
            }
          }
        }
        if (!pumpTypeId && masterRes.pumpTypes[0]) {
          setPumpTypeId(String(masterRes.pumpTypes[0].id));
        }
        if (!engineBrandId && masterRes.engineBrands[0]) {
          setEngineBrandId(String(masterRes.engineBrands[0].id));
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal memuat data master pompa.");
    } finally {
      setLoading(false);
    }
  }, [companyId, engineBrandId, ensureLoaded, pumpTypeId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    if (!editingIdentityPump) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape" && !editPumpSaving) {
        setEditingIdentityPump(null);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [editPumpSaving, editingIdentityPump]);

  function openEditIdentity(pump: EnrichedPump) {
    setEditPumpCode(pump.pumpCode);
    setEditPumpTypeId(String(pump.pumpTypeId));
    setEditEngineBrandId(String(pump.engineBrandId));
    setEditPumpError(null);
    setEditingIdentityPump(pump);
  }

  async function handleSaveIdentity(e: React.FormEvent) {
    e.preventDefault();
    if (!editingIdentityPump) return;
    setEditPumpSaving(true);
    setEditPumpError(null);
    try {
      await fetchJson(`/api/pumps/${editingIdentityPump.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pumpCode: editPumpCode.trim().toUpperCase(),
          pumpTypeId: Number(editPumpTypeId),
          engineBrandId: Number(editEngineBrandId),
        }),
      });
      setNotice(`Identitas pompa ${editPumpCode.trim().toUpperCase()} berhasil diperbarui.`);
      setEditingIdentityPump(null);
      await loadData();
    } catch (err) {
      setEditPumpError(err instanceof Error ? err.message : "Gagal memperbarui unit pompa.");
    } finally {
      setEditPumpSaving(false);
    }
  }

  async function handleCreatePump(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setNotice(null);
    try {
      await fetchJson("/api/pumps", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pumpCode,
          estateId: estateId ? Number(estateId) : null,
          blockId: blockId ? Number(blockId) : null,
          pumpTypeId: Number(pumpTypeId),
          engineBrandId: Number(engineBrandId),
        }),
      });
      setNotice(`Pompa ${pumpCode.toUpperCase()} berhasil ditambahkan.`);
      setPumpCode("");
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal menambah unit pompa.");
    } finally {
      setSaving(false);
    }
  }

  async function togglePumpActive(pump: EnrichedPump) {
    setError(null);
    setNotice(null);
    try {
      await fetchJson(`/api/pumps/${pump.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: !pump.isActive }),
      });
      setNotice(`Status aktif pompa ${pump.pumpCode} diperbarui.`);
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal memperbarui pompa.");
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-field-bg p-6">
        <LoadingState message="Memuat kelola unit pompa..." />
      </div>
    );
  }

  if (!user || !master) {
    return (
      <div className="min-h-screen bg-field-bg p-6">
        <ErrorState
          title="Gagal memuat kelola unit pompa"
          message={error || bootError || "Terjadi gangguan koneksi ke server."}
          onRetry={loadData}
        />
      </div>
    );
  }

  const regions = master.regions.filter((r) => String(r.companyId) === companyId);
  const estates = master.estates.filter((e) => String(e.regionId) === regionId);
  const blocks = master.blocks.filter((b) => String(b.estateId) === estateId);

  return (
    <AppShell
      user={user}
      title="Kelola Master Pompa"
      subtitle="Tambah unit baru dengan pilihan PT, Region, Estate, Block, Jenis Pompa, dan Merek Mesin."
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

        <section className="rounded-lg border border-field-border bg-field-surface p-4">
          <h2 className="mb-3 text-base font-bold text-field-ink">Tambah Unit Pompa Baru</h2>
          <form onSubmit={handleCreatePump} className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <label htmlFor="add-pt" className="mb-1 block text-xs font-semibold text-field-muted">
                PT
              </label>
              <select
                id="add-pt"
                required
                value={companyId}
                onChange={(e) => {
                  const val = e.target.value;
                  setCompanyId(val);
                  const firstReg = master.regions.find((r) => String(r.companyId) === val);
                  setRegionId(firstReg ? String(firstReg.id) : "");
                  setEstateId("");
                  setBlockId("");
                }}
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
              <label htmlFor="add-region" className="mb-1 block text-xs font-semibold text-field-muted">
                Region
              </label>
              <select
                id="add-region"
                required
                value={regionId}
                onChange={(e) => {
                  const val = e.target.value;
                  setRegionId(val);
                  const firstEst = master.estates.find((es) => String(es.regionId) === val);
                  setEstateId(firstEst ? String(firstEst.id) : "");
                  setBlockId("");
                }}
                className="min-h-[44px] w-full rounded-md border border-field-border bg-white px-3 text-sm"
              >
                <option value="">Pilih Region</option>
                {regions.map((r) => (
                  <option key={r.id} value={String(r.id)}>
                    {r.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="add-estate" className="mb-1 block text-xs font-semibold text-field-muted">
                Estate
              </label>
              <select
                id="add-estate"
                required
                value={estateId}
                onChange={(e) => {
                  const val = e.target.value;
                  setEstateId(val);
                  const firstBlk = master.blocks.find((b) => String(b.estateId) === val);
                  setBlockId(firstBlk ? String(firstBlk.id) : "");
                }}
                className="min-h-[44px] w-full rounded-md border border-field-border bg-white px-3 text-sm"
              >
                <option value="">Pilih Estate</option>
                {estates.map((es) => (
                  <option key={es.id} value={String(es.id)}>
                    {es.code}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="add-block" className="mb-1 block text-xs font-semibold text-field-muted">
                Block / Posisi (Opsional)
              </label>
              <select
                id="add-block"
                value={blockId}
                onChange={(e) => setBlockId(e.target.value)}
                className="min-h-[44px] w-full rounded-md border border-field-border bg-white px-3 text-sm"
              >
                <option value="">Belum Assign Lokasi</option>
                {blocks.map((b) => (
                  <option key={b.id} value={String(b.id)}>
                    {b.code}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="add-type" className="mb-1 block text-xs font-semibold text-field-muted">
                Jenis Pompa
              </label>
              <select
                id="add-type"
                required
                value={pumpTypeId}
                onChange={(e) => setPumpTypeId(e.target.value)}
                className="min-h-[44px] w-full rounded-md border border-field-border bg-white px-3 text-sm"
              >
                {master.pumpTypes.map((pt) => (
                  <option key={pt.id} value={String(pt.id)}>
                    {pt.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="add-engine" className="mb-1 block text-xs font-semibold text-field-muted">
                Merek Mesin
              </label>
              <select
                id="add-engine"
                required
                value={engineBrandId}
                onChange={(e) => setEngineBrandId(e.target.value)}
                className="min-h-[44px] w-full rounded-md border border-field-border bg-white px-3 text-sm"
              >
                {master.engineBrands.map((eb) => (
                  <option key={eb.id} value={String(eb.id)}>
                    {eb.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="add-code" className="mb-1 block text-xs font-semibold text-field-muted">
                Kode Pompa
              </label>
              <input
                id="add-code"
                required
                value={pumpCode}
                onChange={(e) => setPumpCode(e.target.value)}
                placeholder="Contoh: R1-AD-99"
                className="min-h-[44px] w-full rounded-md border border-field-border px-3 font-mono text-sm"
              />
            </div>

            <div className="flex items-end">
              <button
                type="submit"
                disabled={saving || !pumpCode.trim()}
                className="min-h-[44px] w-full rounded-md bg-field-accent px-4 text-sm font-semibold text-white hover:bg-field-accent-hover disabled:opacity-60"
              >
                {saving ? "Menyimpan..." : "Simpan Unit Pompa"}
              </button>
            </div>
          </form>
        </section>

        <section className="rounded-lg border border-field-border bg-field-surface">
          <div className="border-b border-field-border px-4 py-3">
            <h2 className="text-base font-bold text-field-ink">
              Daftar Seluruh Pompa ({pumps.length})
            </h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[740px] text-left text-sm">
              <thead className="border-b border-field-border bg-field-bg text-xs font-semibold text-field-muted">
                <tr>
                  <th className="px-3 py-2.5">Kode Pompa</th>
                  <th className="px-3 py-2.5">Region / Estate / Block</th>
                  <th className="px-3 py-2.5">Jenis</th>
                  <th className="px-3 py-2.5">Mesin</th>
                  <th className="px-3 py-2.5">Kondisi</th>
                  <th className="px-3 py-2.5 text-right">Status Aktif</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-field-border">
                {pumps.map((p) => {
                  const loc = getPumpLocationBadgeInfo({
                    blockId: p.blockId,
                    blockCode: p.blockCode,
                    estateCode: p.estateCode,
                  });
                  return (
                    <tr key={p.id} className={!p.isActive ? "bg-field-bg/60 opacity-70" : ""}>
                      <td className="px-3 py-2.5 font-mono font-semibold">{p.pumpCode}</td>
                      <td className="px-3 py-2.5 text-xs">
                        {p.regionName ?? "-"} / <strong>{p.estateCode ?? "-"}</strong> /{" "}
                        <span className={loc.assigned ? "font-mono font-semibold" : "text-[#92400E]"}>
                          {loc.label}
                        </span>
                      </td>
                      <td className="px-3 py-2.5">{p.pumpTypeName}</td>
                      <td className="px-3 py-2.5">{p.engineBrandName}</td>
                      <td className="px-3 py-2.5">
                        <UnitStatusBadge status={p.currentUnitStatus} />
                      </td>
                      <td className="px-3 py-2.5 text-right">
                        <div className="inline-flex flex-wrap items-center justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={() => openEditIdentity(p)}
                            className="min-h-[44px] rounded border border-field-border bg-white px-3 text-xs font-semibold text-field-ink hover:bg-field-bg"
                          >
                            Edit Unit
                          </button>
                          <button
                            type="button"
                            onClick={() => setEditingPump(p)}
                            className="min-h-[44px] rounded border border-field-border bg-white px-3 text-xs font-semibold text-field-ink hover:bg-field-bg"
                          >
                            Lokasi / Info
                          </button>
                          <button
                            type="button"
                            onClick={() => togglePumpActive(p)}
                            className="min-h-[44px] rounded border border-field-border bg-field-bg px-3 text-xs font-semibold"
                          >
                            {p.isActive ? "Aktif (Nonaktifkan)" : "Nonaktif (Aktifkan)"}
                          </button>
                          <button
                            type="button"
                            onClick={() => setDeletingPump(p)}
                            className="min-h-[44px] rounded border border-[#FCA5A5] bg-[#FEF2F2] px-3 text-xs font-semibold text-[#991B1B] hover:bg-[#FEE2E2]"
                          >
                            Hapus
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      </div>

      {editingPump && master && (
        <PumpLocationDialog
          pump={editingPump}
          master={master}
          initialTab="location"
          onClose={() => setEditingPump(null)}
          onSaved={async (createdBlock) => {
            if (createdBlock) {
              await refreshMaster();
            }
            await loadData();
            setNotice(`Lokasi dan info operasional ${editingPump.pumpCode} diperbarui.`);
          }}
        />
      )}

      {editingIdentityPump && master && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="edit-pump-identity-title"
          onClick={() => {
            if (!editPumpSaving) setEditingIdentityPump(null);
          }}
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/45 p-0 sm:items-center sm:p-4"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="max-h-[92vh] w-full overflow-y-auto rounded-t-xl border border-field-border bg-field-surface shadow-xl sm:max-w-md sm:rounded-xl"
          >
            <div className="flex items-start justify-between gap-3 border-b border-field-border px-4 py-3.5 sm:px-5">
              <div>
                <p className="text-xs font-semibold text-field-muted">Kelola Master Pompa</p>
                <h2 id="edit-pump-identity-title" className="text-base font-bold text-field-ink">
                  Edit Identitas Unit {editingIdentityPump.pumpCode}
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setEditingIdentityPump(null)}
                disabled={editPumpSaving}
                aria-label="Tutup dialog edit pompa"
                className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-md border border-field-border bg-field-bg text-field-ink hover:bg-[#EAEFEA]"
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>

            <form onSubmit={handleSaveIdentity} className="space-y-4 p-4 sm:p-5">
              {editPumpError && (
                <div
                  role="alert"
                  className="rounded-md border border-[#FCA5A5] bg-[#FEE2E2] px-3 py-2 text-xs font-semibold text-[#991B1B]"
                >
                  {editPumpError}
                </div>
              )}

              <div>
                <label
                  htmlFor="edit-pump-code"
                  className="mb-1 block text-xs font-semibold text-field-muted"
                >
                  Kode Pompa
                </label>
                <input
                  id="edit-pump-code"
                  required
                  value={editPumpCode}
                  onChange={(e) => setEditPumpCode(e.target.value)}
                  className="min-h-[44px] w-full rounded-md border border-field-border px-3 font-mono text-sm text-field-ink"
                />
              </div>

              <div>
                <label
                  htmlFor="edit-pump-type"
                  className="mb-1 block text-xs font-semibold text-field-muted"
                >
                  Jenis Pompa
                </label>
                <select
                  id="edit-pump-type"
                  required
                  value={editPumpTypeId}
                  onChange={(e) => setEditPumpTypeId(e.target.value)}
                  className="min-h-[44px] w-full rounded-md border border-field-border bg-white px-3 text-sm text-field-ink"
                >
                  {master.pumpTypes.map((pt) => (
                    <option key={pt.id} value={String(pt.id)}>
                      {pt.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label
                  htmlFor="edit-pump-engine"
                  className="mb-1 block text-xs font-semibold text-field-muted"
                >
                  Merek Mesin
                </label>
                <select
                  id="edit-pump-engine"
                  required
                  value={editEngineBrandId}
                  onChange={(e) => setEditEngineBrandId(e.target.value)}
                  className="min-h-[44px] w-full rounded-md border border-field-border bg-white px-3 text-sm text-field-ink"
                >
                  {master.engineBrands.map((eb) => (
                    <option key={eb.id} value={String(eb.id)}>
                      {eb.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex flex-col-reverse gap-2 pt-2 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  onClick={() => setEditingIdentityPump(null)}
                  disabled={editPumpSaving}
                  className="min-h-[44px] rounded-md border border-field-border bg-field-bg px-4 text-sm font-semibold text-field-ink hover:bg-[#EAEFEA]"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={editPumpSaving}
                  className="min-h-[44px] rounded-md bg-field-accent px-5 text-sm font-semibold text-white hover:bg-field-accent-hover disabled:opacity-60"
                >
                  {editPumpSaving ? "Menyimpan..." : "Simpan Perubahan"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {deletingPump && (
        <ConfirmDeleteDialog
          title={`Hapus Pompa ${deletingPump.pumpCode}`}
          description={`Hapus pompa ${deletingPump.pumpCode} beserta seluruh riwayat pemeriksaan, foto, dan log jam kerjanya? Tindakan ini tidak dapat dibatalkan.`}
          onClose={() => setDeletingPump(null)}
          onConfirm={async () => {
            await fetchJson(`/api/pumps/${deletingPump.id}`, { method: "DELETE" });
            setError(null);
            setNotice(`Pompa ${deletingPump.pumpCode} berhasil dihapus permanen.`);
            await loadData();
          }}
        />
      )}
    </AppShell>
  );
}
