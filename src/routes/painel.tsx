import { createFileRoute } from "@tanstack/react-router";
import { pageHead } from "@/lib/route-access";
import { Painel } from "@/features/painel/painel-page";

export const Route = createFileRoute("/painel")({
  head: () => pageHead("/painel"),
  component: Painel,
});
