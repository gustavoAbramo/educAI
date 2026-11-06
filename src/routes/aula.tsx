import { createFileRoute } from "@tanstack/react-router";
import { pageHead } from "@/lib/route-access";
import { Aula } from "@/features/aula/aula-page";

export const Route = createFileRoute("/aula")({
  head: () => pageHead("/aula"),
  component: Aula,
  validateSearch: (search: Record<string, unknown>) => ({
    sessionId: typeof search.sessionId === "string" ? search.sessionId : undefined,
  }),
});
