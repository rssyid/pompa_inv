import React from "react";
import { EmptyState } from "@/components/UiStates";
import {
  ConditionCounts,
  ConditionCountsWithTypes,
  PumpTypeColumn,
  RegionBreakdownGroup,
} from "@/lib/summary-breakdown";

interface PumpTypeBreakdownTableProps {
  byRegion: RegionBreakdownGroup[];
  pumpTypeColumns: PumpTypeColumn[];
  grandTotal: ConditionCountsWithTypes;
}

function buildCellAriaLabel(scopeLabel: string, counts: ConditionCounts): string {
  if (counts.total === 0) return `${scopeLabel}: 0 unit`;
  return `${scopeLabel}: ${counts.total} unit (${counts.aktif} Aktif, ${counts.perluPerbaikan} Perlu Perbaikan, ${counts.rusakTotal} Rusak Total)`;
}

function StatusCompactLine({ counts }: { counts: ConditionCounts }) {
  const tokens: Array<{ key: string; label: string; className: string }> = [];
  if (counts.aktif > 0) {
    tokens.push({ key: "a", label: `${counts.aktif}A`, className: "text-[#166534]" });
  }
  if (counts.perluPerbaikan > 0) {
    tokens.push({
      key: "p",
      label: `${counts.perluPerbaikan}P`,
      className: "text-[#92400E]",
    });
  }
  if (counts.rusakTotal > 0) {
    tokens.push({
      key: "r",
      label: `${counts.rusakTotal}R`,
      className: "text-[#991B1B]",
    });
  }

  return (
    <span className="mt-0.5 block font-mono text-[11px] font-semibold tabular-nums">
      {tokens.map((token, index) => (
        <React.Fragment key={token.key}>
          {index > 0 && <span className="text-field-muted"> · </span>}
          <span className={token.className}>{token.label}</span>
        </React.Fragment>
      ))}
    </span>
  );
}

function MatrixCell({
  counts,
  scopeLabel,
  emphasizeZero = false,
}: {
  counts: ConditionCounts | undefined;
  scopeLabel: string;
  emphasizeZero?: boolean;
}) {
  const safeCounts: ConditionCounts = counts ?? {
    total: 0,
    aktif: 0,
    perluPerbaikan: 0,
    rusakTotal: 0,
    issueCount: 0,
  };
  const ariaLabel = buildCellAriaLabel(scopeLabel, safeCounts);

  if (safeCounts.total === 0) {
    return (
      <span
        className={`font-mono text-xs tabular-nums ${
          emphasizeZero ? "font-semibold text-field-muted" : "text-field-muted"
        }`}
        title={ariaLabel}
        aria-label={ariaLabel}
      >
        -
      </span>
    );
  }

  return (
    <div title={ariaLabel} aria-label={ariaLabel}>
      <span className="block font-mono text-sm font-bold tabular-nums text-field-ink">
        {safeCounts.total}
      </span>
      <StatusCompactLine counts={safeCounts} />
    </div>
  );
}

