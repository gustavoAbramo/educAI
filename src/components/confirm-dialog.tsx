import { useEffect } from "react";
import { AlertTriangle, X } from "lucide-react";
import { cn } from "@/lib/utils";

type Props = {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: "default" | "destructive";
  icon?: React.ReactNode;
};

export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  description,
  confirmLabel = "Confirmar",
  cancelLabel = "Cancelar",
  tone = "default",
  icon,
}: Props) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  const Icon = icon ?? <AlertTriangle className="h-5 w-5" />;

  return (
    <div className="fixed inset-0 z-[100] grid place-items-center p-4 animate-fade-in">
      <div className="absolute inset-0 bg-foreground/30 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-md rounded-2xl border border-border bg-card shadow-card p-5 animate-scale-in">
        <button
          onClick={onClose}
          className="absolute top-3 right-3 h-7 w-7 grid place-items-center rounded-md hover:bg-muted text-muted-foreground"
          aria-label="Fechar"
        >
          <X className="h-4 w-4" />
        </button>

        <div className="flex items-start gap-3">
          <div
            className={cn(
              "h-10 w-10 rounded-xl grid place-items-center shrink-0",
              tone === "destructive"
                ? "bg-destructive/10 text-destructive"
                : "bg-primary/10 text-primary",
            )}
          >
            {Icon}
          </div>
          <div className="min-w-0 flex-1 pt-1">
            <h2 className="text-base font-semibold tracking-tight">{title}</h2>
            {description && (
              <p className="mt-1 text-sm text-muted-foreground leading-relaxed">{description}</p>
            )}
          </div>
        </div>

        <div className="mt-5 flex justify-end gap-2">
          <button
            onClick={onClose}
            className="rounded-lg border border-border bg-background px-3 h-9 text-sm hover:bg-muted active:scale-95 transition"
          >
            {cancelLabel}
          </button>
          <button
            onClick={() => {
              onConfirm();
              onClose();
            }}
            className={cn(
              "rounded-lg px-3 h-9 text-sm font-medium active:scale-95 transition shadow-soft",
              tone === "destructive"
                ? "bg-destructive text-destructive-foreground hover:opacity-90"
                : "bg-gradient-brand text-white hover:opacity-95",
            )}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
