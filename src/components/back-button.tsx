import { Link } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { cn } from "@/lib/utils";

type Props = {
  to?: string;
  label?: string;
  className?: string;
};

export function BackButton({ to = "/", label = "Voltar", className }: Props) {
  return (
    <Link
      to={to}
      className={cn(
        "group inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-2.5 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-colors shadow-soft",
        className,
      )}
    >
      <ArrowLeft className="h-3.5 w-3.5 transition-transform group-hover:-translate-x-0.5" />
      {label}
    </Link>
  );
}
