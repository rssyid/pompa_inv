import ExcelJS from "exceljs";

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

  for (const agg of estateAgg.values()) {
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
