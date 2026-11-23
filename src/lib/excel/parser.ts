import JSZip from "jszip";
import { XMLParser } from "fast-xml-parser";
import ExcelJS from "exceljs";
import {
  AvailabilityStatus,
  ConditionStatus,
  inferItemCondition,
  inferUnitStatus,
  normalizeBlockCode,
  normalizeEngineBrand,
  normalizePumpCode,
  normalizePumpType,
  normalizeRegionCodeAndName,
  UnitStatus,
} from "./normalizer";

export interface ParsedPumpPart {
  sectionCode: string;
  sectionName: string;
  itemNo: number;
  partName: string;
  expectedQty: number;
  availability: AvailabilityStatus;
  condition: ConditionStatus;
  issuePresetLabel: string;
  notes: string | null;
  sortOrder: number;
}

export interface ParsedPumpPhoto {
  fileName: string;
  mimeType: string;
  buffer: Buffer;
}

export interface ParsedPumpRecord {
  sheetName: string;
  pumpCode: string;
  pumpTypeCode: string;
  pumpTypeName: string;
  regionCode: string;
  regionName: string;
  estateCode: string;
  blockCode: string;
  engineBrand: string;
  unitStatus: UnitStatus;
  parts: ParsedPumpPart[];
  photos: ParsedPumpPhoto[];
}

export interface ParseWorkbookOptions {
  fileName: string;
  defaultEstateCode?: string;
}

const xmlParser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
  isArray: (name) =>
    ["sheet", "Relationship", "bk", "rv", "v", "rel", "row", "c", "control", "mc:AlternateContent", "xdr:twoCellAnchor", "xdr:oneCellAnchor"].includes(
      name
    ),
});

function colLettersToNumber(letters: string): number {
  let num = 0;
  for (let i = 0; i < letters.length; i++) {
    num = num * 26 + (letters.charCodeAt(i) - 64);
  }
  return num;
}

function parseCellRef(ref: string): { row: number; col: number } {
  const match = /^([A-Z]+)(\d+)$/i.exec(ref);
  if (!match) return { row: 0, col: 0 };
  return {
    col: colLettersToNumber(match[1].toUpperCase()),
    row: Number(match[2]),
  };
}

function normalizeZipTarget(baseDir: string, target: string): string {
  const combined = target.startsWith("/")
    ? target.slice(1)
    : `${baseDir}/${target}`;
  const parts = combined.split("/");
  const stack: string[] = [];
  for (const part of parts) {
    if (!part || part === ".") continue;
    if (part === "..") stack.pop();
    else stack.push(part);
  }
  return stack.join("/");
}

function mimeTypeFromPath(filePath: string): string {
  const lower = filePath.toLowerCase();
  if (lower.endsWith(".png")) return "image/png";
  if (lower.endsWith(".webp")) return "image/webp";
  return "image/jpeg";
}

function cellText(cell: ExcelJS.Cell): string {
  const val = cell.value;
  if (val === null || val === undefined) return "";
  if (typeof val === "object") {
    if ("richText" in val && Array.isArray(val.richText)) {
      return val.richText.map((rt) => rt.text).join("").trim();
    }
    if ("result" in val && val.result !== undefined && val.result !== null) {
      if (typeof val.result === "object" && "error" in val.result) return "";
      return String(val.result).trim();
    }
    if ("text" in val && typeof val.text === "string") {
      return val.text.trim();
    }
    if ("error" in val) return "";
  }
  const str = String(val).trim();
  return str === "#VALUE!" ? "" : str;
}

