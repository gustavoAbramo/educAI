import { Resultado } from "@/features/resultado/resultado-page";
import { createFileRoute } from "@tanstack/react-router";
import { pageHead } from "@/lib/route-access";

export const Route = createFileRoute("/resultado")({
  head: () => pageHead("/resultado"),
  component: Resultado,
  validateSearch: (search: Record<string, unknown>) => ({
    sessionId: typeof search.sessionId === "string" ? search.sessionId : undefined,
  }),
});
