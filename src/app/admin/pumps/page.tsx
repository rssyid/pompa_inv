"use client";

import { useCallback, useEffect, useState } from "react";
import { useAppData } from "@/components/AppDataProvider";
import { AppShell } from "@/components/AppShell";
import { UnitStatusBadge } from "@/components/StatusBadge";
import { ErrorState, LoadingState } from "@/components/UiStates";
import { EnrichedPump, fetchJson } from "@/lib/client-fetch";

export default function AdminPumpsPage() {
  const { user, master, ensureLoaded, error: bootError } = useAppData();
  const [pumps, setPumps] = useState<EnrichedPump[]>([]);
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
          blockId: Number(blockId),
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
                Block
              </label>
              <select
                id="add-block"
                required
                value={blockId}
                onChange={(e) => setBlockId(e.target.value)}
                className="min-h-[44px] w-full rounded-md border border-field-border bg-white px-3 text-sm"
              >
                <option value="">Pilih Block</option>
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
                disabled={saving || !blockId}
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
                {pumps.map((p) => (
                  <tr key={p.id} className={!p.isActive ? "bg-field-bg/60 opacity-70" : ""}>
                    <td className="px-3 py-2.5 font-mono font-semibold">{p.pumpCode}</td>
                    <td className="px-3 py-2.5 text-xs">
                      {p.regionName} / <strong>{p.estateCode}</strong> / {p.blockCode}
                    </td>
                    <td className="px-3 py-2.5">{p.pumpTypeName}</td>
                    <td className="px-3 py-2.5">{p.engineBrandName}</td>
                    <td className="px-3 py-2.5">
                      <UnitStatusBadge status={p.currentUnitStatus} />
                    </td>
                    <td className="px-3 py-2.5 text-right">
                      <button
                        type="button"
                        onClick={() => togglePumpActive(p)}
                        className="min-h-[44px] rounded border border-field-border bg-field-bg px-3 text-xs font-semibold"
                      >
                        {p.isActive ? "Aktif (Nonaktifkan)" : "Nonaktif (Aktifkan)"}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </AppShell>
  );
}
