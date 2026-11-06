import { createFileRoute } from "@tanstack/react-router";
import { pageHead } from "@/lib/route-access";
import { Assistente } from "@/features/assistente/assistente-page";

export const Route = createFileRoute("/assistente")({
  head: () => pageHead("/assistente"),
  component: Assistente,
});
