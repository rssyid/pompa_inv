import ExcelJS from "exceljs";
import { OPERATIONAL_CATEGORY_OPTIONS } from "@/lib/pump-location";
import type { OperatingHoursMonitoringPayload } from "@/lib/queries/operating-hours";

export interface ExportPumpSummaryRow {
  companyName: string;
  regionName: string;
  estateCode: string;
  blockCode: string;
  pumpCode: string;
  pumpTypeName: string;
  engineBrandName: string;
  unitStatus: string;
  lastInspectedAt: string;
  inspectorName: string;
  issueCount: number;
}

export interface ExportIssueRow {
  regionName: string;
  estateCode: string;
  blockCode: string;
  pumpCode: string;
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

export interface ExportSinglePumpForm {
  companyName: string;
  regionName: string;
  estateCode: string;
  blockCode: string;
  pumpCode: string;
  pumpTypeName: string;
  engineBrandName: string;
  unitStatus: string;
  inspectedAt: string;
  inspectorName: string;
  notes: string;
  items: Array<{
    sectionCode: string;
    sectionName: string;
    itemNo: number;
    partName: string;
    expectedQty: number;
    availability: string;
    condition: string;
    issueLabel: string;
    notes: string;
  }>;
}

const UNIT_STATUS_LABEL: Record<string, string> = {
  aktif: "Aktif",
  perlu_perbaikan: "Perlu Perbaikan",
  rusak_total: "Rusak Total",
};

const AVAIL_LABEL: Record<string, string> = {
  ada: "Ada",
  tidak_lengkap: "Tidak Lengkap",
  hilang: "Hilang",
};

const COND_LABEL: Record<string, string> = {
  baik: "Baik",
  rusak: "Rusak",
};

export async function generateRecapWorkbook(params: {
  pumps: ExportPumpSummaryRow[];
  issues: ExportIssueRow[];
  filterSummary: string;
}): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = "Pompa Monitor PT TH Indoplantation";
  wb.created = new Date();

  // Sheet 1: Ringkasan per Estate
  const wsSummary = wb.addWorksheet("Ringkasan Estate");
  wsSummary.addRow(["Laporan Rekap Kondisi Pompa - PT TH Indoplantation"]);
  wsSummary.getRow(1).font = { bold: true, size: 14 };
  wsSummary.addRow([`Filter: ${params.filterSummary}`]);
  wsSummary.addRow([`Tanggal Cetak: ${new Date().toISOString().slice(0, 10)}`]);
  wsSummary.addRow([]);

