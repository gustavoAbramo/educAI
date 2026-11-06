import { createFileRoute } from "@tanstack/react-router";
import { pageHead } from "@/lib/route-access";
import { Processando } from "@/features/processando/processando-page";

export const Route = createFileRoute("/processando")({
  head: () => pageHead("/processando"),
  component: Processando,
  validateSearch: (search: Record<string, unknown>) => ({
    sessionId: typeof search.sessionId === "string" ? search.sessionId : undefined,
  }),
});
