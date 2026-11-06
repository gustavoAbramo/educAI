import { stripMarkdownMarker } from "../model/materials";

export function MarkdownishText({ content, emptyText }: { content: string; emptyText: string }) {
  const lines = content
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (!lines.length) {
    return <p className="text-sm text-muted-foreground">{emptyText}</p>;
  }

  return (
    <div className="space-y-3 text-[15px] leading-relaxed">
      {lines.map((line, index) => {
        if (/^#+\s+/.test(line)) {
          return (
            <div key={`${line}-${index}`} className="pt-1 text-sm font-semibold text-foreground">
              {line.replace(/^#+\s*/, "")}
            </div>
          );
        }

        if (/^[-*]\s+/.test(line) || /^\d+[.)]\s+/.test(line)) {
          return (
            <div key={`${line}-${index}`} className="flex gap-2 text-sm">
              <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
              <span>{stripMarkdownMarker(line)}</span>
            </div>
          );
        }

        return <p key={`${line}-${index}`}>{line}</p>;
      })}
    </div>
  );
}
