import { cn } from "@/lib/utils";

type Props = {
  label: string;
  shortcut?: string;
  side?: "top" | "bottom" | "left" | "right";
  className?: string;
  children: React.ReactNode;
};

/** Lightweight CSS-only tooltip (group-hover). Good for desktop feel. */
export function Tooltip({ label, shortcut, side = "bottom", className, children }: Props) {
  const pos = {
    top: "bottom-full mb-2 left-1/2 -translate-x-1/2",
    bottom: "top-full mt-2 left-1/2 -translate-x-1/2",
    left: "right-full mr-2 top-1/2 -translate-y-1/2",
    right: "left-full ml-2 top-1/2 -translate-y-1/2",
  }[side];

  return (
    <span className={cn("relative inline-flex group", className)}>
      {children}
      <span
        role="tooltip"
        className={cn(
          "pointer-events-none absolute z-50 whitespace-nowrap rounded-md bg-foreground text-background px-2 py-1 text-[11px] font-medium shadow-card opacity-0 scale-95 transition-all duration-150 group-hover:opacity-100 group-hover:scale-100",
          pos,
        )}
      >
        {label}
        {shortcut && (
          <span className="ml-1.5 inline-block rounded bg-background/15 px-1 text-[10px] font-mono">
            {shortcut}
          </span>
        )}
      </span>
    </span>
  );
}
