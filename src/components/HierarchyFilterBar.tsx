"use client";

import { useEffect, useRef, useState } from "react";

export interface MasterCompany {
  id: number;
  code: string;
  name: string;
  isActive: boolean;
}
export interface MasterRegion {
  id: number;
  companyId: number;
  code: string;
  name: string;
  isActive: boolean;
}
export interface MasterEstate {
  id: number;
  regionId: number;
  code: string;
  name: string;
  sortOrder: number;
  isActive: boolean;
}
export interface MasterBlock {
  id: number;
  estateId: number;
  code: string;
  name: string;
  isActive: boolean;
}
export interface MasterPumpType {
  id: number;
  code: string;
  name: string;
  description?: string | null;
  isActive: boolean;
}
export interface MasterPumpTypePart {
  id: number;
  pumpTypeId: number;
  sectionCode: string;
  sectionName: string;
  itemNo: number;
  partName: string;
  defaultQty: number;
  sortOrder: number;
  isActive: boolean;
}
export interface MasterEngineBrand {
  id: number;
  name: string;
  isActive: boolean;
}
export interface MasterIssuePreset {
  id: number;
  label: string;
  defaultAvailability: "ada" | "tidak_lengkap" | "hilang";
  defaultCondition: "baik" | "rusak";
  sortOrder: number;
  isActive: boolean;
}

export interface MasterTreeData {
  companies: MasterCompany[];
  regions: MasterRegion[];
  estates: MasterEstate[];
  blocks: MasterBlock[];
  pumpTypes: MasterPumpType[];
  pumpTypeParts: MasterPumpTypePart[];
  engineBrands: MasterEngineBrand[];
  issuePresets: MasterIssuePreset[];
}

export interface FilterValues {
  companyId: string;
  regionId: string;
  estateId: string;
  blockId: string;
  pumpTypeId: string;
  status: string;
  search: string;
}