  const headerRow1 = wsSummary.addRow([
    "Region",
    "Estate",
    "Total Pompa",
    "Aktif",
    "Perlu Perbaikan",
    "Rusak Total",
    "Total Part Bermasalah",
  ]);
  headerRow1.font = { bold: true, color: { argb: "FFFFFFFF" } };
  headerRow1.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FF132019" },
  };

  const estateAgg = new Map<
    string,
    {
      region: string;
      estate: string;
      total: number;
      aktif: number;
      perbaikan: number;
      rusak: number;
      issues: number;
    }
  >();

  for (const p of params.pumps) {
    const key = `${p.regionName}::${p.estateCode}`;
    const entry = estateAgg.get(key) ?? {
      region: p.regionName,
      estate: p.estateCode,
      total: 0,
      aktif: 0,
      perbaikan: 0,
      rusak: 0,
      issues: 0,
    };
    entry.total += 1;
    if (p.unitStatus === "aktif") entry.aktif += 1;
    else if (p.unitStatus === "perlu_perbaikan") entry.perbaikan += 1;
    else entry.rusak += 1;
    entry.issues += p.issueCount;
    estateAgg.set(key, entry);
  }

  let totalAll = 0;
  let aktifAll = 0;
  let perbaikanAll = 0;
  let rusakAll = 0;
  let issuesAll = 0;

  for (const agg of estateAgg.values()) {
    totalAll += agg.total;
    aktifAll += agg.aktif;
    perbaikanAll += agg.perbaikan;
    rusakAll += agg.rusak;
    issuesAll += agg.issues;
    wsSummary.addRow([
      agg.region,
      agg.estate,
      agg.total,
      agg.aktif,
      agg.perbaikan,
      agg.rusak,
      agg.issues,
    ]);
  }

  const totalRow = wsSummary.addRow([
    "TOTAL",
    "",
    totalAll,
    aktifAll,
    perbaikanAll,
    rusakAll,
    issuesAll,
  ]);
  totalRow.font = { bold: true };
  totalRow.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FFEEF2EF" },
  };
  wsSummary.views = [{ state: "frozen", ySplit: 5 }];
  wsSummary.columns = [
    { width: 24 },
    { width: 12 },
    { width: 14 },
    { width: 12 },
    { width: 18 },
    { width: 14 },
    { width: 22 },
  ];

  // Sheet 2: Daftar Kondisi Semua Pompa
  const wsPumps = wb.addWorksheet("Kondisi Semua Pompa");
  wsPumps.views = [{ state: "frozen", ySplit: 1 }];
  const headerRow2 = wsPumps.addRow([
    "PT",
    "Region",
    "Estate",
    "Block",
    "Kode Pompa",
    "Jenis Pompa",
    "Merek Mesin",
    "Status Unit",
    "Part Bermasalah",
    "Tanggal Periksa Terakhir",
    "Pemeriksa",
  ]);
  headerRow2.font = { bold: true, color: { argb: "FFFFFFFF" } };
  headerRow2.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FF132019" },
  };

  for (const p of params.pumps) {
    wsPumps.addRow([
      p.companyName,
      p.regionName,
      p.estateCode,
      p.blockCode,
      p.pumpCode,
      p.pumpTypeName,
      p.engineBrandName,
      UNIT_STATUS_LABEL[p.unitStatus] ?? p.unitStatus,
      p.issueCount,
      p.lastInspectedAt || "-",
      p.inspectorName || "-",
    ]);
  }
  wsPumps.columns = [
    { width: 22 },
    { width: 22 },
    { width: 10 },
    { width: 16 },
    { width: 18 },
    { width: 16 },
    { width: 18 },
    { width: 18 },
    { width: 16 },
    { width: 20 },
    { width: 18 },
  ];

  // Sheet 3: Daftar Part Bermasalah / Hilang
  const wsIssues = wb.addWorksheet("Part Bermasalah & Hilang");
  wsIssues.views = [{ state: "frozen", ySplit: 1 }];
  const headerRow3 = wsIssues.addRow([
    "Region",
    "Estate",
    "Block",
    "Kode Pompa",
    "Jenis Pompa",
    "Bagian",
    "Nama Part",
    "Qty Standar",
    "Ketersediaan",
    "Kondisi",
    "Temuan Standar",
    "Detail Tambahan",
    "Tanggal Periksa",
  ]);
  headerRow3.font = { bold: true, color: { argb: "FFFFFFFF" } };
  headerRow3.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FF15803D" },
  };

  for (const item of params.issues) {
    wsIssues.addRow([
      item.regionName,
      item.estateCode,
      item.blockCode,
      item.pumpCode,
      item.pumpTypeName,
      item.sectionName,
      item.partName,
      item.expectedQty,
      AVAIL_LABEL[item.availability] ?? item.availability,
      COND_LABEL[item.condition] ?? item.condition,
      item.issueLabel || "-",
      item.notes || "-",
      item.inspectedAt || "-",
    ]);
  }
  wsIssues.columns = [
    { width: 22 },
    { width: 10 },
    { width: 14 },
    { width: 16 },
    { width: 16 },
    { width: 16 },
    { width: 38 },
    { width: 12 },
    { width: 16 },
    { width: 12 },
    { width: 22 },
    { width: 24 },
    { width: 16 },
  ];

  const out = await wb.xlsx.writeBuffer();
  return Buffer.from(out);
}

