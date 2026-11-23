import { AlertCircle, Inbox, Loader2 } from "lucide-react";

export function LoadingState({ message = "Memuat data..." }: { message?: string }) {
  return (
    <div
      role="status"
      aria-live="polite"
      className="flex flex-col items-center justify-center rounded-lg border border-field-border bg-field-surface px-6 py-12 text-center"
    >
      <Loader2 className="h-7 w-7 animate-spin text-field-accent" aria-hidden="true" />
      <p className="mt-3 text-sm font-medium text-field-muted">{message}</p>
    </div>
  );
}

export function ErrorState({
  title = "Gagal memuat data",
  message,
  onRetry,
}: {
  title?: string;
  message: string;
  onRetry?: () => void;
}) {
  return (
    <div
      role="alert"
      className="rounded-lg border border-[#FCA5A5] bg-[#FEF2F2] p-5 text-[#991B1B]"
    >
      <div className="flex items-start gap-3">
        <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
        <div className="min-w-0 flex-1">
          <h2 className="text-sm font-semibold">{title}</h2>
          <p className="mt-1 text-sm">{message}</p>
          {onRetry && (
            <button
              type="button"
              onClick={onRetry}
              className="mt-3 inline-flex min-h-[44px] items-center rounded-md border border-[#991B1B] bg-white px-4 py-2 text-sm font-semibold text-[#991B1B] hover:bg-[#FEE2E2]"
            >
              Coba Lagi
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export function EmptyState({
  title,
  description,
  actionLabel,
  onAction,
}: {
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-field-border bg-field-surface px-6 py-12 text-center">
      <Inbox className="h-8 w-8 text-field-muted" aria-hidden="true" />
      <h2 className="mt-3 text-base font-semibold text-field-ink">{title}</h2>
      <p className="mt-1 max-w-md text-sm text-field-muted">{description}</p>
      {actionLabel && onAction && (
        <button
          type="button"
          onClick={onAction}
          className="mt-4 inline-flex min-h-[44px] items-center rounded-md bg-field-accent px-4 py-2 text-sm font-semibold text-white hover:bg-field-accent-hover"
        >
          {actionLabel}
        </button>
      )}
    </div>
  );
}
