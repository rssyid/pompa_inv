import React from "react";
import { EnrichedPump } from "@/lib/client-fetch";

export type ReportPrintScope = "all" | "estate_units" | "issues";

export interface ReportEstateSummaryRow {
  estateId: number;
  estateCode: string;
  regionName: string;
  total: number;
  aktif: number;
  perluPerbaikan: number;
  rusakTotal: number;
  issueCount: number;
}

export interface ReportIssueRow {
  id: number;
  pumpId: number;
  pumpCode: string;
  regionName: string;
  estateCode: string;
  blockCode: string;
  pumpTypeName: string;
  sectionName: string;
  partName: string;
  expectedQty: number;
  availability: string;
  condition: string;
  issueLabel: string;
  notes: string;
  inspectedAt: string;
}

export interface ReportSummaryPayload {
  totals: {
    total: number;
    aktif: number;
    perluPerbaikan: number;
    rusakTotal: number;
    totalIssues: number;
  };
  byEstate: ReportEstateSummaryRow[];
  pumps: EnrichedPump[];
  issues: ReportIssueRow[];
}

export interface ReportFilterSummaryItem {
  label: string;
  value: string;
}

const SCOPE_SUBTITLE: Record<ReportPrintScope, string> = {
  all: "Rekapitulasi Estate, Kondisi Unit Pompa, dan Daftar Komponen Bermasalah",
  estate_units: "Rekapitulasi Estate dan Daftar Kondisi Unit Pompa",
  issues: "Daftar Komponen Bermasalah dan Hilang",
};

function formatUnitStatusBadge(status: string): {
  label: string;
  badgeClass: string;
  rowClass: string;
} {
  if (status === "aktif") {
    return {
      label: "✓ Aktif",
      badgeClass: "border-[#86EFAC] bg-[#DCFCE7] text-[#166534] font-semibold",
      rowClass: "bg-white",
    };
  }
  if (status === "perlu_perbaikan") {
    return {
      label: "! Perlu Perbaikan",
      badgeClass: "border-[#FCD34D] bg-[#FEF3C7] text-[#92400E] font-bold",
      rowClass: "bg-[#FFFBEB]",
    };
  }
  return {
    label: "✕ Rusak Total",
    badgeClass: "border-[#FCA5A5] bg-[#FEE2E2] text-[#991B1B] font-bold",
    rowClass: "bg-[#FEF2F2]",
  };
}

function formatPartStatus(availability: string, condition: string): {
  label: string;
  detail: string;
  badgeClass: string;
} {
  const condText = condition === "rusak" ? "Kondisi: Rusak" : "Kondisi: Baik";
  if (availability === "hilang") {
    return {
      label: "✕ Hilang",
      detail: condText,
      badgeClass: "border-[#FCA5A5] bg-[#FEE2E2] text-[#991B1B] font-bold",
    };
  }
  if (availability === "tidak_lengkap") {
    return {
      label: "! Tidak Lengkap",
      detail: condText,
      badgeClass: "border-[#FCD34D] bg-[#FEF3C7] text-[#92400E] font-bold",
    };
  }
  if (condition === "rusak") {
    return {
      label: "✕ Rusak",
      detail: "Ketersediaan: Ada",
      badgeClass: "border-[#FCA5A5] bg-[#FEE2E2] text-[#991B1B] font-bold",
    };
  }
  return {
    label: "✓ Ada / Baik",
    detail: condText,
    badgeClass: "border-[#86EFAC] bg-[#DCFCE7] text-[#166534] font-semibold",
  };
}