export async function generateSinglePumpWorkbook(form: ExportSinglePumpForm): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet(form.pumpCode.slice(0, 31));

  ws.mergeCells("A1:H1");
  ws.getCell("A1").value = `Form Pemeriksaan Kondisi Pompa ${form.pumpTypeName}`;
  ws.getCell("A1").font = { bold: true, size: 13 };

  ws.getCell("A2").value = "PT / Region";
  ws.getCell("B2").value = `${form.companyName} / ${form.regionName}`;
  ws.getCell("F2").value = "Estate / Block";
  ws.getCell("G2").value = `${form.estateCode} / ${form.blockCode}`;

  ws.getCell("A3").value = "Kode Pompa";
  ws.getCell("B3").value = form.pumpCode;
  ws.getCell("F3").value = "Merek Mesin";
  ws.getCell("G3").value = form.engineBrandName;

  ws.getCell("A4").value = "Status Unit";
  ws.getCell("B4").value = UNIT_STATUS_LABEL[form.unitStatus] ?? form.unitStatus;
  ws.getCell("F4").value = "Tanggal / Pemeriksa";
  ws.getCell("G4").value = `${form.inspectedAt} (${form.inspectorName})`;

  ws.addRow([]);
  const header = ws.addRow([
    "Bagian",
    "No",
    "Part Name",
    "Qty",
    "Ketersediaan",
    "Kondisi",
    "Temuan Standar",
    "Detail Tambahan",
  ]);
  header.font = { bold: true, color: { argb: "FFFFFFFF" } };
  header.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FF132019" },
  };

  for (const item of form.items) {
    ws.addRow([
      item.itemNo === 0 ? item.sectionCode : "",
      item.itemNo === 0 ? "" : item.itemNo,
      item.partName,
      item.expectedQty,
      AVAIL_LABEL[item.availability] ?? item.availability,
      COND_LABEL[item.condition] ?? item.condition,
      item.issueLabel || "-",
      item.notes || "",
    ]);
  }

  ws.columns = [
    { width: 8 },
    { width: 6 },
    { width: 42 },
    { width: 8 },
    { width: 16 },
    { width: 12 },
    { width: 22 },
    { width: 26 },
  ];

  const out = await wb.xlsx.writeBuffer();
  return Buffer.from(out);
}

const THIN_BORDER: Partial<ExcelJS.Borders> = {
  top: { style: "thin", color: { argb: "FF47554D" } },
  left: { style: "thin", color: { argb: "FF47554D" } },
  bottom: { style: "thin", color: { argb: "FF47554D" } },
  right: { style: "thin", color: { argb: "FF47554D" } },
};

function applyBorderToRange(
  ws: ExcelJS.Worksheet,
  startRow: number,
  endRow: number,
  startCol: number,
  endCol: number
) {
  for (let r = startRow; r <= endRow; r++) {
    const row = ws.getRow(r);
    for (let c = startCol; c <= endCol; c++) {
      row.getCell(c).border = THIN_BORDER;
    }
  }
}

