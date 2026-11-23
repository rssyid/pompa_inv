"use client";

import { useCallback, useEffect, useState } from "react";
import { Upload } from "lucide-react";
import { AppShell, ClientSessionUser } from "@/components/AppShell";
import { UnitStatusBadge } from "@/components/StatusBadge";
import { ErrorState, LoadingState } from "@/components/UiStates";
import { fetchJson } from "@/lib/client-fetch";

interface PreviewRow {
  pumpCode: string;
  pumpTypeName: string;
  regionName: string;
  estateCode: string;
  blockCode: string;
  engineBrand: string;
  unitStatus: string;
  partCount: number;
  photoCount: number;
}

export default function AdminImportPage() {
  const [user, setUser] = useState<ClientSessionUser | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [defaultEstateCode, setDefaultEstateCode] = useState("");
  const [preview, setPreview] = useState<PreviewRow[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resultMsg, setResultMsg] = useState<string | null>(null);

  const loadMe = useCallback(async () => {
    setLoading(true);
    try {
      const me = await fetchJson<{ user: ClientSessionUser }>("/api/auth/me");
      setUser(me.user);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal memuat sesi.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadMe();
  }, [loadMe]);

  async function runImport(mode: "preview" | "commit") {
    if (!file) {
      setError("Pilih file Excel (.xlsx) terlebih dahulu.");
      return;
    }

    setProcessing(true);
    setError(null);
    setResultMsg(null);

    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("mode", mode);
      if (defaultEstateCode.trim()) {
        fd.append("defaultEstateCode", defaultEstateCode.trim().toUpperCase());
      }

      const res = await fetch("/api/import", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Gagal memproses file Excel.");
      }

      if (mode === "preview") {
        setPreview(data.preview);
      } else {
        const s = data.summary;
        setResultMsg(
          `Import selesai: ${s.pumpsCreated} pompa baru, ${s.inspectionsCreated} pemeriksaan, ${s.photosUploaded} foto diunggah.`
        );
        setPreview(null);
        setFile(null);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal memproses import.");
    } finally {
      setProcessing(false);
    }
  }

  if (loading || !user) {
    return (
      <div className="min-h-screen bg-field-bg p-6">
        <LoadingState message="Memuat halaman import Excel..." />
      </div>
    );
  }

  return (
    <AppShell
      user={user}
      title="Import Data Excel (.xlsx)"
      subtitle="Unggah file form pemeriksaan pompa (.xlsx) untuk diimpor otomatis ke database dan Google Drive."
    >
      <div className="space-y-5">
        {error && <ErrorState message={error} />}
        {resultMsg && (
          <div
            role="status"
            aria-live="polite"
            className="rounded-md border border-[#86EFAC] bg-[#DCFCE7] px-4 py-3 text-sm font-semibold text-[#166534]"
          >
            {resultMsg}
          </div>
        )}

        <section className="rounded-lg border border-field-border bg-field-surface p-5 space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="excel-file" className="mb-1.5 block text-xs font-semibold text-field-muted">
                Pilih File Excel (.xlsx)
              </label>
              <input
                id="excel-file"
                type="file"
                accept=".xlsx"
                onChange={(e) => {
                  setFile(e.target.files?.[0] ?? null);
                  setPreview(null);
                  setResultMsg(null);
                }}
                className="min-h-[44px] w-full rounded-md border border-field-border bg-white p-2 text-sm"
              />
            </div>

            <div>
              <label htmlFor="override-estate" className="mb-1.5 block text-xs font-semibold text-field-muted">
                Override Kode Estate (Opsional, mis. PUL)
              </label>
              <input
                id="override-estate"
                type="text"
                value={defaultEstateCode}
                onChange={(e) => setDefaultEstateCode(e.target.value)}
                placeholder="Kosongkan jika nama sheet = Estate"
                className="min-h-[44px] w-full rounded-md border border-field-border bg-white px-3 text-sm"
              />
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={!file || processing}
              onClick={() => runImport("preview")}
              className="inline-flex min-h-[44px] items-center gap-2 rounded-md border border-field-border bg-field-bg px-4 text-sm font-semibold text-field-ink hover:bg-[#EAEFEA] disabled:opacity-60"
            >
              <Upload className="h-4 w-4" aria-hidden="true" />
              <span>{processing ? "Membaca Excel..." : "Pratinjau Isi File"}</span>
            </button>

            {preview && preview.length > 0 && (
              <button
                type="button"
                disabled={processing}
                onClick={() => runImport("commit")}
                className="min-h-[44px] rounded-md bg-field-accent px-5 text-sm font-semibold text-white hover:bg-field-accent-hover disabled:opacity-60"
              >
                {processing
                  ? "Mengimpor & Mengunggah Foto..."
                  : `Simpan ${preview.length} Pompa ke Database`}
              </button>
            )}
          </div>
        </section>

        {preview && (
          <section className="rounded-lg border border-field-border bg-field-surface">
            <div className="border-b border-field-border px-4 py-3">
              <h2 className="text-base font-bold text-field-ink">
                Hasil Deteksi ({preview.length} Unit Pompa)
              </h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[700px] text-left text-sm">
                <thead className="border-b border-field-border bg-field-bg text-xs font-semibold text-field-muted">
                  <tr>
                    <th className="px-3 py-2.5">Kode Pompa</th>
                    <th className="px-3 py-2.5">Estate / Block</th>
                    <th className="px-3 py-2.5">Jenis</th>
                    <th className="px-3 py-2.5">Mesin</th>
                    <th className="px-3 py-2.5">Status Terdeteksi</th>
                    <th className="px-3 py-2.5 text-right">Part</th>
                    <th className="px-3 py-2.5 text-right">Foto</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-field-border">
                  {preview.map((row) => (
                    <tr key={`${row.estateCode}-${row.pumpCode}`}>
                      <td className="px-3 py-2.5 font-mono font-semibold">{row.pumpCode}</td>
                      <td className="px-3 py-2.5 font-mono text-xs">
                        {row.estateCode} / {row.blockCode}
                      </td>
                      <td className="px-3 py-2.5">{row.pumpTypeName}</td>
                      <td className="px-3 py-2.5">{row.engineBrand}</td>
                      <td className="px-3 py-2.5">
                        <UnitStatusBadge status={row.unitStatus} />
                      </td>
                      <td className="px-3 py-2.5 text-right font-mono tabular-nums">
                        {row.partCount}
                      </td>
                      <td className="px-3 py-2.5 text-right font-mono tabular-nums">
                        {row.photoCount}
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