export function HierarchyFilterBar({
  master,
  values,
  onChange,
  showSearch = true,
  showStatus = true,
}: {
  master: MasterTreeData;
  values: FilterValues;
  onChange: (next: FilterValues) => void;
  showSearch?: boolean;
  showStatus?: boolean;
}) {
  const [searchDraft, setSearchDraft] = useState(values.search);
  const latestValuesRef = useRef(values);
  latestValuesRef.current = values;

  useEffect(() => {
    setSearchDraft(values.search);
  }, [values.search]);

  useEffect(() => {
    if (searchDraft === latestValuesRef.current.search) return;
    const timer = setTimeout(() => {
      onChange({ ...latestValuesRef.current, search: searchDraft });
    }, 250);
    return () => clearTimeout(timer);
  }, [searchDraft, onChange]);
  const filteredRegions = values.companyId
    ? master.regions.filter((r) => String(r.companyId) === values.companyId)
    : master.regions;

  const regionIds = new Set(filteredRegions.map((r) => r.id));
  const filteredEstates = values.regionId
    ? master.estates.filter((e) => String(e.regionId) === values.regionId)
    : master.estates.filter((e) => regionIds.has(e.regionId));

  const estateIds = new Set(filteredEstates.map((e) => e.id));
  const filteredBlocks = values.estateId
    ? master.blocks.filter((b) => String(b.estateId) === values.estateId)
    : master.blocks.filter((b) => estateIds.has(b.estateId));

  function updateField(field: keyof FilterValues, val: string) {
    const next = { ...values, [field]: val };
    if (field === "companyId") {
      next.regionId = "";
      next.estateId = "";
      next.blockId = "";
    } else if (field === "regionId") {
      next.estateId = "";
      next.blockId = "";
    } else if (field === "estateId") {
      next.blockId = "";
    }
    onChange(next);
  }

  function resetAll() {
    setSearchDraft("");
    onChange({
      companyId: "",
      regionId: "",
      estateId: "",
      blockId: "",
      pumpTypeId: "",
      status: "",
      search: "",
    });
  }

  return (
    <section
      aria-label="Filter data pompa"
      className="rounded-lg border border-field-border bg-field-surface p-4"
    >
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <label htmlFor="filter-pt" className="mb-1 block text-xs font-semibold text-field-muted">
            PT / Perusahaan
          </label>
          <select
            id="filter-pt"
            value={values.companyId}
            onChange={(e) => updateField("companyId", e.target.value)}
            className="min-h-[44px] w-full rounded-md border border-field-border bg-white px-3 text-sm text-field-ink"
          >
            <option value="">Semua PT</option>
            {master.companies.map((c) => (
              <option key={c.id} value={String(c.id)}>
                {c.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label
            htmlFor="filter-region"
            className="mb-1 block text-xs font-semibold text-field-muted"
          >
            Region / Wilayah
          </label>
          <select
            id="filter-region"
            value={values.regionId}
            onChange={(e) => updateField("regionId", e.target.value)}
            className="min-h-[44px] w-full rounded-md border border-field-border bg-white px-3 text-sm text-field-ink"
          >
            <option value="">Semua Region</option>
            {filteredRegions.map((r) => (
              <option key={r.id} value={String(r.id)}>
                {r.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label
            htmlFor="filter-estate"
            className="mb-1 block text-xs font-semibold text-field-muted"
          >
            Estate
          </label>
          <select
            id="filter-estate"
            value={values.estateId}
            onChange={(e) => updateField("estateId", e.target.value)}
            className="min-h-[44px] w-full rounded-md border border-field-border bg-white px-3 text-sm text-field-ink"
          >
            <option value="">Semua Estate</option>
            {filteredEstates.map((es) => (
              <option key={es.id} value={String(es.id)}>
                {es.code}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label
            htmlFor="filter-block"
            className="mb-1 block text-xs font-semibold text-field-muted"
          >
            Block / Lokasi
          </label>
          <select
            id="filter-block"
            value={values.blockId}
            onChange={(e) => updateField("blockId", e.target.value)}
            className="min-h-[44px] w-full rounded-md border border-field-border bg-white px-3 text-sm text-field-ink"
          >
            <option value="">Semua Block</option>
            {filteredBlocks.map((b) => (
              <option key={b.id} value={String(b.id)}>
                {b.code}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label
            htmlFor="filter-type"
            className="mb-1 block text-xs font-semibold text-field-muted"
          >
            Jenis Pompa
          </label>
          <select
            id="filter-type"
            value={values.pumpTypeId}
            onChange={(e) => updateField("pumpTypeId", e.target.value)}
            className="min-h-[44px] w-full rounded-md border border-field-border bg-white px-3 text-sm text-field-ink"
          >
            <option value="">Semua Jenis</option>
            {master.pumpTypes.map((pt) => (
              <option key={pt.id} value={String(pt.id)}>
                {pt.name}
              </option>
            ))}
          </select>
        </div>

        {showStatus && (
          <div>
            <label
              htmlFor="filter-status"
              className="mb-1 block text-xs font-semibold text-field-muted"
            >
              Status Unit
            </label>
            <select
              id="filter-status"
              value={values.status}
              onChange={(e) => updateField("status", e.target.value)}
              className="min-h-[44px] w-full rounded-md border border-field-border bg-white px-3 text-sm text-field-ink"
            >
              <option value="">Semua Status</option>
              <option value="aktif">Aktif</option>
              <option value="perlu_perbaikan">Perlu Perbaikan</option>
              <option value="rusak_total">Rusak Total</option>
            </select>
          </div>
        )}

        {showSearch && (
          <div>
            <label
              htmlFor="filter-search"
              className="mb-1 block text-xs font-semibold text-field-muted"
            >
              Cari Kode Pompa / Block
            </label>
            <input
              id="filter-search"
              type="search"
              value={searchDraft}
              onChange={(e) => setSearchDraft(e.target.value)}
              placeholder="Contoh: R1-AD-17"
              className="min-h-[44px] w-full rounded-md border border-field-border bg-white px-3 text-sm text-field-ink"
            />
          </div>
        )}

        <div className="flex items-end">
          <button
            type="button"
            onClick={resetAll}
            className="min-h-[44px] w-full rounded-md border border-field-border bg-field-bg px-4 text-sm font-medium text-field-ink hover:bg-[#EAEFEA]"
          >
            Reset Filter
          </button>
        </div>
      </div>
    </section>
  );
}
