import { createFileRoute } from "@tanstack/react-router";
import { pageHead } from "@/lib/route-access";
import { Historico } from "@/features/historico/historico-page";

export const Route = createFileRoute("/historico")({
  head: () => pageHead("/historico"),
  component: Historico,
});
