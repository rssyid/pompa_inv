import {
  AlignmentType,
  BorderStyle,
  Document,
  ImageRun,
  Packer,
  Paragraph,
  ShadingType,
  Table,
  TableCell,
  TableRow,
  TextRun,
  WidthType,
} from "docx";

export interface WordReportItem {
  sectionCode: string;
  sectionName: string;
  itemNo: number;
  partName: string;
  expectedQty: number;
  availability: string;
  condition: string;
  issueLabel: string;
  notes: string;
}

export interface WordReportPhoto {
  buffer: Buffer;
  mimeType: string;
  caption: string;
}

export interface WordReportInput {
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
  items: WordReportItem[];
  photos: WordReportPhoto[];
}

const UNIT_STATUS_TEXT: Record<string, string> = {
  aktif: "AKTIF",
  perlu_perbaikan: "PERLU PERBAIKAN",
  rusak_total: "RUSAK TOTAL",
};

const BORDER_COLOR = "B8C4BC";
const HEADER_BG = "EEF2EF";
const ISSUE_BG = "FFFBEB";
const SUBTLE_BG = "F8FAF8";

const CELL_BORDERS = {
  top: { style: BorderStyle.SINGLE, size: 4, color: BORDER_COLOR },
  bottom: { style: BorderStyle.SINGLE, size: 4, color: BORDER_COLOR },
  left: { style: BorderStyle.SINGLE, size: 4, color: BORDER_COLOR },
  right: { style: BorderStyle.SINGLE, size: 4, color: BORDER_COLOR },
};

const NO_BORDERS = {
  top: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
  bottom: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
  left: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
  right: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
};

function formatItemStatus(item: WordReportItem): { text: string; isProblem: boolean; color: string } {
  if (item.availability === "hilang") {
    return { text: "X Hilang", isProblem: true, color: "991B1B" };
  }
  if (item.availability === "tidak_lengkap") {
    return { text: "! Kurang", isProblem: true, color: "92400E" };
  }
  if (item.condition === "rusak") {
    return { text: "X Rusak", isProblem: true, color: "991B1B" };
  }
  return { text: "Baik", isProblem: false, color: "166534" };
}

function formatFinding(item: WordReportItem): string {
  const parts: string[] = [];
  if (item.issueLabel && item.issueLabel !== "Normal / Baik") {
    parts.push(item.issueLabel);
  }
  if (item.notes?.trim()) {
    parts.push(item.notes.trim());
  }
  return parts.join(" · ") || "-";
}

function makeText(text: string, opts?: { bold?: boolean; size?: number; color?: string; font?: string }) {
  return new TextRun({
    text,
    bold: opts?.bold,
    size: opts?.size ?? 16,
    color: opts?.color ?? "132019",
    font: opts?.font ?? "Calibri",
  });
}

interface SectionGroup {
  key: string;
  sectionCode: string;
  sectionName: string;
  headerRow: WordReportItem | null;
  rows: WordReportItem[];
}

