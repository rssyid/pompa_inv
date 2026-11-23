import React from "react";

export interface PrintPumpInfo {
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

export interface PrintInspectionItem {
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

export interface PrintInspectionPhoto {
  id: number;
  fileName: string;
  caption: string | null;
}

export interface PrintInspectionRecord {
  id: number;
  inspectorName: string;
  inspectedAt: string;
  unitStatus: string;
  notes: string | null;
  items: PrintInspectionItem[];
  photos: PrintInspectionPhoto[];
}

function formatUnitStatus(status: string): {
  label: string;
  boxClass: string;
} {
  if (status === "aktif") {
    return {
      label: "AKTIF",
      boxClass: "border-[#166534] bg-[#DCFCE7] text-[#166534]",
    };
  }
  if (status === "perlu_perbaikan") {
    return {
      label: "PERLU PERBAIKAN",
      boxClass: "border-[#92400E] bg-[#FEF3C7] text-[#92400E]",
    };
  }
  return {
    label: "RUSAK TOTAL",
    boxClass: "border-[#991B1B] bg-[#FEE2E2] text-[#991B1B]",
  };
}

function formatItemStatus(item: PrintInspectionItem): {
  text: string;
  isProblem: boolean;
  badgeClass: string;
} {
  if (item.availability === "hilang") {
    return {
      text: "✕ Hilang",
      isProblem: true,
      badgeClass: "border-[#FCA5A5] bg-[#FEE2E2] text-[#991B1B] font-bold",
    };
  }
  if (item.availability === "tidak_lengkap") {
    return {
      text: "! Kurang",
      isProblem: true,
      badgeClass: "border-[#FCD34D] bg-[#FEF3C7] text-[#92400E] font-bold",
    };
  }
  if (item.condition === "rusak") {
    return {
      text: "✕ Rusak",
      isProblem: true,
      badgeClass: "border-[#FCA5A5] bg-[#FEE2E2] text-[#991B1B] font-bold",
    };
  }
  return {
    text: "✓ Baik",
    isProblem: false,
    badgeClass: "border-[#CBD5CE] bg-white text-[#166534] font-medium",
  };
}

function formatFindingText(item: PrintInspectionItem): string {
  const parts: string[] = [];
  if (item.issueLabel && item.issueLabel !== "Normal / Baik") {
    parts.push(item.issueLabel);
  }
  if (item.notes?.trim()) {
    parts.push(item.notes.trim());
  }
  return parts.join(" · ") || "-";
}

interface SectionGroup {
  key: string;
  sectionCode: string;
  sectionName: string;
  headerRow: PrintInspectionItem | null;
  rows: PrintInspectionItem[];
}

export function PumpPrintReport({
  pump,
  inspection,
  forceShow = false,
}: {
  pump: PrintPumpInfo;
  inspection: PrintInspectionRecord | null;
  forceShow?: boolean;
}) {
  const unitBadge = formatUnitStatus(inspection?.unitStatus ?? pump.currentUnitStatus);
  const items = inspection?.items ?? [];

  const partRows = items.filter((i) => i.itemNo > 0);
  const issueItems = items.filter(
    (i) => i.availability !== "ada" || i.condition === "rusak"
  );
  const okPartsCount = partRows.filter(
    (i) => i.availability === "ada" && i.condition === "baik"
  ).length;

  // Group items by section and balance columns by row count to fit A4 cleanly.
  const sectionMap = new Map<string, SectionGroup>();
  for (const item of items) {
    const key = `${item.sectionCode}:${item.sectionName}`;
    let grp = sectionMap.get(key);
    if (!grp) {
      grp = {
        key,
        sectionCode: item.sectionCode,
        sectionName: item.sectionName,
        headerRow: null,
        rows: [],
      };
      sectionMap.set(key, grp);
    }
    if (item.itemNo === 0) {
      grp.headerRow = item;
    } else {
      grp.rows.push(item);
    }
  }

  const allSections = Array.from(sectionMap.values());
  const leftSections: SectionGroup[] = [];
  const rightSections: SectionGroup[] = [];
  let leftWeight = 0;
  let rightWeight = 0;

  for (const sec of allSections) {
    const rowWeight = Math.max(1, sec.rows.length) + 2;
    if (leftWeight <= rightWeight) {
      leftSections.push(sec);
      leftWeight += rowWeight;
    } else {
      rightSections.push(sec);
      rightWeight += rowWeight;
    }
  }

  const renderSectionCard = (sec: SectionGroup) => {
    const displayRows = sec.rows.length > 0 ? sec.rows : sec.headerRow ? [sec.headerRow] : [];
    const headerStatus = sec.headerRow && sec.rows.length > 0 ? formatItemStatus(sec.headerRow) : null;

    return (
      <div
        key={sec.key}
        className="print-avoid-break overflow-hidden rounded border border-[#B8C4BC] bg-white"
      >
        <div className="flex items-center justify-between border-b border-[#B8C4BC] bg-[#EEF2EF] px-2 py-1">
          <span className="text-[9.5px] font-bold tracking-tight text-[#132019]">
            {sec.sectionCode}. {sec.sectionName}
          </span>
          {headerStatus && (
            <span
              className={`rounded border px-1.5 py-[1px] text-[8.5px] ${headerStatus.badgeClass}`}
            >
              {headerStatus.text}
            </span>
          )}
        </div>

        <table className="w-full border-collapse text-left text-[9px] leading-tight">
          <thead>
            <tr className="border-b border-[#D5DDD7] bg-[#F8FAF8] text-[8.5px] font-semibold text-[#47554D]">
              <th className="w-6 px-1.5 py-1 text-center">No</th>
              <th className="px-1.5 py-1">Komponen</th>
              <th className="w-7 px-1 py-1 text-center">Qty</th>
              <th className="w-16 px-1.5 py-1 text-center">Status</th>
              <th className="w-24 px-1.5 py-1">Temuan</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#E4EAE5]">
            {displayRows.map((item) => {
              const st = formatItemStatus(item);
              const finding = formatFindingText(item);
              return (
                <tr
                  key={item.id}
                  className={st.isProblem ? "bg-[#FFFBEB]" : "bg-white"}
                >
                  <td className="px-1.5 py-[3px] text-center font-mono text-[8.5px] text-[#47554D]">
                    {item.itemNo === 0 ? item.sectionCode : item.itemNo}
                  </td>
                  <td
                    className={`px-1.5 py-[3px] text-[#132019] ${
                      st.isProblem ? "font-semibold" : ""
                    }`}
                  >
                    {item.partName}
                  </td>
                  <td className="px-1 py-[3px] text-center font-mono tabular-nums text-[#132019]">
                    {item.expectedQty}
                  </td>
                  <td className="px-1 py-[3px] text-center">
                    <span
                      className={`inline-block rounded border px-1 py-[1px] text-[8px] whitespace-nowrap ${st.badgeClass}`}
                    >
                      {st.text}
                    </span>
                  </td>
                  <td className="px-1.5 py-[3px] text-[8.5px] text-[#47554D]">
                    {finding}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    );
  };

  return (
    <article
      aria-label="Format cetak laporan pompa"
      className={
        forceShow
          ? "mx-auto w-full max-w-[210mm] rounded border border-[#B8C4BC] bg-white p-5 text-[#132019] shadow-sm print:max-w-none print:border-0 print:p-0 print:shadow-none"
          : "hidden print:block bg-white text-[#132019]"
      }
    >
      {/* Formal Letterhead */}
      <header className="flex items-start justify-between border-b-2 border-[#132019] pb-2.5">
        <div>
          <p className="text-[10px] font-bold text-[#15803D]">{pump.companyName}</p>
          <h2 className="mt-0.5 text-[15px] font-bold tracking-tight text-[#132019]">
            LAPORAN PEMERIKSAAN KONDISI POMPA
          </h2>
          <p className="text-[10px] text-[#47554D]">
            Tipe Unit: <strong className="text-[#132019]">{pump.pumpTypeName}</strong> · Merek
            Mesin: <strong className="text-[#132019]">{pump.engineBrandName}</strong>
          </p>
        </div>

        <div className="flex items-center gap-3 rounded border border-[#B8C4BC] bg-[#F8FAF8] px-3 py-1.5 text-right">
          <div>
            <p className="text-[8.5px] font-semibold text-[#47554D]">KODE UNIT</p>
            <p className="font-mono text-[13px] font-bold text-[#132019]">{pump.pumpCode}</p>
          </div>
          <div className="h-7 w-px bg-[#CBD5CE]" />
          <div>
            <p className="text-[8.5px] font-semibold text-[#47554D]">STATUS OPERASIONAL</p>
            <span
              className={`mt-0.5 inline-block rounded border px-2 py-0.5 text-[9px] font-bold ${unitBadge.boxClass}`}
            >
              {unitBadge.label}
            </span>
          </div>
        </div>
      </header>

      {/* Compact Identity & Summary Strip */}
      <section className="mt-2.5 grid grid-cols-6 divide-x divide-[#B8C4BC] rounded border border-[#B8C4BC] bg-[#F8FAF8] text-[9.5px]">
        <div className="px-2 py-1.5">
          <p className="text-[8px] font-semibold text-[#47554D]">REGION / WILAYAH</p>
          <p className="mt-0.5 font-semibold text-[#132019]">{pump.regionName}</p>
        </div>
        <div className="px-2 py-1.5">
          <p className="text-[8px] font-semibold text-[#47554D]">ESTATE</p>
          <p className="mt-0.5 font-mono font-bold text-[#132019]">{pump.estateCode}</p>
        </div>
        <div className="px-2 py-1.5">
          <p className="text-[8px] font-semibold text-[#47554D]">BLOCK / LOKASI</p>
          <p className="mt-0.5 font-mono font-bold text-[#132019]">{pump.blockCode}</p>
        </div>
        <div className="px-2 py-1.5">
          <p className="text-[8px] font-semibold text-[#47554D]">TANGGAL PERIKSA</p>
          <p className="mt-0.5 font-mono font-semibold text-[#132019]">
            {inspection?.inspectedAt ?? "-"}
          </p>
        </div>
        <div className="px-2 py-1.5">
          <p className="text-[8px] font-semibold text-[#47554D]">PEMERIKSA</p>
          <p className="mt-0.5 font-semibold text-[#132019]">
            {inspection?.inspectorName ?? "-"}
          </p>
        </div>
        <div className="px-2 py-1.5">
          <p className="text-[8px] font-semibold text-[#47554D]">RINGKASAN PART</p>
          <p className="mt-0.5 font-mono font-semibold text-[#132019]">
            {partRows.length > 0
              ? `${okPartsCount}/${partRows.length} Baik (${issueItems.length} Temuan)`
              : `${items.length} Baris`}
          </p>
        </div>
      </section>

      {inspection?.notes && (
        <p className="mt-1.5 rounded border border-[#D5DDD7] bg-white px-2.5 py-1 text-[9.5px] text-[#132019]">
          <strong className="text-[#47554D]">Catatan Umum:</strong> {inspection.notes}
        </p>
      )}

      {/* 2-Column Balanced Component Checklist */}
      {items.length > 0 ? (
        <section className="mt-2.5 grid grid-cols-2 items-start gap-2.5">
          <div className="space-y-2.5">{leftSections.map(renderSectionCard)}</div>
          <div className="space-y-2.5">{rightSections.map(renderSectionCard)}</div>
        </section>
      ) : (
        <p className="mt-3 rounded border border-[#D5DDD7] p-3 text-[10px] text-[#47554D]">
          Belum ada catatan checklist komponen pada pemeriksaan ini.
        </p>
      )}

      {/* Compact Problem Highlight Strip */}
      {issueItems.length > 0 && (
        <section className="print-avoid-break mt-2.5 rounded border border-[#D97706] bg-[#FFFBEB] px-2.5 py-1.5">
          <p className="text-[9px] font-bold text-[#92400E]">
            RINGKASAN TEMUAN PERLU TINDAK LANJUT ({issueItems.length} ITEM)
          </p>
          <p className="mt-0.5 text-[8.5px] leading-snug text-[#132019]">
            {issueItems
              .map((item) => {
                const st = formatItemStatus(item);
                const detail = formatFindingText(item);
                return `${item.sectionName} - ${item.partName} (${st.text}${
                  detail !== "-" ? `: ${detail}` : ""
                })`;
              })
              .join("  |  ")}
          </p>
        </section>
      )}

      {/* Compact Photo Documentation */}
      {inspection && inspection.photos.length > 0 && (
        <section className="print-avoid-break mt-2.5 rounded border border-[#B8C4BC] p-2">
          <p className="mb-1.5 text-[9.5px] font-bold text-[#132019]">
            DOKUMENTASI FOTO ({inspection.photos.length})
          </p>
          <div className="grid grid-cols-4 gap-2">
            {inspection.photos.map((photo) => (
              <figure
                key={photo.id}
                className="overflow-hidden rounded border border-[#D5DDD7] bg-[#F8FAF8]"
              >
                <img
                  src={`/api/photos/${photo.id}`}
                  alt={photo.caption || `Foto pompa ${pump.pumpCode}`}
                  width={320}
                  height={240}
                  loading="eager"
                  className="h-[28mm] w-full object-cover"
                />
                <figcaption className="truncate px-1.5 py-0.5 text-[8px] text-[#47554D]">
                  {photo.caption || photo.fileName}
                </figcaption>
              </figure>
            ))}
          </div>
        </section>
      )}

      {/* Formal 3-Column Approval Signature Footer */}
      <footer className="print-avoid-break mt-3 grid grid-cols-3 gap-4 border-t border-[#CBD5CE] pt-2.5 text-center text-[9px] text-[#132019]">
        <div>
          <p className="font-semibold text-[#47554D]">Diperiksa Oleh,</p>
          <div className="mt-9 border-b border-[#132019] pb-0.5 font-semibold">
            {inspection?.inspectorName ?? "____________________"}
          </div>
          <p className="mt-0.5 text-[8px] text-[#47554D]">
            Petugas / Pemeriksa ({inspection?.inspectedAt ?? "-"})
          </p>
        </div>

        <div>
          <p className="font-semibold text-[#47554D]">Diketahui Oleh,</p>
          <div className="mt-9 border-b border-[#132019] pb-0.5 font-semibold">
            &nbsp;
          </div>
          <p className="mt-0.5 text-[8px] text-[#47554D]">Workshop / Kepala Mekanik</p>
        </div>

        <div>
          <p className="font-semibold text-[#47554D]">Disetujui Oleh,</p>
          <div className="mt-9 border-b border-[#132019] pb-0.5 font-semibold">
            &nbsp;
          </div>
          <p className="mt-0.5 text-[8px] text-[#47554D]">Estate Manager / Pimpinan Unit</p>
        </div>
      </footer>
    </article>
  );
}
