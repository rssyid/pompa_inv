"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft, ClipboardCheck, Download, Printer, X } from "lucide-react";
import { useAppData } from "@/components/AppDataProvider";
import { AppShell } from "@/components/AppShell";
import {
  AvailabilityLabel,
  ConditionLabel,
  UnitStatusBadge,
} from "@/components/StatusBadge";
import { EmptyState, ErrorState, LoadingState } from "@/components/UiStates";
import { fetchJson } from "@/lib/client-fetch";

interface PumpDetail {
  id: number;
  pumpCode: string;
  currentUnitStatus: string;
  blockCode: string;
  estateCode: string;
  regionName: string;
  companyName: string;
  pumpTypeName: string;
  engineBrandName: string;
}

interface InspectionItemRow {
  id: number;
  sectionCode: string;
  sectionName: string;
  itemNo: number;
  partName: string;
  expectedQty: number;
  availability: string;
  condition: string;
  issueLabel: string | null;
  notes: string | null;
}

interface InspectionPhotoRow {
  id: number;
  fileName: string;
  caption: string | null;
}

interface InspectionRecord {
  id: number;
  inspectorName: string;
  inspectedAt: string;
  unitStatus: string;
  notes: string | null;
  source: string;
  items: InspectionItemRow[];
  photos: InspectionPhotoRow[];
}

