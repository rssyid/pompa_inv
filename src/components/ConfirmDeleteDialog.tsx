"use client";

import { useEffect, useId, useState } from "react";
import { AlertTriangle, X } from "lucide-react";

export function ConfirmDeleteDialog({
  title,
  description,
  confirmLabel = "Hapus Permanen",
  onClose,
  onConfirm,
}: {
  title: string;
  description: string;
  confirmLabel?: string;
  onClose: () => void;
  onConfirm: () => Promise<void>;
}) {
  const titleId = useId();
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape" && !deleting) {
        onClose();
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [deleting, onClose]);

  async function handleConfirm() {
    setDeleting(true);
    setError(null);
    try {
      await onConfirm();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal menghapus data.");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      onClick={() => {
        if (!deleting) onClose();
      }}
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/45 p-0 sm:items-center sm:p-4"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="max-h-[92vh] w-full overflow-y-auto rounded-t-xl border border-field-border bg-field-surface shadow-xl sm:max-w-md sm:rounded-xl"
      >
        <div className="flex items-start justify-between gap-3 border-b border-field-border px-4 py-3.5 sm:px-5">
          <div className="flex items-center gap-2.5">
            <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-[#FCA5A5] bg-[#FEE2E2] text-[#991B1B]">
              <AlertTriangle className="h-4 w-4" aria-hidden="true" />
            </span>
            <h2 id={titleId} className="text-base font-bold text-field-ink">
              {title}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={deleting}
            aria-label="Tutup dialog konfirmasi"
            className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-md border border-field-border bg-field-bg text-field-ink hover:bg-[#EAEFEA] disabled:opacity-50"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>

        <div className="space-y-4 p-4 sm:p-5">
          <p className="text-sm text-field-ink">{description}</p>

          {error && (
            <div
              role="alert"
              className="rounded-md border border-[#FCA5A5] bg-[#FEE2E2] px-3 py-2.5 text-xs font-semibold text-[#991B1B]"
            >
              {error}
            </div>
          )}

          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={onClose}
              disabled={deleting}
              className="min-h-[44px] rounded-md border border-field-border bg-field-bg px-4 text-sm font-semibold text-field-ink hover:bg-[#EAEFEA] disabled:opacity-50"
            >
              Batal
            </button>
            <button
              type="button"
              onClick={handleConfirm}
              disabled={deleting}
              className="min-h-[44px] rounded-md bg-[#B91C1C] px-4 text-sm font-semibold text-white hover:bg-[#991B1B] disabled:opacity-60"
            >
              {deleting ? "Menghapus..." : confirmLabel}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
