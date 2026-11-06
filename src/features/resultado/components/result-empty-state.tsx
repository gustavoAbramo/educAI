import { RefreshCw } from "lucide-react";

export function ResultEmptyState({
  title,
  description,
  actionLabel,
  onAction,
  disabled,
}: {
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
  disabled?: boolean;
}) {
  return (
    <div className="rounded-2xl border border-dashed border-border bg-card/40 p-5 text-sm">
      <div className="font-medium text-foreground">{title}</div>
      <div className="mt-2 leading-6 text-muted-foreground">{description}</div>
      {actionLabel && onAction ? (
        <button
          type="button"
          onClick={onAction}
          disabled={disabled}
          className="mt-4 inline-flex h-9 items-center justify-center gap-2 rounded-lg border border-border bg-background px-3 text-xs font-medium transition hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50"
        >
          <RefreshCw className="h-3.5 w-3.5" />
          {actionLabel}
        </button>
      ) : null}
    </div>
  );
}