export function ReportsPrintReport({
  report,
  scope,
  companyTitle,
  filterItems,
  printedBy,
  printedAt,
  pageBreakBeforeIssues = false,
  forceShow = false,
}: {
  report: ReportSummaryPayload;
  scope: ReportPrintScope;
  companyTitle: string;
  filterItems: ReportFilterSummaryItem[];
  printedBy: string;
  printedAt: string;
  pageBreakBeforeIssues?: boolean;
  forceShow?: boolean;
}) {
  const showEstatesAndUnits = scope === "all" || scope === "estate_units";
  const showIssues = scope === "all" || scope === "issues";

  const estateTotals = report.byEstate.reduce(
    (acc, row) => ({
      total: acc.total + row.total,
      aktif: acc.aktif + row.aktif,
      perluPerbaikan: acc.perluPerbaikan + row.perluPerbaikan,
      rusakTotal: acc.rusakTotal + row.rusakTotal,
      issueCount: acc.issueCount + row.issueCount,
    }),
    { total: 0, aktif: 0, perluPerbaikan: 0, rusakTotal: 0, issueCount: 0 }
  );

  return (
    <article
      aria-label="Format cetak laporan rekapitulasi pompa A4"
      className={
        forceShow
          ? "mx-auto w-[210mm] min-h-[297mm] rounded border border-[#B8C4BC] bg-white p-[11mm] text-[#132019] shadow-sm print:min-h-0 print:w-full print:max-w-none print:rounded-none print:border-0 print:p-0 print:shadow-none"
          : "hidden print:block bg-white text-[#132019]"
      }
    >
      {/* Formal Letterhead */}
      <header className="flex items-start justify-between gap-4 border-b-2 border-[#132019] pb-2.5">
        <div className="min-w-0">
          <p className="text-[10px] font-bold text-[#15803D]">{companyTitle}</p>
          <h2 className="mt-0.5 text-[15px] font-bold tracking-tight text-[#132019]">
            LAPORAN REKAPITULASI KONDISI POMPA
          </h2>
          <p className="mt-0.5 text-[9.5px] text-[#47554D]">{SCOPE_SUBTITLE[scope]}</p>
        </div>

        <div className="flex shrink-0 items-center gap-3 rounded border border-[#B8C4BC] bg-[#F8FAF8] px-3 py-1.5 text-right">
          <div>
            <p className="text-[8px] font-semibold text-[#47554D]">TANGGAL CETAK</p>
            <p className="font-mono text-[10px] font-bold tabular-nums text-[#132019]">
              {printedAt}
            </p>
          </div>
          <div className="h-7 w-px bg-[#CBD5CE]" />
          <div>
            <p className="text-[8px] font-semibold text-[#47554D]">DICETAK OLEH</p>
            <p className="max-w-[34mm] truncate text-[10px] font-semibold text-[#132019]">
              {printedBy}
            </p>
          </div>
          <div className="h-7 w-px bg-[#CBD5CE]" />
          <div>
            <p className="text-[8px] font-semibold text-[#47554D]">TOTAL UNIT</p>
            <p className="font-mono text-[12px] font-bold tabular-nums text-[#132019]">
              {report.totals.total}
            </p>
          </div>
        </div>
      </header>

      {/* Active Filter Scope + 5-Metric Summary Strip */}
      <section className="print-avoid-break mt-2.5 overflow-hidden rounded border border-[#B8C4BC] bg-[#F8FAF8]">
        <div className="border-b border-[#D5DDD7] bg-white px-2.5 py-1.5 text-[8.5px] text-[#132019]">
          <span className="font-bold text-[#47554D]">Cakupan Filter: </span>
          {filterItems.length === 0 ? (
            <span>Semua PT, Wilayah, Jenis Pompa, dan Seluruh Periode Pemeriksaan</span>
          ) : (
            <span>
              {filterItems.map((item) => `${item.label}: ${item.value}`).join("  |  ")}
            </span>
          )}
        </div>

        <div className="grid grid-cols-5 divide-x divide-[#B8C4BC] text-[9px]">
          <div className="px-2.5 py-1.5">
            <p className="text-[8px] font-semibold text-[#47554D]">TOTAL UNIT</p>
            <p className="mt-0.5 font-mono text-[12px] font-bold tabular-nums text-[#132019]">
              {report.totals.total}
            </p>
          </div>
          <div className="px-2.5 py-1.5">
            <p className="text-[8px] font-semibold text-[#166534]">AKTIF</p>
            <p className="mt-0.5 font-mono text-[12px] font-bold tabular-nums text-[#166534]">
              {report.totals.aktif}
            </p>
          </div>
          <div className="px-2.5 py-1.5">
            <p className="text-[8px] font-semibold text-[#92400E]">PERLU PERBAIKAN</p>
            <p className="mt-0.5 font-mono text-[12px] font-bold tabular-nums text-[#92400E]">
              {report.totals.perluPerbaikan}
            </p>
          </div>
          <div className="px-2.5 py-1.5">
            <p className="text-[8px] font-semibold text-[#991B1B]">RUSAK TOTAL</p>
            <p className="mt-0.5 font-mono text-[12px] font-bold tabular-nums text-[#991B1B]">
              {report.totals.rusakTotal}
            </p>
          </div>
          <div className="px-2.5 py-1.5">
            <p className="text-[8px] font-semibold text-[#47554D]">PART BERMASALAH</p>
            <p className="mt-0.5 font-mono text-[12px] font-bold tabular-nums text-[#132019]">
              {report.totals.totalIssues}
            </p>
          </div>
        </div>
      </section>

      {/* Section 1: Compact Estate Summary */}
      {showEstatesAndUnits && report.byEstate.length > 0 && (
        <section className="print-avoid-break mt-3">
          <div className="mb-1 flex items-baseline justify-between">
            <h3 className="text-[10px] font-bold text-[#132019]">
              1. REKAPITULASI PER ESTATE ({report.byEstate.length} ESTATE)
            </h3>
            <span className="text-[8px] text-[#47554D]">
              Ringkasan kesiapan unit berdasarkan lokasi
            </span>
          </div>

          <div className="overflow-hidden rounded border border-[#B8C4BC] bg-white">
            <table className="print-table w-full table-fixed border-collapse text-left text-[8.5px] leading-tight">
              <thead>
                <tr className="border-b border-[#B8C4BC] bg-[#EEF2EF] text-[8px] font-bold text-[#132019]">
                  <th className="w-[7mm] px-1.5 py-1 text-center">No</th>
                  <th className="px-2 py-1">Region / Wilayah</th>
                  <th className="w-[18mm] px-1.5 py-1">Estate</th>
                  <th className="w-[18mm] px-1.5 py-1 text-right">Total Unit</th>
                  <th className="w-[16mm] px-1.5 py-1 text-right">Aktif</th>
                  <th className="w-[24mm] px-1.5 py-1 text-right">Perlu Perbaikan</th>
                  <th className="w-[20mm] px-1.5 py-1 text-right">Rusak Total</th>
                  <th className="w-[21mm] px-1.5 py-1 text-right">Temuan Part</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E4EAE5]">
                {report.byEstate.map((est, idx) => (
                  <tr key={`${est.estateId}-${est.estateCode}`}>
                    <td className="px-1.5 py-[3px] text-center font-mono tabular-nums text-[#47554D]">
                      {idx + 1}
                    </td>
                    <td className="truncate px-2 py-[3px] text-[#132019]">{est.regionName}</td>
                    <td className="px-1.5 py-[3px] font-mono font-bold text-[#132019]">
                      {est.estateCode}
                    </td>
                    <td className="px-1.5 py-[3px] text-right font-mono font-semibold tabular-nums text-[#132019]">
                      {est.total}
                    </td>
                    <td className="px-1.5 py-[3px] text-right font-mono tabular-nums text-[#166534]">
                      {est.aktif}
                    </td>
                    <td className="px-1.5 py-[3px] text-right font-mono font-semibold tabular-nums text-[#92400E]">
                      {est.perluPerbaikan}
                    </td>
                    <td className="px-1.5 py-[3px] text-right font-mono font-semibold tabular-nums text-[#991B1B]">
                      {est.rusakTotal}
                    </td>
                    <td className="px-1.5 py-[3px] text-right font-mono font-semibold tabular-nums text-[#132019]">
                      {est.issueCount}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t border-[#B8C4BC] bg-[#EEF2EF] text-[8.5px] font-bold text-[#132019]">
                  <td colSpan={3} className="px-2 py-1 text-right">
                    TOTAL KESELURUHAN
                  </td>
                  <td className="px-1.5 py-1 text-right font-mono tabular-nums">
                    {estateTotals.total}
                  </td>
                  <td className="px-1.5 py-1 text-right font-mono tabular-nums text-[#166534]">
                    {estateTotals.aktif}
                  </td>
                  <td className="px-1.5 py-1 text-right font-mono tabular-nums text-[#92400E]">
                    {estateTotals.perluPerbaikan}
                  </td>
                  <td className="px-1.5 py-1 text-right font-mono tabular-nums text-[#991B1B]">
                    {estateTotals.rusakTotal}
                  </td>
                  <td className="px-1.5 py-1 text-right font-mono tabular-nums">
                    {estateTotals.issueCount}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </section>
      )}

      {/* Section 2: Unit Condition List */}
      {showEstatesAndUnits && (
        <section className="mt-3">
          <div className="print-avoid-break mb-1 flex items-baseline justify-between">
            <h3 className="text-[10px] font-bold text-[#132019]">
              {report.byEstate.length > 0 ? "2." : "1."} DAFTAR KONDISI UNIT POMPA (
              {report.pumps.length} UNIT)
            </h3>
            <span className="text-[8px] text-[#47554D]">
              Status operasional berdasarkan pemeriksaan terakhir
            </span>
          </div>

          {report.pumps.length === 0 ? (
            <p className="rounded border border-[#D5DDD7] bg-[#F8FAF8] px-3 py-2 text-[9px] text-[#47554D]">
              Tidak ada unit pompa yang sesuai dengan filter laporan saat ini.
            </p>
          ) : (
            <div className="overflow-hidden rounded border border-[#B8C4BC] bg-white">
              <table className="print-table w-full table-fixed border-collapse text-left text-[8.5px] leading-tight">
                <thead>
                  <tr className="border-b border-[#B8C4BC] bg-[#EEF2EF] text-[8px] font-bold text-[#132019]">
                    <th className="w-[7mm] px-1 py-1 text-center">No</th>
                    <th className="w-[25mm] px-1.5 py-1">Kode Pompa</th>
                    <th className="w-[32mm] px-1.5 py-1">Estate / Block</th>
                    <th className="w-[34mm] px-1.5 py-1">Tipe &amp; Mesin</th>
                    <th className="w-[28mm] px-1.5 py-1 text-center">Status Unit</th>
                    <th className="w-[13mm] px-1.5 py-1 text-right">Temuan</th>
                    <th className="px-1.5 py-1">Inspeksi Terakhir</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E4EAE5]">
                  {report.pumps.map((p, idx) => {
                    const statusBadge = formatUnitStatusBadge(p.currentUnitStatus);
                    return (
                      <tr key={p.id} className={statusBadge.rowClass}>
                        <td className="px-1 py-[3px] text-center font-mono tabular-nums text-[#47554D]">
                          {idx + 1}
                        </td>
                        <td className="break-words px-1.5 py-[3px] font-mono font-bold text-[#132019]">
                          {p.pumpCode}
                        </td>
                        <td className="px-1.5 py-[3px]">
                          <p className="font-mono font-semibold text-[#132019]">
                            {p.estateCode} / {p.blockCode}
                          </p>
                          <p className="truncate text-[7.5px] text-[#47554D]">{p.regionName}</p>
                        </td>
                        <td className="px-1.5 py-[3px]">
                          <p className="truncate font-medium text-[#132019]">{p.pumpTypeName}</p>
                          <p className="truncate text-[7.5px] text-[#47554D]">
                            {p.engineBrandName}
                          </p>
                        </td>
                        <td className="px-1 py-[3px] text-center">
                          <span
                            className={`inline-block rounded border px-1.5 py-[1px] text-[7.5px] whitespace-nowrap ${statusBadge.badgeClass}`}
                          >
                            {statusBadge.label}
                          </span>
                        </td>
                        <td className="px-1.5 py-[3px] text-right font-mono font-semibold tabular-nums text-[#132019]">
                          {p.issueCount}
                        </td>
                        <td className="px-1.5 py-[3px]">
                          {p.latestInspectedDate ? (
                            <>
                              <p className="font-mono tabular-nums text-[#132019]">
                                {p.latestInspectedDate}
                              </p>
                              <p className="truncate text-[7.5px] text-[#47554D]">
                                {p.latestInspectorName || "-"}
                              </p>
                            </>
                          ) : (
                            <span className="text-[#47554D]">Belum diperiksa</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}

      {/* Section 3: Damaged & Missing Parts */}
      {showIssues && (
        <section
          className={`mt-3 ${
            scope === "all" && pageBreakBeforeIssues ? "print-break-before" : ""
          }`}
        >
          <div className="print-avoid-break mb-1 flex items-baseline justify-between">
            <h3 className="text-[10px] font-bold text-[#132019]">
              {scope === "issues"
                ? `1. DAFTAR KOMPONEN BERMASALAH & HILANG (${report.issues.length} ITEM)`
                : `${report.byEstate.length > 0 ? "3." : "2."} DAFTAR KOMPONEN BERMASALAH & HILANG (${report.issues.length} ITEM)`}
            </h3>
            <span className="text-[8px] text-[#47554D]">
              Komponen dengan status kurang, hilang, atau rusak pada pemeriksaan terakhir
            </span>
          </div>

          {report.issues.length === 0 ? (
            <p className="rounded border border-[#D5DDD7] bg-[#F8FAF8] px-3 py-2 text-[9px] text-[#47554D]">
              Seluruh komponen pada unit yang tersaring tercatat Ada dan dalam kondisi Baik.
            </p>
          ) : (
            <div className="overflow-hidden rounded border border-[#B8C4BC] bg-white">
              <table className="print-table w-full table-fixed border-collapse text-left text-[8.5px] leading-tight">
                <thead>
                  <tr className="border-b border-[#B8C4BC] bg-[#EEF2EF] text-[8px] font-bold text-[#132019]">
                    <th className="w-[7mm] px-1 py-1 text-center">No</th>
                    <th className="w-[27mm] px-1.5 py-1">Unit &amp; Lokasi</th>
                    <th className="w-[47mm] px-1.5 py-1">Bagian &amp; Komponen</th>
                    <th className="w-[9mm] px-1 py-1 text-right">Qty</th>
                    <th className="w-[27mm] px-1.5 py-1 text-center">Status Part</th>
                    <th className="px-1.5 py-1">Temuan &amp; Detail</th>
                    <th className="w-[19mm] px-1.5 py-1 text-right">Tgl Periksa</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E4EAE5]">
                  {report.issues.map((item, idx) => {
                    const partStatus = formatPartStatus(item.availability, item.condition);
                    return (
                      <tr key={item.id} className="bg-white">
                        <td className="px-1 py-[3px] text-center font-mono tabular-nums text-[#47554D]">
                          {idx + 1}
                        </td>
                        <td className="px-1.5 py-[3px]">
                          <p className="break-words font-mono font-bold text-[#132019]">
                            {item.pumpCode}
                          </p>
                          <p className="font-mono text-[7.5px] text-[#47554D]">
                            {item.estateCode} / {item.blockCode}
                          </p>
                        </td>
                        <td className="px-1.5 py-[3px]">
                          <p className="font-semibold text-[#132019]">{item.partName}</p>
                          <p className="truncate text-[7.5px] text-[#47554D]">
                            {item.sectionName}
                          </p>
                        </td>
                        <td className="px-1 py-[3px] text-right font-mono tabular-nums text-[#132019]">
                          {item.expectedQty}
                        </td>
                        <td className="px-1 py-[3px] text-center">
                          <span
                            className={`inline-block rounded border px-1.5 py-[1px] text-[7.5px] whitespace-nowrap ${partStatus.badgeClass}`}
                          >
                            {partStatus.label}
                          </span>
                          <p className="mt-0.5 text-[7px] text-[#47554D]">{partStatus.detail}</p>
                        </td>
                        <td className="break-words px-1.5 py-[3px] text-[#132019]">
                          <span>{item.issueLabel}</span>
                          {item.notes ? (
                            <span className="text-[#47554D]"> ({item.notes})</span>
                          ) : null}
                        </td>
                        <td className="px-1.5 py-[3px] text-right font-mono tabular-nums text-[#47554D]">
                          {item.inspectedAt || "-"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}

      {/* Compact Closing Metadata Footer (No Signature Columns) */}
      <footer className="print-avoid-break mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-[#B8C4BC] pt-2 text-[8px] text-[#47554D]">
        <span>
          Sistem Monitor Kondisi Pompa · {companyTitle}
        </span>
        <span className="font-mono tabular-nums">
          Dicetak: {printedAt} · Oleh: {printedBy}
        </span>
      </footer>
    </article>
  );
}
