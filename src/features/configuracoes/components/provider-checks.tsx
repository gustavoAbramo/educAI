import type { ProviderRuntimeCheck } from "@/lib/voice-intelligence";
import { checkTone } from "../model/status-labels";

export function ProviderChecks({ checks }: { checks: ProviderRuntimeCheck[] }) {
  if (!checks.length) {
    return (
      <div className="text-xs text-muted-foreground">
        Execute o teste de conexao para carregar o checklist operacional.
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {checks.map((item) => (
        <div
          key={item.id}
          className={`rounded-lg border px-3 py-2 text-xs leading-relaxed ${checkTone(item.status)}`}
        >
          <div className="font-medium">{item.label}</div>
          <div className="mt-0.5 opacity-90">{item.detail}</div>
        </div>
      ))}
    </div>
  );
}