function MobilePumpTypeGrid({
  columns,
  byPumpType,
}: {
  columns: PumpTypeColumn[];
  byPumpType: Record<number, ConditionCounts>;
}) {
  return (
    <div className="grid grid-cols-2 gap-2">
      {columns.map((col) => {
        const counts = byPumpType[col.id] ?? {
          total: 0,
          aktif: 0,
          perluPerbaikan: 0,
          rusakTotal: 0,
          issueCount: 0,
        };
        return (
          <div
            key={col.id}
            className="rounded border border-field-border bg-white px-2.5 py-2"
            aria-label={buildCellAriaLabel(col.name, counts)}
          >
            <p className="truncate text-[11px] font-semibold text-field-muted">
              {col.name}
            </p>
            {counts.total === 0 ? (
              <p className="mt-0.5 font-mono text-xs text-field-muted">0 unit</p>
            ) : (
              <div className="mt-0.5 flex items-baseline justify-between gap-1">
                <span className="font-mono text-sm font-bold tabular-nums text-field-ink">
                  {counts.total}
                </span>
                <StatusCompactLine counts={counts} />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

export function PumpTypeBreakdownTable({
  byRegion,
  pumpTypeColumns,
  grandTotal,
}: PumpTypeBreakdownTableProps) {
  return (
    <section
      aria-label="Breakdown tipe pompa per Estate dan Region"
      className="rounded-lg border border-field-border bg-field-surface"
    >
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-field-border px-4 py-3">
        <div>
          <h2 className="text-base font-bold text-field-ink">
            Breakdown Tipe Pompa per Estate
          </h2>
          <p className="text-xs text-field-muted">
            Sebaran jumlah unit dan status kondisi tiap jenis pompa per Estate, Region, dan keseluruhan.
          </p>
        </div>

        <div
          aria-label="Legenda singkatan status kondisi"
          className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-md border border-field-border bg-field-bg px-3 py-1.5 text-xs"
        >
          <span className="font-semibold text-[#166534]">A = Aktif</span>
          <span className="text-field-muted" aria-hidden="true">·</span>
          <span className="font-semibold text-[#92400E]">P = Perlu Perbaikan</span>
          <span className="text-field-muted" aria-hidden="true">·</span>
          <span className="font-semibold text-[#991B1B]">R = Rusak Total</span>
        </div>
      </div>

      {byRegion.length === 0 || pumpTypeColumns.length === 0 ? (
        <div className="p-4">
          <EmptyState
            title="Belum ada data tipe pompa pada filter ini"
            description="Ubah pilihan PT, Region, Estate, atau Jenis Pompa untuk melihat breakdown."
          />
        </div>
      ) : (
        <>
          {/* Desktop / Tablet Matrix */}
          <div className="hidden overflow-x-auto md:block">
            <table className="w-full min-w-[680px] text-left text-sm">
              <thead className="border-b border-field-border bg-field-bg text-xs font-semibold text-field-muted">
                <tr>
                  <th scope="col" className="min-w-[170px] px-4 py-3">
                    Estate / Region
                  </th>
                  {pumpTypeColumns.map((col) => (
                    <th key={col.id} scope="col" className="min-w-[115px] px-3 py-3 text-right">
                      {col.name}
                    </th>
                  ))}
                  <th
                    scope="col"
                    className="min-w-[120px] border-l border-field-border bg-[#EEF2EF]/60 px-4 py-3 text-right text-field-ink"
                  >
                    Total Unit
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-field-border">
                {byRegion.map((region) => (
                  <React.Fragment key={`${region.regionId}-${region.regionName}`}>
                    {region.estates.map((est) => (
                      <tr key={est.estateId} className="hover:bg-field-bg/60">
                        <td className="px-4 py-2.5">
                          <span className="block font-mono font-semibold text-field-ink">
                            {est.estateCode}
                          </span>
                          <span className="block text-[11px] text-field-muted">
                            {est.regionName}
                          </span>
                        </td>
                        {pumpTypeColumns.map((col) => (
                          <td key={col.id} className="px-3 py-2.5 text-right align-middle">
                            <MatrixCell
                              counts={est.byPumpType[col.id]}
                              scopeLabel={`${est.estateCode} - ${col.name}`}
                            />
                          </td>
                        ))}
                        <td className="border-l border-field-border bg-[#F8FAF8] px-4 py-2.5 text-right align-middle">
                          <MatrixCell
                            counts={est}
                            scopeLabel={`Total ${est.estateCode}`}
                          />
                        </td>
                      </tr>
                    ))}

                    <tr className="bg-[#F1F5F2] font-semibold text-field-ink">
                      <th scope="row" className="px-4 py-2.5 text-left text-xs font-bold">
                        <span>Total {region.regionName}</span>
                        <span className="mt-0.5 block font-normal text-field-muted">
                          {region.estates.length} Estate
                        </span>
                      </th>
                      {pumpTypeColumns.map((col) => (
                        <td key={col.id} className="px-3 py-2.5 text-right align-middle">
                          <MatrixCell
                            counts={region.subtotal.byPumpType[col.id]}
                            scopeLabel={`Total ${region.regionName} - ${col.name}`}
                            emphasizeZero
                          />
                        </td>
                      ))}
                      <td className="border-l border-field-border bg-[#E7EDE8] px-4 py-2.5 text-right align-middle">
                        <MatrixCell
                          counts={region.subtotal}
                          scopeLabel={`Total ${region.regionName}`}
                        />
                      </td>
                    </tr>
                  </React.Fragment>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-field-border bg-[#EEF2EF] font-bold text-field-ink">
                  <th scope="row" className="px-4 py-3 text-left">
                    Total Keseluruhan (All)
                  </th>
                  {pumpTypeColumns.map((col) => (
                    <td key={col.id} className="px-3 py-3 text-right align-middle">
                      <MatrixCell
                        counts={grandTotal.byPumpType[col.id]}
                        scopeLabel={`Total All - ${col.name}`}
                        emphasizeZero
                      />
                    </td>
                  ))}
                  <td className="border-l border-field-border bg-[#E3EAE5] px-4 py-3 text-right align-middle">
                    <MatrixCell
                      counts={grandTotal}
                      scopeLabel="Total Keseluruhan (All)"
                    />
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>

          {/* Mobile Reflow View */}
          <div className="divide-y divide-field-border md:hidden">
            {byRegion.map((region) => (
              <div key={`${region.regionId}-${region.regionName}`} className="p-3 space-y-2.5">
                <div className="rounded-md border border-field-border bg-[#F1F5F2] p-3 space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-xs font-bold text-field-ink">
                      Total {region.regionName}
                    </p>
                    <span className="font-mono text-xs font-bold tabular-nums text-field-ink">
                      {region.subtotal.total} unit
                    </span>
                  </div>
                  <MobilePumpTypeGrid
                    columns={pumpTypeColumns}
                    byPumpType={region.subtotal.byPumpType}
                  />
                </div>

                <div className="divide-y divide-field-border rounded-md border border-field-border bg-white">
                  {region.estates.map((est) => {
                    const nonEmptyCols = pumpTypeColumns.filter(
                      (col) => (est.byPumpType[col.id]?.total ?? 0) > 0
                    );
                    return (
                      <div key={est.estateId} className="px-3 py-2.5">
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-mono text-sm font-bold text-field-ink">
                            {est.estateCode}
                          </span>
                          <span className="font-mono text-xs font-semibold tabular-nums text-field-muted">
                            Total: {est.total} unit
                          </span>
                        </div>
                        {nonEmptyCols.length === 0 ? (
                          <p className="mt-1 text-xs text-field-muted">Tidak ada unit.</p>
                        ) : (
                          <div className="mt-2 grid grid-cols-2 gap-1.5">
                            {nonEmptyCols.map((col) => {
                              const counts = est.byPumpType[col.id];
                              return (
                                <div
                                  key={col.id}
                                  className="rounded border border-field-border/70 bg-field-bg px-2 py-1.5"
                                >
                                  <span className="block truncate text-[11px] font-medium text-field-muted">
                                    {col.name}
                                  </span>
                                  <div className="mt-0.5 flex items-baseline justify-between gap-1">
                                    <span className="font-mono text-xs font-bold tabular-nums text-field-ink">
                                      {counts.total}
                                    </span>
                                    <StatusCompactLine counts={counts} />
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}

            <div className="bg-[#EEF2EF] p-3 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-bold text-field-ink">
                  Total Keseluruhan (All)
                </p>
                <span className="font-mono text-sm font-bold tabular-nums text-field-ink">
                  {grandTotal.total} unit
                </span>
              </div>
              <MobilePumpTypeGrid
                columns={pumpTypeColumns}
                byPumpType={grandTotal.byPumpType}
              />
            </div>
          </div>
        </>
      )}
    </section>
  );
}
