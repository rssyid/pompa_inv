"use client";

import { useCallback, useEffect, useState } from "react";
import { AppShell, ClientSessionUser } from "@/components/AppShell";
import { MasterTreeData } from "@/components/HierarchyFilterBar";
import { EmptyState, ErrorState, LoadingState } from "@/components/UiStates";
import { fetchJson } from "@/lib/client-fetch";

type MasterTab =
  | "pt"
  | "region"
  | "estate"
  | "block"
  | "pump_type"
  | "engine"
  | "preset";

export default function AdminMasterPage() {
  const [user, setUser] = useState<ClientSessionUser | null>(null);
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

  const [blkEstateId, setBlkEstateId] = useState("");
  const [blkCode, setBlkCode] = useState("");
  const [blkName, setBlkName] = useState("");

  const [ptTypeCode, setPtTypeCode] = useState("");
  const [ptTypeName, setPtTypeName] = useState("");
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

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [meRes, treeRes] = await Promise.all([
        fetchJson<{ user: ClientSessionUser }>("/api/auth/me"),
        fetchJson<MasterTreeData>("/api/master/tree?includeInactive=true"),
      ]);
      setUser(meRes.user);
      setMaster(treeRes);

      if (!regCompanyId && treeRes.companies[0]) {
        setRegCompanyId(String(treeRes.companies[0].id));
      }
      if (!estRegionId && treeRes.regions[0]) {
        setEstRegionId(String(treeRes.regions[0].id));
      }
      if (!blkEstateId && treeRes.estates[0]) {
        setBlkEstateId(String(treeRes.estates[0].id));
      }
      if (!selectedPumpTypeId && treeRes.pumpTypes[0]) {
        setSelectedPumpTypeId(String(treeRes.pumpTypes[0].id));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal memuat master data.");
    } finally {
      setLoading(false);
    }
  }, [blkEstateId, estRegionId, regCompanyId, selectedPumpTypeId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  async function mutate(url: string, method: "POST" | "PATCH", payload: unknown, successMsg: string) {
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
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal menyimpan perubahan.");
    } finally {
      setSaving(false);
    }
  }

  if (loading || !user) {
    return (
      <div className="min-h-screen bg-field-bg p-6">
        <LoadingState message="Memuat master data..." />
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
                        <button
                          type="button"
                          onClick={() =>
                            mutate(
                              "/api/master/companies",
                              "PATCH",
                              { id: c.id, isActive: !c.isActive },
                              `Status PT ${c.code} diperbarui.`
                            )
                          }
                          className="min-h-[44px] rounded border border-field-border bg-field-bg px-3 text-xs font-semibold"
                        >
                          {c.isActive ? "Nonaktifkan" : "Aktifkan"}
                        </button>
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
                          <button
                            type="button"
                            onClick={() =>
                              mutate(
                                "/api/master/regions",
                                "PATCH",
                                { id: r.id, isActive: !r.isActive },
                                `Status Region ${r.code} diperbarui.`
                              )
                            }
                            className="min-h-[44px] rounded border border-field-border bg-field-bg px-3 text-xs font-semibold"
                          >
                            {r.isActive ? "Nonaktifkan" : "Aktifkan"}
                          </button>
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
            <h2 className="text-base font-bold text-field-ink">Daftar Estate</h2>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                mutate(
                  "/api/master/estates",
                  "POST",
                  { regionId: Number(estRegionId), code: estCode, name: estName },
                  "Estate berhasil ditambahkan."
                ).then(() => {
                  setEstCode("");
                  setEstName("");
                });
              }}
              className="grid grid-cols-1 gap-3 sm:grid-cols-4"
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
              <table className="w-full min-w-[560px] text-left text-sm">
                <thead className="border-b border-field-border bg-field-bg text-xs font-semibold text-field-muted">
                  <tr>
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
                    return (
                      <tr key={es.id}>
                        <td className="px-3 py-2.5 text-xs text-field-muted">
                          {reg?.name ?? es.regionId}
                        </td>
                        <td className="px-3 py-2.5 font-mono font-semibold">{es.code}</td>
                        <td className="px-3 py-2.5">{es.name}</td>
                        <td className="px-3 py-2.5 text-xs">
                          {es.isActive ? "Aktif" : "Nonaktif"}
                        </td>
                        <td className="px-3 py-2.5 text-right">
                          <button
                            type="button"
                            onClick={() =>
                              mutate(
                                "/api/master/estates",
                                "PATCH",
                                { id: es.id, isActive: !es.isActive },
                                `Status Estate ${es.code} diperbarui.`
                              )
                            }
                            className="min-h-[44px] rounded border border-field-border bg-field-bg px-3 text-xs font-semibold"
                          >
                            {es.isActive ? "Nonaktifkan" : "Aktifkan"}
                          </button>
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
                          <button
                            type="button"
                            onClick={() =>
                              mutate(
                                "/api/master/blocks",
                                "PATCH",
                                { id: b.id, isActive: !b.isActive },
                                `Status Block ${b.code} diperbarui.`
                              )
                            }
                            className="min-h-[44px] rounded border border-field-border bg-field-bg px-3 text-xs font-semibold"
                          >
                            {b.isActive ? "Nonaktifkan" : "Aktifkan"}
                          </button>
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
                    { code: ptTypeCode, name: ptTypeName },
                    "Jenis Pompa berhasil ditambahkan."
                  ).then(() => {
                    setPtTypeCode("");
                    setPtTypeName("");
                  });
                }}
                className="grid grid-cols-1 gap-3 sm:grid-cols-3"
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
                  <table className="w-full min-w-[560px] text-left text-sm">
                    <thead className="border-b border-field-border bg-field-bg text-xs font-semibold text-field-muted">
                      <tr>
                        <th className="px-3 py-2">Bagian</th>
                        <th className="px-3 py-2">No</th>
                        <th className="px-3 py-2">Nama Komponen</th>
                        <th className="px-3 py-2 text-right">Qty</th>
                        <th className="px-3 py-2 text-right">Status</th>
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
                          <td className="px-3 py-2 text-right">
                            <button
                              type="button"
                              onClick={() =>
                                mutate(
                                  `/api/master/pump-types/${selectedPumpTypeId}/parts`,
                                  "PATCH",
                                  { partId: part.id, isActive: !part.isActive },
                                  `Status komponen ${part.partName} diperbarui.`
                                )
                              }
                              className="min-h-[44px] rounded border border-field-border bg-field-bg px-3 text-xs font-semibold"
                            >
                              {part.isActive ? "Aktif" : "Nonaktif"}
                            </button>
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

            <ul className="divide-y divide-field-border rounded-md border border-field-border">
              {master.engineBrands.map((eb) => (
                <li key={eb.id} className="flex items-center justify-between px-4 py-2.5 text-sm">
                  <span className="font-medium">{eb.name}</span>
                  <button
                    type="button"
                    onClick={() =>
                      mutate(
                        "/api/master/engine-brands",
                        "PATCH",
                        { id: eb.id, isActive: !eb.isActive },
                        `Merek ${eb.name} diperbarui.`
                      )
                    }
                    className="min-h-[44px] rounded border border-field-border bg-field-bg px-3 text-xs font-semibold"
                  >
                    {eb.isActive ? "Aktif" : "Nonaktif"}
                  </button>
                </li>
              ))}
            </ul>
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
              <table className="w-full min-w-[520px] text-left text-sm">
                <thead className="border-b border-field-border bg-field-bg text-xs font-semibold text-field-muted">
                  <tr>
                    <th className="px-3 py-2">Label Temuan</th>
                    <th className="px-3 py-2">Default Ketersediaan</th>
                    <th className="px-3 py-2">Default Kondisi</th>
                    <th className="px-3 py-2 text-right">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-field-border">
                  {master.issuePresets.map((ip) => (
                    <tr key={ip.id}>
                      <td className="px-3 py-2 font-medium">{ip.label}</td>
                      <td className="px-3 py-2 text-xs">{ip.defaultAvailability}</td>
                      <td className="px-3 py-2 text-xs">{ip.defaultCondition}</td>
                      <td className="px-3 py-2 text-right">
                        <button
                          type="button"
                          onClick={() =>
                            mutate(
                              "/api/master/issue-presets",
                              "PATCH",
                              { id: ip.id, isActive: !ip.isActive },
                              `Status temuan "${ip.label}" diperbarui.`
                            )
                          }
                          className="min-h-[44px] rounded border border-field-border bg-field-bg px-3 text-xs font-semibold"
                        >
                          {ip.isActive ? "Aktif" : "Nonaktif"}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}
      </div>
    </AppShell>
  );
}
