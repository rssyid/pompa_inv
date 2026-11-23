import React from "react";
import { OPERATIONAL_CATEGORY_OPTIONS } from "@/lib/pump-location";
import type { OperatingHoursMonitoringPayload } from "@/lib/queries/operating-hours";

const CATEGORY_CLASS_MAP = new Map(
  OPERATIONAL_CATEGORY_OPTIONS.map((opt) => [
    opt.value,
    `${opt.bgClass} ${opt.textClass}`,
  ])
);

function computeKebunRowSpans(
  pumps: OperatingHoursMonitoringPayload["regions"][number]["pumps"]
): number[] {
  const spans = new Array<number>(pumps.length).fill(0);
  let i = 0;
  while (i < pumps.length) {
    const key = pumps[i].estateName || pumps[i].estateCode;
    let j = i + 1;
    while (j < pumps.length && (pumps[j].estateName || pumps[j].estateCode) === key) {
      j += 1;
    }
    spans[i] = j - i;
    i = j;
  }
  return spans;
}

export function OperatingHoursPrintReport({
  report,
  companyTitle,
  forceShow = false,
  screenInteractive = false,
}: {
  report: OperatingHoursMonitoringPayload;
  companyTitle: string;
  forceShow?: boolean;
  screenInteractive?: boolean;
}) {
  const dateColCount = Math.max(1, report.dates.length);
  const totalSummarySpan = 6 + dateColCount;

  const wrapperClass = screenInteractive
    ? "overflow-x-auto rounded-lg border border-field-border bg-white text-[#132019]"
    : forceShow
      ? "print-landscape-page mx-auto w-[297mm] min-h-[210mm] rounded border border-[#B8C4BC] bg-white p-[8mm] text-[#132019] shadow-sm print:min-h-0 print:w-full print:max-w-none print:rounded-none print:border-0 print:p-0 print:shadow-none"
      : "print-landscape-page hidden print:block bg-white text-[#132019]";

  return (
    <article
      aria-label="Tabel monitoring jam operasional pompa"
      className={wrapperClass}
    >
      <div className={screenInteractive ? "p-3 sm:p-4" : "mb-2"}>
        <h2 className="text-sm font-bold tracking-tight text-[#132019] sm:text-base">
          MONITORING POMPA {companyTitle.toUpperCase()}
        </h2>
        <p className="mt-0.5 text-xs font-semibold text-[#47554D]">
          Update : {report.updateDate}
        </p>
      </div>

      <table
        className={`print-table w-full border-collapse border border-[#47554D] ${
          screenInteractive ? "min-w-[980px] text-[11px]" : "text-[9px]"
        }`}
      >
        <thead>
          <tr className="bg-[#D9E1D9] text-[#132019]">
            <th
              rowSpan={3}
              className="border border-[#47554D] px-2 py-1.5 text-center font-bold"
            >
              Kebun
            </th>
            <th
              colSpan={5}
              className="border border-[#47554D] px-2 py-1 text-center font-bold"
            >
              Pompa
            </th>
            <th
              colSpan={dateColCount}
              className="border border-[#47554D] px-2 py-1 text-center font-bold"
            >
              Jam Operasional
            </th>
            <th
              rowSpan={3}
              className="border border-[#47554D] px-2 py-1.5 text-center font-bold"
            >
              Total Jam/Bln
            </th>
            <th
              rowSpan={3}
              className="border border-[#47554D] px-2 py-1.5 text-center font-bold"
            >
              Keterangan
            </th>
            <th
              rowSpan={3}
              className="border border-[#47554D] px-2 py-1.5 text-center font-bold"
            >
              Status
            </th>
          </tr>
          <tr className="bg-[#E5EBE5] text-[#132019]">
            <th rowSpan={2} className="border border-[#47554D] px-1.5 py-1 text-center font-bold">
              No
            </th>
            <th rowSpan={2} className="border border-[#47554D] px-2 py-1 text-center font-bold">
              Type
            </th>
            <th rowSpan={2} className="border border-[#47554D] px-2 py-1 text-center font-bold">
              Posisi pompa
            </th>
            <th rowSpan={2} className="border border-[#47554D] px-2 py-1 text-center font-bold">
              Kode
            </th>
            <th rowSpan={2} className="border border-[#47554D] px-2 py-1 text-center font-bold">
              Kondisi
            </th>
            <th
              colSpan={dateColCount}
              className="border border-[#47554D] px-2 py-1 text-center font-bold"
            >
              {report.monthName}
            </th>
          </tr>
          <tr className="bg-[#EEF2EF] text-[#132019]">
            {report.dates.length === 0 ? (
              <th className="border border-[#47554D] px-1.5 py-1 text-center font-mono">-</th>
            ) : (
              report.dates.map((col) => (
                <th
                  key={col.date}
                  title={col.date}
                  className={`border border-[#47554D] px-1.5 py-1 text-center font-mono font-bold tabular-nums ${
                    col.isSunday ? "bg-[#FEE2E2] text-[#DC2626]" : "text-[#132019]"
                  }`}
                >
                  {col.day}
                </th>
              ))
            )}
          </tr>
        </thead>

        <tbody>
          {report.regions.map((group) => {
            const spans = computeKebunRowSpans(group.pumps);

            return (
              <React.Fragment key={group.regionName}>
                <tr className="bg-[#EAEFEA]">
                  <td
                    colSpan={totalSummarySpan + 3}
                    className="border border-[#47554D] px-2.5 py-1.5 font-bold text-[#132019]"
                  >
                    {group.regionName}
                  </td>
                </tr>

                {group.pumps.map((p, idx) => {
                  const kebunSpan = spans[idx];
                  const noteColorCls =
                    CATEGORY_CLASS_MAP.get(
                      p.operationalCategory as (typeof OPERATIONAL_CATEGORY_OPTIONS)[number]["value"]
                    ) || "bg-white text-[#132019]";
                  const fullPreOrder =
                    p.isPreOrder &&
                    report.dates.length > 0 &&
                    p.cells.every((c) => c.type === "pre_order");

                  return (
                    <tr key={p.pumpId} className="bg-white">
                      {kebunSpan > 0 && (
                        <td
                          rowSpan={kebunSpan}
                          className="border border-[#47554D] bg-white px-2 py-1 text-center font-bold text-[#132019]"
                        >
                          {p.estateName || p.estateCode}
                        </td>
                      )}
                      <td className="border border-[#47554D] px-1.5 py-1 text-center font-mono tabular-nums">
                        {p.no}
                      </td>
                      <td className="whitespace-nowrap border border-[#47554D] px-2 py-1 font-bold">
                        {p.pumpTypeShort}
                      </td>
                      <td className="whitespace-nowrap border border-[#47554D] px-2 py-1 text-center font-mono font-bold">
                        {p.blockCode}
                      </td>
                      <td className="whitespace-nowrap border border-[#47554D] px-2 py-1 font-mono font-bold">
                        {p.pumpCode}
                      </td>
                      <td
                        className={`border border-[#47554D] px-2 py-1 text-center font-semibold ${
                          p.kondisi === "Baik"
                            ? "bg-[#DCFCE7] text-[#166534]"
                            : "bg-[#FEE2E2] text-[#991B1B]"
                        }`}
                      >
                        {p.kondisi}
                      </td>

                      {fullPreOrder ? (
                        <td
                          colSpan={dateColCount}
                          className="border border-[#47554D] bg-[#FFFBEB] px-2 py-1 text-center font-bold tracking-wide text-[#92400E]"
                        >
                          PRE ORDER
                        </td>
                      ) : report.dates.length === 0 ? (
                        <td className="border border-[#47554D] px-1.5 py-1 text-center">-</td>
                      ) : (
                        p.cells.map((cell) => {
                          if (cell.type === "rusak") {
                            return (
                              <td
                                key={cell.date}
                                className="border border-[#47554D] bg-[#DC2626] px-1 py-1 text-center font-mono font-bold tabular-nums text-white"
                              >
                                {cell.value}
                              </td>
                            );
                          }
                          if (cell.type === "hours") {
                            return (
                              <td
                                key={cell.date}
                                className="border border-[#47554D] bg-white px-1 py-1 text-center font-mono font-bold tabular-nums text-[#132019]"
                              >
                                {cell.value}
                              </td>
                            );
                          }
                          if (cell.type === "pre_order") {
                            return (
                              <td
                                key={cell.date}
                                className="border border-[#47554D] bg-[#FEF3C7] px-1 py-1 text-center font-bold text-[#92400E]"
                              >
                                PO
                              </td>
                            );
                          }
                          return (
                            <td
                              key={cell.date}
                              className="border border-[#47554D] px-1 py-1 text-center font-mono text-[#47554D]"
                            >
                              -
                            </td>
                          );
                        })
                      )}

                      <td className="border border-[#47554D] px-2 py-1 text-center font-mono font-bold tabular-nums text-[#132019]">
                        {p.totalHoursMonth > 0 ? p.totalHoursMonth : "-"}
                      </td>
                      <td className={`border border-[#47554D] px-2 py-1 ${noteColorCls}`}>
                        {p.operationalNote}
                      </td>
                      <td
                        className={`border border-[#47554D] px-2 py-1 ${
                          p.repairStatus
                            ? "bg-[#E0F2FE] font-semibold text-[#075985]"
                            : "bg-white"
                        }`}
                      >
                        {p.repairStatus}
                      </td>
                    </tr>
                  );
                })}

                <tr className="bg-[#F3F4F6] font-bold text-[#132019]">
                  <td
                    colSpan={totalSummarySpan}
                    className="border border-[#47554D] px-3 py-1.5 text-center"
                  >
                    TOTAL JAM/WP SAAT INI
                  </td>
                  <td className="border border-[#47554D] px-2 py-1.5 text-center font-mono tabular-nums">
                    {group.regionTotalHoursMonth}
                  </td>
                  <td colSpan={2} className="border border-[#47554D]" />
                </tr>
              </React.Fragment>
            );
          })}

          {report.regions.length > 0 && (
            <tr className="bg-[#E2E8F0] font-bold text-[#132019]">
              <td
                colSpan={totalSummarySpan}
                className="border border-[#47554D] px-3 py-1.5 text-center"
              >
                TOTAL JAM/WP KESELURUHAN
              </td>
              <td className="border border-[#47554D] px-2 py-1.5 text-center font-mono tabular-nums">
                {report.grandTotalHoursMonth}
              </td>
              <td colSpan={2} className="border border-[#47554D]" />
            </tr>
          )}
        </tbody>
      </table>
    </article>
  );
}
