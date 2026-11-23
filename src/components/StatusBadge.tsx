import { CheckCircle2, AlertTriangle, XCircle } from "lucide-react";

export function UnitStatusBadge({ status }: { status: string }) {
  if (status === "aktif") {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-md border border-[#86EFAC] bg-[#DCFCE7] px-2.5 py-1 text-xs font-semibold text-[#166534]">
        <CheckCircle2 className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
        <span>Aktif</span>
      </span>
    );
  }
  if (status === "perlu_perbaikan") {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-md border border-[#FCD34D] bg-[#FEF3C7] px-2.5 py-1 text-xs font-semibold text-[#92400E]">
        <AlertTriangle className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
        <span>Perlu Perbaikan</span>
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 rounded-md border border-[#FCA5A5] bg-[#FEE2E2] px-2.5 py-1 text-xs font-semibold text-[#991B1B]">
      <XCircle className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
      <span>Rusak Total</span>
    </span>
  );
}

export function AvailabilityLabel({ value }: { value: string }) {
  if (value === "ada") {
    return (
      <span className="inline-flex items-center rounded border border-[#86EFAC] bg-[#DCFCE7] px-2 py-0.5 text-xs font-medium text-[#166534]">
        Ada
      </span>
    );
  }
  if (value === "tidak_lengkap") {
    return (
      <span className="inline-flex items-center rounded border border-[#FCD34D] bg-[#FEF3C7] px-2 py-0.5 text-xs font-medium text-[#92400E]">
        Tidak Lengkap
      </span>
    );
  }
  return (
    <span className="inline-flex items-center rounded border border-[#FCA5A5] bg-[#FEE2E2] px-2 py-0.5 text-xs font-medium text-[#991B1B]">
      Hilang
    </span>
  );
}

export function ConditionLabel({ value }: { value: string }) {
  if (value === "baik") {
    return (
      <span className="inline-flex items-center rounded border border-[#86EFAC] bg-[#DCFCE7] px-2 py-0.5 text-xs font-medium text-[#166534]">
        Baik
      </span>
    );
  }
  return (
    <span className="inline-flex items-center rounded border border-[#FCA5A5] bg-[#FEE2E2] px-2 py-0.5 text-xs font-medium text-[#991B1B]">
      Rusak
    </span>
  );
}