async function extractXmlEnhancements(zip: JSZip): Promise<{
  sheetCheckboxes: Map<string, Set<string>>;
  sheetImages: Map<string, Array<{ row: number; col: number; mediaPath: string; buffer: Buffer }>>;
}> {
  const sheetCheckboxes = new Map<string, Set<string>>();
  const sheetImages = new Map<
    string,
    Array<{ row: number; col: number; mediaPath: string; buffer: Buffer }>
  >();

  const workbookXmlRaw = await zip.file("xl/workbook.xml")?.async("string");
  const workbookRelsRaw = await zip.file("xl/_rels/workbook.xml.rels")?.async("string");
  if (!workbookXmlRaw || !workbookRelsRaw) {
    return { sheetCheckboxes, sheetImages };
  }

  const workbookXml = xmlParser.parse(workbookXmlRaw);
  const workbookRels = xmlParser.parse(workbookRelsRaw);

  const wbRelMap = new Map<string, string>();
  const wbRelList = workbookRels?.Relationships?.Relationship ?? [];
  for (const rel of wbRelList) {
    wbRelMap.set(rel["@_Id"], normalizeZipTarget("xl", rel["@_Target"]));
  }

  // RichData place-in-cell image lookup: vm (1-based) -> metadata -> rdrichvalue -> richValueRel -> media
  const vmToMediaPath = new Map<number, string>();
  const metadataRaw = await zip.file("xl/metadata.xml")?.async("string");
  const rdrichRaw = await zip.file("xl/richData/rdrichvalue.xml")?.async("string");
  const richRelRaw = await zip.file("xl/richData/richValueRel.xml")?.async("string");
  const richRelsRaw = await zip.file("xl/richData/_rels/richValueRel.xml.rels")?.async("string");

  if (metadataRaw && rdrichRaw && richRelRaw && richRelsRaw) {
    const metadataXml = xmlParser.parse(metadataRaw);
    const rdrichXml = xmlParser.parse(rdrichRaw);
    const richRelXml = xmlParser.parse(richRelRaw);
    const richRelsXml = xmlParser.parse(richRelsRaw);

    const richRelIdToMedia = new Map<string, string>();
    for (const rel of richRelsXml?.Relationships?.Relationship ?? []) {
      richRelIdToMedia.set(rel["@_Id"], normalizeZipTarget("xl/richData", rel["@_Target"]));
    }

    const relsOrder: string[] = (richRelXml?.richValueRels?.rel ?? []).map(
      (r: Record<string, string>) => r["@_r:id"]
    );
    const rvList = rdrichXml?.rvData?.rv ?? [];

    const futureBlocks = Array.isArray(metadataXml?.metadata?.futureMetadata)
      ? metadataXml.metadata.futureMetadata
      : metadataXml?.metadata?.futureMetadata
        ? [metadataXml.metadata.futureMetadata]
        : [];

    const xlRichBlock = futureBlocks.find(
      (fm: Record<string, unknown>) => fm["@_name"] === "XLRICHVALUE"
    );
    const bkList = xlRichBlock?.bk ?? [];

    for (let vmIdx = 0; vmIdx < bkList.length; vmIdx++) {
      const bk = bkList[vmIdx];
      const ext = bk?.extLst?.ext;
      const rvb = Array.isArray(ext) ? ext[0]?.["xlrd:rvb"] : ext?.["xlrd:rvb"];
      const rvIndex = Number(rvb?.["@_i"]);
      if (Number.isNaN(rvIndex) || !rvList[rvIndex]) continue;
      const vNodes = rvList[rvIndex].v ?? [];
      const relIndex = Number(vNodes[0]);
      const rId = relsOrder[relIndex];
      const mediaPath = rId ? richRelIdToMedia.get(rId) : undefined;
      if (mediaPath) {
        vmToMediaPath.set(vmIdx + 1, mediaPath);
      }
    }
  }

  const sheets = workbookXml?.workbook?.sheets?.sheet ?? [];
  for (const sheet of sheets) {
    const sheetName = String(sheet["@_name"]);
    const rId = String(sheet["@_r:id"]);
    const sheetPath = wbRelMap.get(rId);
    if (!sheetPath) continue;

    const sheetXmlRaw = await zip.file(sheetPath)?.async("string");
    if (!sheetXmlRaw) continue;
    const sheetXml = xmlParser.parse(sheetXmlRaw);

    const sheetFileName = sheetPath.split("/").pop() ?? "";
    const sheetDir = sheetPath.split("/").slice(0, -1).join("/");
    const sheetRelsPath = `${sheetDir}/_rels/${sheetFileName}.rels`;
    const sheetRelsRaw = await zip.file(sheetRelsPath)?.async("string");
    const sheetRelMap = new Map<string, string>();
    const drawingPaths: string[] = [];

    if (sheetRelsRaw) {
      const sheetRelsXml = xmlParser.parse(sheetRelsRaw);
      for (const rel of sheetRelsXml?.Relationships?.Relationship ?? []) {
        const target = normalizeZipTarget(sheetDir, rel["@_Target"]);
        sheetRelMap.set(rel["@_Id"], target);
        if (String(rel["@_Type"]).includes("/drawing")) {
          drawingPaths.push(target);
        }
      }
    }

    // 1. Checked form control checkboxes at (row, col)
    const checkedCoords = new Set<string>();
    const controlsContainer = sheetXml?.worksheet?.controls;
    if (controlsContainer) {
      const altList = controlsContainer["mc:AlternateContent"] ?? [];
      const directControls = controlsContainer.control ?? [];
      const allControls: Array<Record<string, unknown>> = [...directControls];

      for (const alt of altList) {
        const choice = alt?.["mc:Choice"];
        if (choice?.control) {
          if (Array.isArray(choice.control)) allControls.push(...choice.control);
          else allControls.push(choice.control);
        }
      }

      for (const ctrl of allControls) {
        const ctrlRid = String(ctrl["@_r:id"] ?? "");
        const ctrlPropPath = sheetRelMap.get(ctrlRid);
        if (!ctrlPropPath) continue;

        const ctrlPropRaw = await zip.file(ctrlPropPath)?.async("string");
        if (!ctrlPropRaw) continue;
        const isChecked = /checked\s*=\s*["']Checked["']/i.test(ctrlPropRaw);
        if (!isChecked) continue;

        const anchor = (ctrl.controlPr as Record<string, unknown> | undefined)?.anchor as
          | Record<string, unknown>
          | undefined;
        const from = anchor?.from as Record<string, unknown> | undefined;
        const col0 = Number(from?.["xdr:col"]);
        const row0 = Number(from?.["xdr:row"]);
        if (!Number.isNaN(col0) && !Number.isNaN(row0)) {
          checkedCoords.add(`${row0 + 1}:${col0 + 1}`);
        }
      }
    }
    sheetCheckboxes.set(sheetName, checkedCoords);

    // 2. Place-in-Cell images via vm attribute
    const imagesForSheet: Array<{ row: number; col: number; mediaPath: string; buffer: Buffer }> = [];
    const seenMediaPerCoord = new Set<string>();
    const rows = sheetXml?.worksheet?.sheetData?.row ?? [];
    for (const rowNode of rows) {
      const cells = rowNode?.c ?? [];
      for (const cNode of cells) {
        const vm = Number(cNode?.["@_vm"]);
        if (!vm || Number.isNaN(vm)) continue;
        const mediaPath = vmToMediaPath.get(vm);
        if (!mediaPath) continue;
        const { row, col } = parseCellRef(String(cNode["@_r"] ?? ""));
        if (!row || !col) continue;
        const mediaFile = zip.file(mediaPath);
        if (!mediaFile) continue;
        const buffer = await mediaFile.async("nodebuffer");
        seenMediaPerCoord.add(`${row}:${col}:${mediaPath}`);
        imagesForSheet.push({ row, col, mediaPath, buffer });
      }
    }

    // 3. Fallback for standard floating drawing images (<xdr:pic>)
    for (const drawingPath of drawingPaths) {
      const drawingRaw = await zip.file(drawingPath)?.async("string");
      if (!drawingRaw) continue;
      const drawingDir = drawingPath.split("/").slice(0, -1).join("/");
      const drawingFile = drawingPath.split("/").pop() ?? "";
      const drawingRelsRaw = await zip
        .file(`${drawingDir}/_rels/${drawingFile}.rels`)
        ?.async("string");
      if (!drawingRelsRaw) continue;

      const drawingRelMap = new Map<string, string>();
      const drawingRelsXml = xmlParser.parse(drawingRelsRaw);
      for (const rel of drawingRelsXml?.Relationships?.Relationship ?? []) {
        if (String(rel["@_Type"]).includes("/image")) {
          drawingRelMap.set(rel["@_Id"], normalizeZipTarget(drawingDir, rel["@_Target"]));
        }
      }

      const drawingXml = xmlParser.parse(drawingRaw);
      const wsDr = drawingXml?.["xdr:wsDr"];
      const anchors = [
        ...(wsDr?.["xdr:twoCellAnchor"] ?? []),
        ...(wsDr?.["xdr:oneCellAnchor"] ?? []),
      ];
      for (const anchor of anchors) {
        const pic = anchor?.["xdr:pic"];
        if (!pic) continue;
        const blipEmbed = pic?.["xdr:blipFill"]?.["a:blip"]?.["@_r:embed"];
        const mediaPath = blipEmbed ? drawingRelMap.get(String(blipEmbed)) : undefined;
        if (!mediaPath) continue;
        const from = anchor?.["xdr:from"];
        const col = Number(from?.["xdr:col"]) + 1;
        const row = Number(from?.["xdr:row"]) + 1;
        if (Number.isNaN(col) || Number.isNaN(row)) continue;
        const key = `${row}:${col}:${mediaPath}`;
        if (seenMediaPerCoord.has(key)) continue;
        const mediaFile = zip.file(mediaPath);
        if (!mediaFile) continue;
        const buffer = await mediaFile.async("nodebuffer");
        seenMediaPerCoord.add(key);
        imagesForSheet.push({ row, col, mediaPath, buffer });
      }
    }

    sheetImages.set(sheetName, imagesForSheet);
  }

  return { sheetCheckboxes, sheetImages };
}

function detectBlockColumns(ws: ExcelJS.Worksheet, startCol: number): {
  noCol: number;
  subNoCol: number;
  partNameCol: number;
  qtyCol: number;
  adaCol: number;
  tidakAdaCol: number;
  kondisiCol: number;
  catatanCol: number;
  metaLabelCol: number;
  metaValueCol: number;
} {
  let noCol = startCol;
  let subNoCol = startCol + 1;
  let partNameCol = startCol + 2;
  let qtyCol = startCol + 3;
  let adaCol = startCol + 4;
  let tidakAdaCol = startCol + 5;
  let kondisiCol = startCol + 6;
  let catatanCol = startCol + 7;

  let foundNo = false;
  let foundPart = false;
  let foundKondisi = false;
  let foundCatatan = false;
  let foundQty = false;
  let foundAda = false;
  let foundTidakAda = false;

  for (let c = startCol; c <= Math.min(ws.columnCount, startCol + 10); c++) {
    const c5 = ws.getCell(5, c);
    const c6 = ws.getCell(6, c);
    const r5 = (!c5.isMerged || c5.master === c5) ? cellText(c5).toLowerCase() : "";
    const r6 = (!c6.isMerged || c6.master === c6) ? cellText(c6).toLowerCase() : "";

    if (!foundNo && r5 === "no") {
      noCol = c;
      foundNo = true;
    } else if (!foundPart && r5.includes("part")) {
      partNameCol = c;
      foundPart = true;
    } else if (!foundKondisi && r5 === "kondisi") {
      kondisiCol = c;
      foundKondisi = true;
    } else if (!foundCatatan && r5 === "catatan") {
      catatanCol = c;
      foundCatatan = true;
    }

    if (!foundQty && r6 === "qty") {
      qtyCol = c;
      foundQty = true;
    } else if (!foundAda && r6 === "ada") {
      adaCol = c;
      foundAda = true;
    } else if (!foundTidakAda && r6.includes("tidak")) {
      tidakAdaCol = c;
      foundTidakAda = true;
    }
  }

  subNoCol = noCol + 1;

  let metaLabelCol = kondisiCol;
  let metaValueCol = catatanCol;
  for (let c = startCol; c <= Math.min(ws.columnCount, startCol + 10); c++) {
    const r2 = cellText(ws.getCell(2, c)).toLowerCase();
    if (r2.includes("region")) {
      metaLabelCol = c;
      metaValueCol = c + 1;
      break;
    }
  }

  return {
    noCol,
    subNoCol,
    partNameCol,
    qtyCol,
    adaCol,
    tidakAdaCol,
    kondisiCol,
    catatanCol,
    metaLabelCol,
    metaValueCol,
  };
}

export async function parsePumpWorkbook(
  fileBuffer: Buffer,
  options: ParseWorkbookOptions
): Promise<ParsedPumpRecord[]> {
  const zip = await JSZip.loadAsync(fileBuffer);
  const { sheetCheckboxes, sheetImages } = await extractXmlEnhancements(zip);

  const wb = new ExcelJS.Workbook();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await wb.xlsx.load(fileBuffer as any);

  const isPulWorkbook = options.fileName.toLowerCase().includes("pul");
  const records: ParsedPumpRecord[] = [];
  const usedCodesInWorkbook = new Set<string>();

  for (const ws of wb.worksheets) {
    const sheetName = ws.name.trim();
    if (isPulWorkbook && (sheetName.toLowerCase() === "contoh" || sheetName.toLowerCase() === "axial single")) {
      continue;
    }

    const startCols: number[] = [];
    for (let c = 1; c <= ws.columnCount; c++) {
      const cell1 = ws.getCell(1, c);
      if (cell1.isMerged && cell1.master !== cell1) continue;
      const title = cellText(cell1);
      if (title.toLowerCase().includes("form pemeriksaan")) {
        startCols.push(c);
      }
    }

    if (startCols.length === 0) continue;

    const checkedCoords = sheetCheckboxes.get(ws.name) ?? new Set<string>();
    const imagesOnSheet = sheetImages.get(ws.name) ?? [];
    const blockRecords: Array<{ startCol: number; record: ParsedPumpRecord }> = [];

    for (const startCol of startCols) {
      const formTitle = cellText(ws.getCell(1, startCol));
      const { code: pumpTypeCode, name: pumpTypeName } = normalizePumpType(formTitle);
      const cols = detectBlockColumns(ws, startCol);

      const rawRegion = cellText(ws.getCell(2, cols.metaValueCol));
      const rawKode = cellText(ws.getCell(3, cols.metaValueCol));
      const rawLokasi = cellText(ws.getCell(4, cols.metaValueCol));
      const rawMesin = cellText(ws.getCell(4, startCol));

      let pumpCode = normalizePumpCode(rawKode);
      if (isPulWorkbook && sheetName.includes("(") && sheetName.includes(")")) {
        const sheetCodeMatch = /\(([^)]+)\)/.exec(sheetName);
        if (sheetCodeMatch && usedCodesInWorkbook.has(pumpCode)) {
          pumpCode = normalizePumpCode(sheetCodeMatch[1]);
        }
      }

      if (!pumpCode) continue;
      usedCodesInWorkbook.add(pumpCode);

      const { code: regionCode, name: regionName } = normalizeRegionCodeAndName(rawRegion);
      const estateCode = options.defaultEstateCode
        ? options.defaultEstateCode.toUpperCase()
        : isPulWorkbook
          ? "PUL"
          : sheetName.toUpperCase();
      const blockCode = normalizeBlockCode(rawLokasi);
      const engineBrand = normalizeEngineBrand(rawMesin);

      const parts: ParsedPumpPart[] = [];
      let currentSectionCode = "";
      let currentSectionName = "";
      let sortOrder = 0;

      for (let r = 7; r <= ws.rowCount; r++) {
        const secVal = cellText(ws.getCell(r, cols.noCol));
        const subVal = cellText(ws.getCell(r, cols.subNoCol));
        const partVal = cellText(ws.getCell(r, cols.partNameCol));

        if (
          secVal.toLowerCase().startsWith("dokumentasi") ||
          subVal.toLowerCase().startsWith("dokumentasi") ||
          partVal.toLowerCase().startsWith("dokumentasi")
        ) {
          break;
        }
        if (!secVal && !subVal && !partVal) continue;

        if (secVal && /^[A-Z]$/i.test(secVal)) {
          currentSectionCode = secVal.toUpperCase();
          currentSectionName = partVal || currentSectionCode;
        }

        const itemNo = subVal && /^\d+$/.test(subVal) ? Number(subVal) : 0;
        const partName = itemNo === 0 ? currentSectionName : partVal;
        if (!partName) continue;

        const qtyText = cellText(ws.getCell(r, cols.qtyCol));
        const expectedQty = qtyText && /^\d+$/.test(qtyText) ? Number(qtyText) : 1;

        const checkedAda =
          checkedCoords.has(`${r}:${cols.adaCol}`) ||
          cellText(ws.getCell(r, cols.adaCol)) !== "";
        const checkedTidakAda =
          checkedCoords.has(`${r}:${cols.tidakAdaCol}`) ||
          cellText(ws.getCell(r, cols.tidakAdaCol)) !== "";

        const rawKondisi = cellText(ws.getCell(r, cols.kondisiCol));
        const rawCatatan = cellText(ws.getCell(r, cols.catatanCol));

        const inferred = inferItemCondition({
          checkedAda,
          checkedTidakAda,
          rawKondisi,
          rawCatatan,
        });

        sortOrder += 1;
        parts.push({
          sectionCode: currentSectionCode || "A",
          sectionName: currentSectionName || "UMUM",
          itemNo,
          partName,
          expectedQty,
          availability: inferred.availability,
          condition: inferred.condition,
          issuePresetLabel: inferred.issuePresetLabel,
          notes: inferred.notes,
          sortOrder,
        });
      }

      const unitStatus = inferUnitStatus(parts);

      blockRecords.push({
        startCol,
        record: {
          sheetName,
          pumpCode,
          pumpTypeCode,
          pumpTypeName,
          regionCode,
          regionName,
          estateCode,
          blockCode,
          engineBrand,
          unitStatus,
          parts,
          photos: [],
        },
      });
    }

    // Assign each image on the sheet to the rightmost pump block starting at or left of image.col
    for (const img of imagesOnSheet) {
      let targetBlock = blockRecords[0];
      for (const blk of blockRecords) {
        if (blk.startCol <= img.col) {
          targetBlock = blk;
        }
      }
      if (!targetBlock) continue;
      const baseName = img.mediaPath.split("/").pop() ?? `photo_${img.row}_${img.col}.jpg`;
      targetBlock.record.photos.push({
        fileName: `${targetBlock.record.pumpCode}_${baseName}`,
        mimeType: mimeTypeFromPath(img.mediaPath),
        buffer: img.buffer,
      });
    }

    for (const blk of blockRecords) {
      records.push(blk.record);
    }
  }

  return records;
}