export default function PumpDetailPage() {
  const params = useParams<{ id: string }>();
  const { user, ensureLoaded, error: bootError } = useAppData();
  const [pump, setPump] = useState<PumpDetail | null>(null);
  const [inspections, setInspections] = useState<InspectionRecord[]>([]);
  const [selectedInspectionId, setSelectedInspectionId] = useState<number | null>(null);
  const [lightboxPhoto, setLightboxPhoto] = useState<InspectionPhotoRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [, detailRes] = await Promise.all([
        ensureLoaded(),
        fetchJson<{ pump: PumpDetail; inspections: InspectionRecord[] }>(
          `/api/pumps/${params.id}`
        ),
      ]);
      setPump(detailRes.pump);
      setInspections(detailRes.inspections);
      if (detailRes.inspections.length > 0) {
        setSelectedInspectionId(detailRes.inspections[0].id);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal memuat detail pompa.");
    } finally {
      setLoading(false);
    }
  }, [ensureLoaded, params.id]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  if (loading) {
    return (
      <div className="min-h-screen bg-field-bg p-6">
        <LoadingState message="Memuat detail unit pompa..." />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-field-bg p-6">
        <ErrorState
          title="Gagal memuat detail pompa"
          message={error || bootError || "Terjadi gangguan koneksi ke server."}
          onRetry={loadData}
        />
      </div>
    );
  }

  if (error || !pump) {
    return (
      <AppShell user={user} title="Detail Pompa">
        <ErrorState message={error || "Pompa tidak ditemukan."} onRetry={loadData} />
      </AppShell>
    );
  }

  const activeInspection =
    inspections.find((ins) => ins.id === selectedInspectionId) ?? inspections[0] ?? null;

  return (
    <AppShell
      user={user}
      title={`Pompa ${pump.pumpCode}`}
      subtitle={`${pump.companyName} / ${pump.regionName} / ${pump.estateCode} / Blok ${pump.blockCode}`}
    >
      <div className="space-y-5">
        {/* Action Bar */}
        <div className="no-print flex flex-wrap items-center justify-between gap-2">
          <Link
            href="/pumps"
            className="inline-flex min-h-[44px] items-center gap-1.5 rounded-md border border-field-border bg-field-surface px-3 text-sm font-semibold text-field-ink hover:bg-[#EAEFEA]"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            <span>Kembali</span>
          </Link>

          <div className="flex flex-wrap items-center gap-2">
            <a
              href={`/api/reports/export?type=pump&pumpId=${pump.id}`}
              className="inline-flex min-h-[44px] items-center gap-1.5 rounded-md border border-field-border bg-field-surface px-3 text-sm font-semibold text-field-ink hover:bg-[#EAEFEA]"
            >
              <Download className="h-4 w-4" aria-hidden="true" />
              <span>Export Excel</span>
            </a>
            <button
              type="button"
              onClick={() => window.print()}
              className="inline-flex min-h-[44px] items-center gap-1.5 rounded-md border border-field-border bg-field-surface px-3 text-sm font-semibold text-field-ink hover:bg-[#EAEFEA]"
            >
              <Printer className="h-4 w-4" aria-hidden="true" />
              <span>Cetak / PDF</span>
            </button>
            <Link
              href={`/pumps/${pump.id}/inspect`}
              className="inline-flex min-h-[44px] items-center gap-1.5 rounded-md bg-field-accent px-4 text-sm font-semibold text-white hover:bg-field-accent-hover"
            >
              <ClipboardCheck className="h-4 w-4" aria-hidden="true" />
              <span>Periksa Sekarang</span>
            </Link>
          </div>
        </div>

        {/* Unit Identity Card */}
        <section className="rounded-lg border border-field-border bg-field-surface p-4 sm:p-5">
          <div className="flex flex-wrap items-start justify-between gap-3 border-b border-field-border pb-4">
            <div>
              <p className="text-xs font-semibold text-field-muted">{pump.companyName}</p>
              <h2 className="mt-0.5 font-mono text-xl font-bold text-field-ink">
                {pump.pumpCode}
              </h2>
            </div>
            <UnitStatusBadge status={pump.currentUnitStatus} />
          </div>

          <dl className="mt-4 grid grid-cols-2 gap-4 text-sm sm:grid-cols-4">
            <div>
              <dt className="text-xs font-semibold text-field-muted">Region</dt>
              <dd className="mt-0.5 font-medium text-field-ink">{pump.regionName}</dd>
            </div>
            <div>
              <dt className="text-xs font-semibold text-field-muted">Estate / Block</dt>
              <dd className="mt-0.5 font-mono font-semibold text-field-ink">
                {pump.estateCode} / {pump.blockCode}
              </dd>
            </div>
            <div>
              <dt className="text-xs font-semibold text-field-muted">Jenis Pompa</dt>
              <dd className="mt-0.5 font-medium text-field-ink">{pump.pumpTypeName}</dd>
            </div>
            <div>
              <dt className="text-xs font-semibold text-field-muted">Merek Mesin</dt>
              <dd className="mt-0.5 font-medium text-field-ink">{pump.engineBrandName}</dd>
            </div>
          </dl>
        </section>

        {inspections.length === 0 ? (
          <EmptyState
            title="Belum ada catatan pemeriksaan"
            description="Unit ini belum pernah diperiksa. Mulai pemeriksaan pertama untuk mencatat kondisi komponen dan foto dokumentasi."
            actionLabel="Mulai Pemeriksaan"
            onAction={() => {
              window.location.href = `/pumps/${pump.id}/inspect`;
            }}
          />
        ) : (
          <div className="grid grid-cols-1 gap-5 lg:grid-cols-4">
            {/* History Selector */}
            <aside className="no-print space-y-2 lg:col-span-1">
              <h2 className="text-sm font-bold text-field-ink">
                Riwayat Pemeriksaan ({inspections.length})
              </h2>
              <ul className="space-y-2">
                {inspections.map((ins) => {
                  const selected = activeInspection?.id === ins.id;
                  return (
                    <li key={ins.id}>
                      <button
                        type="button"
                        onClick={() => setSelectedInspectionId(ins.id)}
                        className={`flex min-h-[44px] w-full flex-col items-start rounded-md border p-3 text-left text-xs ${
                          selected
                            ? "border-[#15803D] bg-[#F0FDF4]"
                            : "border-field-border bg-field-surface hover:bg-field-bg"
                        }`}
                      >
                        <div className="flex w-full items-center justify-between gap-2">
                          <span className="font-mono font-bold text-field-ink">
                            {ins.inspectedAt}
                          </span>
                          <UnitStatusBadge status={ins.unitStatus} />
                        </div>
                        <span className="mt-1 text-field-muted">Oleh: {ins.inspectorName}</span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </aside>

            {/* Active Inspection Detail */}
            {activeInspection && (
              <div className="space-y-5 lg:col-span-3">
                <section className="rounded-lg border border-field-border bg-field-surface p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-field-border pb-3">
                    <div>
                      <h3 className="text-base font-bold text-field-ink">
                        Hasil Pemeriksaan ({activeInspection.inspectedAt})
                      </h3>
                      <p className="text-xs text-field-muted">
                        Pemeriksa: {activeInspection.inspectorName}
                        {activeInspection.notes ? ` • Catatan: ${activeInspection.notes}` : ""}
                      </p>
                    </div>
                    <UnitStatusBadge status={activeInspection.unitStatus} />
                  </div>

                  <div className="mt-3 overflow-x-auto">
                    <table className="w-full min-w-[600px] text-left text-sm">
                      <thead className="border-b border-field-border bg-field-bg text-xs font-semibold text-field-muted">
                        <tr>
                          <th className="px-3 py-2">No</th>
                          <th className="px-3 py-2">Komponen</th>
                          <th className="px-3 py-2 text-right">Qty</th>
                          <th className="px-3 py-2">Ketersediaan</th>
                          <th className="px-3 py-2">Kondisi</th>
                          <th className="px-3 py-2">Temuan / Detail</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-field-border">
                        {activeInspection.items.map((item) => {
                          const isHeader = item.itemNo === 0;
                          return (
                            <tr
                              key={item.id}
                              className={isHeader ? "bg-field-bg/80 font-semibold" : ""}
                            >
                              <td className="px-3 py-2 font-mono text-xs">
                                {isHeader ? item.sectionCode : item.itemNo}
                              </td>
                              <td className="px-3 py-2 text-field-ink">{item.partName}</td>
                              <td className="px-3 py-2 text-right font-mono tabular-nums">
                                {item.expectedQty}
                              </td>
                              <td className="px-3 py-2">
                                <AvailabilityLabel value={item.availability} />
                              </td>
                              <td className="px-3 py-2">
                                <ConditionLabel value={item.condition} />
                              </td>
                              <td className="px-3 py-2 text-xs text-field-muted">
                                {item.issueLabel && item.issueLabel !== "Normal / Baik"
                                  ? item.issueLabel
                                  : "-"}
                                {item.notes ? ` (${item.notes})` : ""}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </section>

                {/* Photo Gallery */}
                <section className="rounded-lg border border-field-border bg-field-surface p-4 print-break-inside-avoid">
                  <h3 className="text-base font-bold text-field-ink">
                    Dokumentasi Foto ({activeInspection.photos.length})
                  </h3>

                  {activeInspection.photos.length === 0 ? (
                    <p className="mt-2 text-sm text-field-muted">
                      Tidak ada foto dokumentasi pada pemeriksaan ini.
                    </p>
                  ) : (
                    <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
                      {activeInspection.photos.map((photo) => (
                        <button
                          key={photo.id}
                          type="button"
                          onClick={() => setLightboxPhoto(photo)}
                          className="group overflow-hidden rounded-md border border-field-border bg-field-bg text-left hover:border-field-accent"
                        >
                          <img
                            src={`/api/photos/${photo.id}`}
                            alt={photo.caption || `Foto pompa ${pump.pumpCode}`}
                            width={400}
                            height={300}
                            loading="lazy"
                            className="aspect-[4/3] w-full object-cover"
                          />
                          <span className="block truncate px-2.5 py-2 text-xs font-medium text-field-ink">
                            {photo.caption || photo.fileName}
                          </span>
                        </button>
                      ))}
                    </div>
                  )}
                </section>
              </div>
            )}
          </div>
        )}

        {/* Photo Lightbox Modal */}
        {lightboxPhoto && (
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Pratinjau foto dokumentasi"
            onKeyDown={(e) => {
              if (e.key === "Escape") setLightboxPhoto(null);
            }}
            onClick={() => setLightboxPhoto(null)}
            className="no-print fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4"
          >
            <div
              onClick={(e) => e.stopPropagation()}
              className="relative max-h-[90vh] w-full max-w-3xl overflow-hidden rounded-lg bg-field-surface p-3"
            >
              <div className="mb-2 flex items-center justify-between gap-2">
                <p className="truncate text-sm font-semibold text-field-ink">
                  {lightboxPhoto.caption || lightboxPhoto.fileName}
                </p>
                <button
                  type="button"
                  autoFocus
                  onClick={() => setLightboxPhoto(null)}
                  aria-label="Tutup foto"
                  className="inline-flex h-11 w-11 items-center justify-center rounded-md border border-field-border bg-field-bg text-field-ink"
                >
                  <X className="h-4 w-4" aria-hidden="true" />
                </button>
              </div>
              <img
                src={`/api/photos/${lightboxPhoto.id}`}
                alt={lightboxPhoto.caption || lightboxPhoto.fileName}
                width={1200}
                height={900}
                className="max-h-[75vh] w-full rounded object-contain"
              />
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}