export async function generateOperatingHoursWorkbook(params: {
  report: OperatingHoursMonitoringPayload;
  title?: string;
}): Promise<Buffer> {
  const { report } = params;
  const wb = new ExcelJS.Workbook();
  wb.creator = "Pompa Monitor PT TH Indoplantation";
  wb.created = new Date();

  const ws = wb.addWorksheet("Monitoring Jam Pompa", {
    pageSetup: {
      orientation: "landscape",
      paperSize: 9,
      fitToPage: true,
      fitToWidth: 1,
      fitToHeight: 0,
    },
  });

  const dateCount = Math.max(1, report.dates.length);
  const firstDateCol = 7;
  const lastDateCol = firstDateCol + dateCount - 1;
  const totalCol = lastDateCol + 1;
  const noteCol = lastDateCol + 2;
  const statusCol = lastDateCol + 3;

  const titleText = params.title || "MONITORING POMPA PT TH INDOPLANTATION";
  ws.getCell(1, 1).value = titleText;
  ws.getCell(1, 1).font = { bold: true, size: 13 };
  ws.getCell(2, 1).value = `Update : ${report.updateDate}`;
  ws.getCell(2, 1).font = { bold: true, size: 10 };

  // 3-row table header starting at row 4
  const h1 = 4;
  const h2 = 5;
  const h3 = 6;

  ws.mergeCells(h1, 1, h3, 1);
  ws.getCell(h1, 1).value = "Kebun";

  ws.mergeCells(h1, 2, h1, 6);
  ws.getCell(h1, 2).value = "Pompa";

  const pumpSubHeaders = ["No", "Type", "Posisi pompa", "Kode", "Kondisi"];
  pumpSubHeaders.forEach((label, idx) => {
    const col = 2 + idx;
    ws.mergeCells(h2, col, h3, col);
    ws.getCell(h2, col).value = label;
  });

  ws.mergeCells(h1, firstDateCol, h1, lastDateCol);
  ws.getCell(h1, firstDateCol).value = "Jam Operasional";

  ws.mergeCells(h2, firstDateCol, h2, lastDateCol);
  ws.getCell(h2, firstDateCol).value = report.monthName;

  if (report.dates.length === 0) {
    ws.getCell(h3, firstDateCol).value = "-";
  } else {
    report.dates.forEach((d, idx) => {
      const cell = ws.getCell(h3, firstDateCol + idx);
      cell.value = d.day;
      if (d.isSunday) {
        cell.font = { bold: true, color: { argb: "FFDC2626" } };
      }
    });
  }

  ws.mergeCells(h1, totalCol, h3, totalCol);
  ws.getCell(h1, totalCol).value = "Total Jam/Bln";

  ws.mergeCells(h1, noteCol, h3, noteCol);
  ws.getCell(h1, noteCol).value = "Keterangan";

  ws.mergeCells(h1, statusCol, h3, statusCol);
  ws.getCell(h1, statusCol).value = "Status";

  for (let r = h1; r <= h3; r++) {
    const row = ws.getRow(r);
    row.height = 18;
    for (let c = 1; c <= statusCol; c++) {
      const cell = row.getCell(c);
      cell.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
      cell.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FFD9E1D9" },
      };
      if (!(r === h3 && c >= firstDateCol && c <= lastDateCol && report.dates[c - firstDateCol]?.isSunday)) {
        cell.font = { bold: true, size: 10, color: { argb: "FF132019" } };
      }
      cell.border = THIN_BORDER;
    }
  }

  const categoryColorMap = new Map(
    OPERATIONAL_CATEGORY_OPTIONS.map((opt) => [opt.value, opt.excelFillArgb])
  );

  let currentRow = 7;

  for (const group of report.regions) {
    // Region banner row
    ws.mergeCells(currentRow, 1, currentRow, statusCol);
    const regionCell = ws.getCell(currentRow, 1);
    regionCell.value = group.regionName;
    regionCell.font = { bold: true, size: 10, color: { argb: "FF132019" } };
    regionCell.alignment = { horizontal: "left", vertical: "middle" };
    regionCell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FFEAEFEA" },
    };
    applyBorderToRange(ws, currentRow, currentRow, 1, statusCol);
    ws.getRow(currentRow).height = 20;
    currentRow += 1;

    const groupStartRow = currentRow;

    for (const p of group.pumps) {
      const row = ws.getRow(currentRow);
      row.height = 19;

      row.getCell(1).value = p.estateName || p.estateCode;
      row.getCell(1).font = { bold: true, size: 10 };
      row.getCell(1).alignment = { horizontal: "center", vertical: "middle", wrapText: true };

      row.getCell(2).value = p.no;
      row.getCell(2).alignment = { horizontal: "center", vertical: "middle" };

      row.getCell(3).value = p.pumpTypeShort;
      row.getCell(3).font = { bold: true, size: 9 };
      row.getCell(3).alignment = { horizontal: "left", vertical: "middle" };

      row.getCell(4).value = p.blockCode;
      row.getCell(4).font = { bold: true, size: 9 };
      row.getCell(4).alignment = { horizontal: "center", vertical: "middle" };

      row.getCell(5).value = p.pumpCode;
      row.getCell(5).font = { bold: true, size: 9 };
      row.getCell(5).alignment = { horizontal: "left", vertical: "middle" };

      const condCell = row.getCell(6);
      condCell.value = p.kondisi;
      condCell.alignment = { horizontal: "center", vertical: "middle" };
      if (p.kondisi === "Baik") {
        condCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFC6EFCE" } };
        condCell.font = { size: 9, color: { argb: "FF006100" } };
      } else {
        condCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFFC7CE" } };
        condCell.font = { size: 9, bold: true, color: { argb: "FF9C0006" } };
      }

      if (p.isPreOrder && report.dates.length > 0 && p.cells.every((c) => c.type === "pre_order")) {
        ws.mergeCells(currentRow, firstDateCol, currentRow, lastDateCol);
        const poCell = row.getCell(firstDateCol);
        poCell.value = "PRE ORDER";
        poCell.font = { bold: true, size: 9, color: { argb: "FF132019" } };
        poCell.alignment = { horizontal: "center", vertical: "middle" };
      } else if (report.dates.length === 0) {
        row.getCell(firstDateCol).value = "-";
        row.getCell(firstDateCol).alignment = { horizontal: "center", vertical: "middle" };
      } else {
        p.cells.forEach((cellData, idx) => {
          const c = row.getCell(firstDateCol + idx);
          c.alignment = { horizontal: "center", vertical: "middle" };
          if (cellData.type === "hours") {
            c.value = cellData.hours;
            c.font = { bold: true, size: 9 };
          } else if (cellData.type === "rusak") {
            c.value = cellData.value;
            c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFF0000" } };
            c.font = { bold: true, size: 9, color: { argb: "FFFFFFFF" } };
          } else if (cellData.type === "pre_order") {
            c.value = "PO";
            c.font = { bold: true, size: 8, color: { argb: "FF92400E" } };
          } else {
            c.value = "-";
            c.font = { size: 9, color: { argb: "FF47554D" } };
          }
        });
      }

      const totCell = row.getCell(totalCol);
      totCell.value = p.totalHoursMonth > 0 ? p.totalHoursMonth : "-";
      totCell.font = { bold: true, size: 9 };
      totCell.alignment = { horizontal: "center", vertical: "middle" };

      const noteCell = row.getCell(noteCol);
      noteCell.value = p.operationalNote;
      noteCell.font = { size: 9 };
      noteCell.alignment = { horizontal: "left", vertical: "middle", wrapText: true };
      const fillArgb = categoryColorMap.get(
        p.operationalCategory as (typeof OPERATIONAL_CATEGORY_OPTIONS)[number]["value"]
      );
      if (fillArgb) {
        noteCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: fillArgb } };
      }

      const stCell = row.getCell(statusCol);
      stCell.value = p.repairStatus;
      stCell.font = { size: 9 };
      stCell.alignment = { horizontal: "left", vertical: "middle", wrapText: true };
      if (p.repairStatus) {
        stCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF8DB4E2" } };
      }

      applyBorderToRange(ws, currentRow, currentRow, 1, statusCol);
      currentRow += 1;
    }

    // Merge consecutive Kebun cells vertically within the region
    let mergeStart = groupStartRow;
    for (let i = 1; i <= group.pumps.length; i++) {
      const prevEstate = group.pumps[i - 1]?.estateName || group.pumps[i - 1]?.estateCode;
      const curEstate = group.pumps[i]?.estateName || group.pumps[i]?.estateCode;
      if (i === group.pumps.length || curEstate !== prevEstate) {
        const mergeEnd = groupStartRow + i - 1;
        if (mergeEnd > mergeStart) {
          ws.mergeCells(mergeStart, 1, mergeEnd, 1);
        }
        mergeStart = groupStartRow + i;
      }
    }

    // Region subtotal row
    ws.mergeCells(currentRow, 1, currentRow, lastDateCol);
    const subLabelCell = ws.getCell(currentRow, 1);
    subLabelCell.value = "TOTAL JAM/WP SAAT INI";
    subLabelCell.font = { bold: true, size: 9 };
    subLabelCell.alignment = { horizontal: "center", vertical: "middle" };
    ws.getCell(currentRow, totalCol).value = group.regionTotalHoursMonth;
    ws.getCell(currentRow, totalCol).font = { bold: true, size: 10 };
    ws.getCell(currentRow, totalCol).alignment = { horizontal: "center", vertical: "middle" };
    for (let c = 1; c <= statusCol; c++) {
      ws.getCell(currentRow, c).fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FFF3F4F6" },
      };
    }
    applyBorderToRange(ws, currentRow, currentRow, 1, statusCol);
    currentRow += 1;
  }

  // Grand total row
  if (report.regions.length > 0) {
    ws.mergeCells(currentRow, 1, currentRow, lastDateCol);
    const grandCell = ws.getCell(currentRow, 1);
    grandCell.value = "TOTAL JAM/WP KESELURUHAN";
    grandCell.font = { bold: true, size: 10 };
    grandCell.alignment = { horizontal: "center", vertical: "middle" };
    ws.getCell(currentRow, totalCol).value = report.grandTotalHoursMonth;
    ws.getCell(currentRow, totalCol).font = { bold: true, size: 10 };
    ws.getCell(currentRow, totalCol).alignment = { horizontal: "center", vertical: "middle" };
    for (let c = 1; c <= statusCol; c++) {
      ws.getCell(currentRow, c).fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FFE2E8F0" },
      };
    }
    applyBorderToRange(ws, currentRow, currentRow, 1, statusCol);
  }

  // Column widths
  ws.getColumn(1).width = 14;
  ws.getColumn(2).width = 5;
  ws.getColumn(3).width = 13;
  ws.getColumn(4).width = 13;
  ws.getColumn(5).width = 14;
  ws.getColumn(6).width = 9;
  for (let i = 0; i < dateCount; i++) {
    ws.getColumn(firstDateCol + i).width = 6;
  }
  ws.getColumn(totalCol).width = 13;
  ws.getColumn(noteCol).width = 42;
  ws.getColumn(statusCol).width = 22;

  ws.views = [{ state: "frozen", xSplit: 6, ySplit: 6 }];

  const out = await wb.xlsx.writeBuffer();
  return Buffer.from(out);
}
