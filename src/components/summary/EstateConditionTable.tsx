import React from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { EmptyState } from "@/components/UiStates";
import {
  ConditionCounts,
  RegionBreakdownGroup,
  formatReadinessPercent,
} from "@/lib/summary-breakdown";

interface EstateConditionTableProps {
  byRegion: RegionBreakdownGroup[];
  grandTotal: ConditionCounts;
}

function ReadinessText({ aktif, total }: { aktif: number; total: number }) {
  const pct = formatReadinessPercent(aktif, total);
  const colorClass =
    pct >= 75 ? "text-[#166534]" : pct >= 40 ? "text-[#92400E]" : "text-[#991B1B]";
  return (
    <span className={`font-mono font-semibold tabular-nums ${colorClass}`}>
      {pct}%
    </span>
  );
}

export function EstateConditionTable({
  byRegion,
  grandTotal,
}: EstateConditionTableProps) {
  return (
    <section
      aria-label="Rekap kondisi per Estate dan Region"
      className="rounded-lg border border-field-border bg-field-surface"
    >
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-field-border px-4 py-3">
        <div>
          <h2 className="text-base font-bold text-field-ink">
            Kondisi per Estate &amp; Region
          </h2>
          <p className="text-xs text-field-muted">
            Rekap kesiapan unit berdasarkan Estate dengan subtotal per Region dan keseluruhan.
          </p>
        </div>
        <Link
          href="/reports"
          className="inline-flex min-h-[44px] items-center gap-1.5 rounded-md border border-field-border bg-field-bg px-3 text-sm font-semibold text-field-ink transition-colors hover:bg-[#EAEFEA] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-field-accent"
        >
          <span>Buka Laporan Lengkap</span>
          <ArrowRight className="h-4 w-4" aria-hidden="true" />
        </Link>
      </div>

      {byRegion.length === 0 ? (
        <div className="p-4">
          <EmptyState
            title="Belum ada pompa pada filter ini"
            description="Ubah pilihan PT, Region, Estate, atau tambahkan unit pompa melalui menu Admin."
          />
        </div>
      ) : (
        <>
          {/* Desktop / Tablet View */}
          <div className="hidden overflow-x-auto md:block">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead className="border-b border-field-border bg-field-bg text-xs font-semibold text-field-muted">
                <tr>
                  <th scope="col" className="px-4 py-3">Estate</th>
                  <th scope="col" className="px-4 py-3">Region</th>
                  <th scope="col" className="px-4 py-3 text-right">Total</th>
                  <th scope="col" className="px-4 py-3 text-right">Aktif</th>
                  <th scope="col" className="px-4 py-3 text-right">Perbaikan</th>
                  <th scope="col" className="px-4 py-3 text-right">Rusak</th>
                  <th scope="col" className="px-4 py-3 text-right">Kesiapan</th>
                  <th scope="col" className="px-4 py-3 text-right">Part Bermasalah</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-field-border">
                {byRegion.map((region) => (
                  <React.Fragment key={`${region.regionId}-${region.regionName}`}>
                    {region.estates.map((row) => (
                      <tr key={row.estateId} className="hover:bg-field-bg/60">
                        <td className="px-4 py-3 font-mono font-semibold text-field-ink">
                          {row.estateCode}
                        </td>
                        <td className="px-4 py-3 text-field-muted">{row.regionName}</td>
                        <td className="px-4 py-3 text-right font-mono tabular-nums text-field-ink">
                          {row.total}
                        </td>
                        <td className="px-4 py-3 text-right font-mono font-semibold tabular-nums text-[#166534]">
                          {row.aktif}
                        </td>
                        <td className="px-4 py-3 text-right font-mono font-semibold tabular-nums text-[#92400E]">
                          {row.perluPerbaikan}
                        </td>
                        <td className="px-4 py-3 text-right font-mono font-semibold tabular-nums text-[#991B1B]">
                          {row.rusakTotal}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <ReadinessText aktif={row.aktif} total={row.total} />
                        </td>
                        <td className="px-4 py-3 text-right font-mono tabular-nums text-field-ink">
                          {row.issueCount}
                        </td>
                      </tr>
                    ))}
                    <tr className="bg-[#F1F5F2] font-semibold text-field-ink">
                      <th scope="row" colSpan={2} className="px-4 py-2.5 text-left text-xs font-bold">
                        <span>Total {region.regionName}</span>
                        <span className="ml-2 font-normal text-field-muted">
                          ({region.estates.length} Estate)
                        </span>
                      </th>
                      <td className="px-4 py-2.5 text-right font-mono tabular-nums">
                        {region.subtotal.total}
                      </td>
                      <td className="px-4 py-2.5 text-right font-mono tabular-nums text-[#166534]">
                        {region.subtotal.aktif}
                      </td>
                      <td className="px-4 py-2.5 text-right font-mono tabular-nums text-[#92400E]">
                        {region.subtotal.perluPerbaikan}
                      </td>
                      <td className="px-4 py-2.5 text-right font-mono tabular-nums text-[#991B1B]">
                        {region.subtotal.rusakTotal}
                      </td>
                      <td className="px-4 py-2.5 text-right">
                        <ReadinessText
                          aktif={region.subtotal.aktif}
                          total={region.subtotal.total}
                        />
                      </td>
                      <td className="px-4 py-2.5 text-right font-mono tabular-nums">
                        {region.subtotal.issueCount}
                      </td>
                    </tr>
                  </React.Fragment>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-field-border bg-[#EEF2EF] font-bold text-field-ink">
                  <th scope="row" colSpan={2} className="px-4 py-3 text-left">
                    Total Keseluruhan (All)
                  </th>
                  <td className="px-4 py-3 text-right font-mono tabular-nums">
                    {grandTotal.total}
                  </td>
                  <td className="px-4 py-3 text-right font-mono tabular-nums text-[#166534]">
                    {grandTotal.aktif}
                  </td>
                  <td className="px-4 py-3 text-right font-mono tabular-nums text-[#92400E]">
                    {grandTotal.perluPerbaikan}
                  </td>
                  <td className="px-4 py-3 text-right font-mono tabular-nums text-[#991B1B]">
                    {grandTotal.rusakTotal}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <ReadinessText aktif={grandTotal.aktif} total={grandTotal.total} />
                  </td>
                  <td className="px-4 py-3 text-right font-mono tabular-nums">
                    {grandTotal.issueCount}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>

          {/* Mobile Reflow View */}
          <div className="divide-y divide-field-border md:hidden">
            {byRegion.map((region) => (
              <div key={`${region.regionId}-${region.regionName}`} className="p-3 space-y-2.5">
                <div className="rounded-md border border-field-border bg-[#F1F5F2] p-3">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-xs font-bold text-field-ink">
                      Total {region.regionName}
                    </p>
                    <p className="text-xs text-field-muted">
                      Siap:{" "}
                      <ReadinessText
                        aktif={region.subtotal.aktif}
                        total={region.subtotal.total}
                      />
                    </p>
                  </div>
                  <div className="mt-2 grid grid-cols-5 gap-1.5 text-center text-[11px]">
                    <div className="rounded bg-white px-1 py-1.5">
                      <span className="block text-field-muted">Total</span>
                      <span className="font-mono font-bold tabular-nums text-field-ink">
                        {region.subtotal.total}
                      </span>
                    </div>
                    <div className="rounded bg-[#DCFCE7] px-1 py-1.5 text-[#166534]">
                      <span className="block">Aktif</span>
                      <span className="font-mono font-bold tabular-nums">
                        {region.subtotal.aktif}
                      </span>
                    </div>
                    <div className="rounded bg-[#FEF3C7] px-1 py-1.5 text-[#92400E]">
                      <span className="block">Perb.</span>
                      <span className="font-mono font-bold tabular-nums">
                        {region.subtotal.perluPerbaikan}
                      </span>
                    </div>
                    <div className="rounded bg-[#FEE2E2] px-1 py-1.5 text-[#991B1B]">
                      <span className="block">Rusak</span>
                      <span className="font-mono font-bold tabular-nums">
                        {region.subtotal.rusakTotal}
                      </span>
                    </div>
                    <div className="rounded bg-white px-1 py-1.5">
                      <span className="block text-field-muted">Part</span>
                      <span className="font-mono font-bold tabular-nums text-field-ink">
                        {region.subtotal.issueCount}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="divide-y divide-field-border rounded-md border border-field-border bg-white">
                  {region.estates.map((est) => (
                    <div key={est.estateId} className="px-3 py-2.5">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-mono text-sm font-bold text-field-ink">
                          {est.estateCode}
                        </span>
                        <span className="text-xs text-field-muted">
                          {est.issueCount} part bermasalah ·{" "}
                          <ReadinessText aktif={est.aktif} total={est.total} />
                        </span>
                      </div>
                      <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
                        <span className="text-field-muted">
                          Total:{" "}
                          <strong className="font-mono tabular-nums text-field-ink">
                            {est.total}
                          </strong>
                        </span>
                        <span className="text-[#166534]">
                          Aktif:{" "}
                          <strong className="font-mono tabular-nums">{est.aktif}</strong>
                        </span>
                        <span className="text-[#92400E]">
                          Perbaikan:{" "}
                          <strong className="font-mono tabular-nums">
                            {est.perluPerbaikan}
                          </strong>
                        </span>
                        <span className="text-[#991B1B]">
                          Rusak:{" "}
                          <strong className="font-mono tabular-nums">
                            {est.rusakTotal}
                          </strong>
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}

            <div className="bg-[#EEF2EF] p-3">
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-bold text-field-ink">
                  Total Keseluruhan (All)
                </p>
                <p className="text-xs text-field-muted">
                  Kesiapan:{" "}
                  <ReadinessText aktif={grandTotal.aktif} total={grandTotal.total} />
                </p>
              </div>
              <div className="mt-2 grid grid-cols-5 gap-1.5 text-center text-[11px]">
                <div className="rounded bg-white px-1 py-1.5">
                  <span className="block text-field-muted">Total</span>
                  <span className="font-mono font-bold tabular-nums text-field-ink">
                    {grandTotal.total}
                  </span>
                </div>
                <div className="rounded bg-[#DCFCE7] px-1 py-1.5 text-[#166534]">
                  <span className="block">Aktif</span>
                  <span className="font-mono font-bold tabular-nums">
                    {grandTotal.aktif}
                  </span>
                </div>
                <div className="rounded bg-[#FEF3C7] px-1 py-1.5 text-[#92400E]">
                  <span className="block">Perb.</span>
                  <span className="font-mono font-bold tabular-nums">
                    {grandTotal.perluPerbaikan}
                  </span>
                </div>
                <div className="rounded bg-[#FEE2E2] px-1 py-1.5 text-[#991B1B]">
                  <span className="block">Rusak</span>
                  <span className="font-mono font-bold tabular-nums">
                    {grandTotal.rusakTotal}
                  </span>
                </div>
                <div className="rounded bg-white px-1 py-1.5">
                  <span className="block text-field-muted">Part</span>
                  <span className="font-mono font-bold tabular-nums text-field-ink">
                    {grandTotal.issueCount}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </section>
  );
}