function buildSectionTable(sec: SectionGroup): Table {
  const displayRows = sec.rows.length > 0 ? sec.rows : sec.headerRow ? [sec.headerRow] : [];
  const headerStatus = sec.headerRow && sec.rows.length > 0 ? formatItemStatus(sec.headerRow) : null;

  const rows: TableRow[] = [
    new TableRow({
      tableHeader: true,
      children: [
        new TableCell({
          columnSpan: 5,
          shading: { type: ShadingType.CLEAR, fill: HEADER_BG },
          borders: CELL_BORDERS,
          margins: { top: 45, bottom: 45, left: 80, right: 80 },
          children: [
            new Paragraph({
              spacing: { before: 0, after: 0 },
              children: [
                makeText(`${sec.sectionCode}. ${sec.sectionName}`, { bold: true, size: 16 }),
                ...(headerStatus
                  ? [
                      makeText(`   [${headerStatus.text}]`, {
                        bold: true,
                        size: 14,
                        color: headerStatus.color,
                      }),
                    ]
                  : []),
              ],
            }),
          ],
        }),
      ],
    }),
    new TableRow({
      tableHeader: true,
      children: [
        { text: "No", width: 8, align: AlignmentType.CENTER },
        { text: "Komponen", width: 44, align: AlignmentType.LEFT },
        { text: "Qty", width: 8, align: AlignmentType.CENTER },
        { text: "Status", width: 16, align: AlignmentType.CENTER },
        { text: "Temuan", width: 24, align: AlignmentType.LEFT },
      ].map(
        (col) =>
          new TableCell({
            width: { size: col.width, type: WidthType.PERCENTAGE },
            shading: { type: ShadingType.CLEAR, fill: SUBTLE_BG },
            borders: CELL_BORDERS,
            margins: { top: 35, bottom: 35, left: 60, right: 60 },
            children: [
              new Paragraph({
                alignment: col.align,
                spacing: { before: 0, after: 0 },
                children: [makeText(col.text, { bold: true, size: 14, color: "47554D" })],
              }),
            ],
          })
      ),
    }),
  ];

  for (const item of displayRows) {
    const st = formatItemStatus(item);
    const finding = formatFinding(item);
    const fill = st.isProblem ? ISSUE_BG : "FFFFFF";

    rows.push(
      new TableRow({
        cantSplit: true,
        children: [
          new TableCell({
            width: { size: 8, type: WidthType.PERCENTAGE },
            shading: { type: ShadingType.CLEAR, fill },
            borders: CELL_BORDERS,
            margins: { top: 30, bottom: 30, left: 50, right: 50 },
            children: [
              new Paragraph({
                alignment: AlignmentType.CENTER,
                spacing: { before: 0, after: 0 },
                children: [
                  makeText(item.itemNo === 0 ? item.sectionCode : String(item.itemNo), {
                    size: 14,
                    color: "47554D",
                  }),
                ],
              }),
            ],
          }),
          new TableCell({
            width: { size: 44, type: WidthType.PERCENTAGE },
            shading: { type: ShadingType.CLEAR, fill },
            borders: CELL_BORDERS,
            margins: { top: 30, bottom: 30, left: 60, right: 60 },
            children: [
              new Paragraph({
                spacing: { before: 0, after: 0 },
                children: [makeText(item.partName, { bold: st.isProblem, size: 15 })],
              }),
            ],
          }),
          new TableCell({
            width: { size: 8, type: WidthType.PERCENTAGE },
            shading: { type: ShadingType.CLEAR, fill },
            borders: CELL_BORDERS,
            margins: { top: 30, bottom: 30, left: 40, right: 40 },
            children: [
              new Paragraph({
                alignment: AlignmentType.CENTER,
                spacing: { before: 0, after: 0 },
                children: [makeText(String(item.expectedQty), { size: 14 })],
              }),
            ],
          }),
          new TableCell({
            width: { size: 16, type: WidthType.PERCENTAGE },
            shading: { type: ShadingType.CLEAR, fill },
            borders: CELL_BORDERS,
            margins: { top: 30, bottom: 30, left: 40, right: 40 },
            children: [
              new Paragraph({
                alignment: AlignmentType.CENTER,
                spacing: { before: 0, after: 0 },
                children: [makeText(st.text, { bold: st.isProblem, size: 14, color: st.color })],
              }),
            ],
          }),
          new TableCell({
            width: { size: 24, type: WidthType.PERCENTAGE },
            shading: { type: ShadingType.CLEAR, fill },
            borders: CELL_BORDERS,
            margins: { top: 30, bottom: 30, left: 60, right: 60 },
            children: [
              new Paragraph({
                spacing: { before: 0, after: 0 },
                children: [makeText(finding, { size: 14, color: "47554D" })],
              }),
            ],
          }),
        ],
      })
    );
  }

  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows,
  });
}

function docxImageType(mimeType: string): "jpg" | "png" | "gif" | "bmp" | null {
  const lower = mimeType.toLowerCase();
  if (lower.includes("png")) return "png";
  if (lower.includes("jpeg") || lower.includes("jpg")) return "jpg";
  if (lower.includes("gif")) return "gif";
  if (lower.includes("bmp")) return "bmp";
  return null;
}

export async function generatePumpReportDocx(input: WordReportInput): Promise<Buffer> {
  const partRows = input.items.filter((i) => i.itemNo > 0);
  const issueItems = input.items.filter(
    (i) => i.availability !== "ada" || i.condition === "rusak"
  );
  const okPartsCount = partRows.filter(
    (i) => i.availability === "ada" && i.condition === "baik"
  ).length;

  const sectionMap = new Map<string, SectionGroup>();
  for (const item of input.items) {
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
    if (item.itemNo === 0) grp.headerRow = item;
    else grp.rows.push(item);
  }

  const allSections = Array.from(sectionMap.values());
  const leftSections: SectionGroup[] = [];
  const rightSections: SectionGroup[] = [];
  let leftWeight = 0;
  let rightWeight = 0;

  for (const sec of allSections) {
    const weight = Math.max(1, sec.rows.length) + 2;
    if (leftWeight <= rightWeight) {
      leftSections.push(sec);
      leftWeight += weight;
    } else {
      rightSections.push(sec);
      rightWeight += weight;
    }
  }

  const headerTable = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [
      new TableRow({
        children: [
          new TableCell({
            width: { size: 68, type: WidthType.PERCENTAGE },
            borders: {
              ...NO_BORDERS,
              bottom: { style: BorderStyle.SINGLE, size: 12, color: "132019" },
            },
            margins: { top: 40, bottom: 80, left: 0, right: 80 },
            children: [
              new Paragraph({
                spacing: { before: 0, after: 20 },
                children: [makeText(input.companyName, { bold: true, size: 18, color: "15803D" })],
              }),
              new Paragraph({
                spacing: { before: 0, after: 20 },
                children: [
                  makeText("LAPORAN PEMERIKSAAN KONDISI POMPA", { bold: true, size: 24 }),
                ],
              }),
              new Paragraph({
                spacing: { before: 0, after: 0 },
                children: [
                  makeText(
                    `Tipe Unit: ${input.pumpTypeName}  |  Merek Mesin: ${input.engineBrandName}`,
                    { size: 17, color: "47554D" }
                  ),
                ],
              }),
            ],
          }),
          new TableCell({
            width: { size: 32, type: WidthType.PERCENTAGE },
            shading: { type: ShadingType.CLEAR, fill: SUBTLE_BG },
            borders: {
              top: { style: BorderStyle.SINGLE, size: 4, color: BORDER_COLOR },
              left: { style: BorderStyle.SINGLE, size: 4, color: BORDER_COLOR },
              right: { style: BorderStyle.SINGLE, size: 4, color: BORDER_COLOR },
              bottom: { style: BorderStyle.SINGLE, size: 12, color: "132019" },
            },
            margins: { top: 60, bottom: 80, left: 100, right: 100 },
            children: [
              new Paragraph({
                alignment: AlignmentType.RIGHT,
                spacing: { before: 0, after: 20 },
                children: [makeText("KODE UNIT", { bold: true, size: 14, color: "47554D" })],
              }),
              new Paragraph({
                alignment: AlignmentType.RIGHT,
                spacing: { before: 0, after: 40 },
                children: [makeText(input.pumpCode, { bold: true, size: 22 })],
              }),
              new Paragraph({
                alignment: AlignmentType.RIGHT,
                spacing: { before: 0, after: 0 },
                children: [
                  makeText(
                    `STATUS: ${UNIT_STATUS_TEXT[input.unitStatus] ?? input.unitStatus.toUpperCase()}`,
                    {
                      bold: true,
                      size: 16,
                      color:
                        input.unitStatus === "aktif"
                          ? "166534"
                          : input.unitStatus === "perlu_perbaikan"
                            ? "92400E"
                            : "991B1B",
                    }
                  ),
                ],
              }),
            ],
          }),
        ],
      }),
    ],
  });

  const metaColumns = [
    { label: "REGION / WILAYAH", value: input.regionName, width: 22 },
    { label: "ESTATE", value: input.estateCode, width: 11 },
    { label: "BLOCK / LOKASI", value: input.blockCode, width: 14 },
    { label: "TANGGAL PERIKSA", value: input.inspectedAt, width: 15 },
    { label: "PEMERIKSA", value: input.inspectorName, width: 18 },
    {
      label: "RINGKASAN PART",
      value:
        partRows.length > 0
          ? `${okPartsCount}/${partRows.length} Baik (${issueItems.length} Temuan)`
          : `${input.items.length} Baris`,
      width: 20,
    },
  ];

  const metaTable = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [
      new TableRow({
        children: metaColumns.map(
          (col) =>
            new TableCell({
              width: { size: col.width, type: WidthType.PERCENTAGE },
              shading: { type: ShadingType.CLEAR, fill: SUBTLE_BG },
              borders: CELL_BORDERS,
              margins: { top: 45, bottom: 45, left: 70, right: 70 },
              children: [
                new Paragraph({
                  spacing: { before: 0, after: 15 },
                  children: [makeText(col.label, { bold: true, size: 13, color: "47554D" })],
                }),
                new Paragraph({
                  spacing: { before: 0, after: 0 },
                  children: [makeText(col.value, { bold: true, size: 15 })],
                }),
              ],
            })
        ),
      }),
    ],
  });

  const leftChildren: Array<Paragraph | Table> = [];
  leftSections.forEach((sec, idx) => {
    if (idx > 0) leftChildren.push(new Paragraph({ spacing: { before: 60, after: 0 } }));
    leftChildren.push(buildSectionTable(sec));
  });
  if (leftChildren.length === 0) {
    leftChildren.push(new Paragraph({ children: [makeText("-")] }));
  }

  const rightChildren: Array<Paragraph | Table> = [];
  rightSections.forEach((sec, idx) => {
    if (idx > 0) rightChildren.push(new Paragraph({ spacing: { before: 60, after: 0 } }));
    rightChildren.push(buildSectionTable(sec));
  });
  if (rightChildren.length === 0) {
    rightChildren.push(new Paragraph({ children: [makeText("")] }));
  }

  const checklistTwoColTable = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [
      new TableRow({
        children: [
          new TableCell({
            width: { size: 49, type: WidthType.PERCENTAGE },
            borders: NO_BORDERS,
            margins: { top: 0, bottom: 0, left: 0, right: 60 },
            children: leftChildren,
          }),
          new TableCell({
            width: { size: 2, type: WidthType.PERCENTAGE },
            borders: NO_BORDERS,
            children: [new Paragraph({ children: [] })],
          }),
          new TableCell({
            width: { size: 49, type: WidthType.PERCENTAGE },
            borders: NO_BORDERS,
            margins: { top: 0, bottom: 0, left: 60, right: 0 },
            children: rightChildren,
          }),
        ],
      }),
    ],
  });

  const docChildren: Array<Paragraph | Table> = [
    headerTable,
    new Paragraph({ spacing: { before: 80, after: 0 } }),
    metaTable,
  ];

  if (input.notes?.trim()) {
    docChildren.push(
      new Paragraph({
        spacing: { before: 70, after: 0 },
        children: [
          makeText("Catatan Umum: ", { bold: true, size: 16, color: "47554D" }),
          makeText(input.notes.trim(), { size: 16 }),
        ],
      })
    );
  }

  if (input.items.length > 0) {
    docChildren.push(new Paragraph({ spacing: { before: 90, after: 0 } }));
    docChildren.push(checklistTwoColTable);
  }

  if (issueItems.length > 0) {
    const issueSummaryLine = issueItems
      .map((item) => {
        const st = formatItemStatus(item);
        const detail = formatFinding(item);
        return `${item.sectionName} - ${item.partName} (${st.text}${
          detail !== "-" ? `: ${detail}` : ""
        })`;
      })
      .join("  |  ");

    docChildren.push(new Paragraph({ spacing: { before: 90, after: 0 } }));
    docChildren.push(
      new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        rows: [
          new TableRow({
            cantSplit: true,
            children: [
              new TableCell({
                width: { size: 100, type: WidthType.PERCENTAGE },
                shading: { type: ShadingType.CLEAR, fill: ISSUE_BG },
                borders: {
                  top: { style: BorderStyle.SINGLE, size: 6, color: "D97706" },
                  bottom: { style: BorderStyle.SINGLE, size: 6, color: "D97706" },
                  left: { style: BorderStyle.SINGLE, size: 6, color: "D97706" },
                  right: { style: BorderStyle.SINGLE, size: 6, color: "D97706" },
                },
                margins: { top: 60, bottom: 60, left: 100, right: 100 },
                children: [
                  new Paragraph({
                    spacing: { before: 0, after: 30 },
                    children: [
                      makeText(`RINGKASAN TEMUAN PERLU TINDAK LANJUT (${issueItems.length} ITEM)`, {
                        bold: true,
                        size: 16,
                        color: "92400E",
                      }),
                    ],
                  }),
                  new Paragraph({
                    spacing: { before: 0, after: 0 },
                    children: [makeText(issueSummaryLine, { size: 15 })],
                  }),
                ],
              }),
            ],
          }),
        ],
      })
    );
  }

  // Photos grid (3 per row for clear print size in Word)
  const supportedPhotos = input.photos
    .map((p) => ({ ...p, imgType: docxImageType(p.mimeType) }))
    .filter((p): p is WordReportPhoto & { imgType: "jpg" | "png" | "gif" | "bmp" } => p.imgType !== null);

  if (supportedPhotos.length > 0) {
    docChildren.push(new Paragraph({ spacing: { before: 100, after: 40 } }));
    docChildren.push(
      new Paragraph({
        spacing: { before: 0, after: 40 },
        children: [makeText(`DOKUMENTASI FOTO (${supportedPhotos.length})`, { bold: true, size: 16 })],
      })
    );

    const photoRows: TableRow[] = [];
    for (let i = 0; i < supportedPhotos.length; i += 3) {
      const slice = supportedPhotos.slice(i, i + 3);
      const cells: TableCell[] = slice.map(
        (photo) =>
          new TableCell({
            width: { size: 33, type: WidthType.PERCENTAGE },
            borders: CELL_BORDERS,
            shading: { type: ShadingType.CLEAR, fill: SUBTLE_BG },
            margins: { top: 60, bottom: 60, left: 60, right: 60 },
            children: [
              new Paragraph({
                alignment: AlignmentType.CENTER,
                spacing: { before: 0, after: 30 },
                children: [
                  new ImageRun({
                    type: photo.imgType,
                    data: photo.buffer,
                    transformation: { width: 175, height: 120 },
                  }),
                ],
              }),
              new Paragraph({
                alignment: AlignmentType.CENTER,
                spacing: { before: 0, after: 0 },
                children: [makeText(photo.caption, { size: 14, color: "47554D" })],
              }),
            ],
          })
      );

      while (cells.length < 3) {
        cells.push(
          new TableCell({
            width: { size: 33, type: WidthType.PERCENTAGE },
            borders: NO_BORDERS,
            children: [new Paragraph({ children: [] })],
          })
        );
      }

      photoRows.push(new TableRow({ cantSplit: true, children: cells }));
    }

    docChildren.push(
      new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        rows: photoRows,
      })
    );
  }

  // Formal 3-column signature block without names or job titles, preserving lines
  const signatureLabels = ["Diperiksa Oleh,", "Diketahui Oleh,", "Disetujui Oleh,"];
  const signatureTable = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [
      new TableRow({
        cantSplit: true,
        children: signatureLabels.map(
          (label) =>
            new TableCell({
              width: { size: 33, type: WidthType.PERCENTAGE },
              borders: NO_BORDERS,
              margins: { top: 120, bottom: 40, left: 160, right: 160 },
              children: [
                new Paragraph({
                  alignment: AlignmentType.CENTER,
                  spacing: { before: 0, after: 500 },
                  children: [makeText(label, { bold: true, size: 16, color: "47554D" })],
                }),
                new Paragraph({
                  alignment: AlignmentType.CENTER,
                  spacing: { before: 0, after: 40 },
                  border: {
                    bottom: { style: BorderStyle.SINGLE, size: 6, color: "132019" },
                  },
                  children: [makeText(" ", { size: 16 })],
                }),
                new Paragraph({
                  alignment: AlignmentType.CENTER,
                  spacing: { before: 0, after: 0 },
                  children: [makeText(" ", { size: 14 })],
                }),
              ],
            })
        ),
      }),
    ],
  });

  docChildren.push(new Paragraph({ spacing: { before: 140, after: 0 } }));
  docChildren.push(signatureTable);

  const doc = new Document({
    sections: [
      {
        properties: {
          page: {
            size: {
              width: 11906, // A4 width in twips
              height: 16838, // A4 height in twips
            },
            margin: {
              top: 567, // 10mm
              bottom: 567,
              left: 624, // 11mm
              right: 624,
            },
          },
        },
        children: docChildren,
      },
    ],
  });

  return Packer.toBuffer(doc);
}
