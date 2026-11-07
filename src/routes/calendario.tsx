import { createFileRoute } from "@tanstack/react-router";
import { pageHead } from "@/lib/route-access";
import { CalendarioPage } from "@/features/calendario/calendario-page";

export const Route = createFileRoute("/calendario")({
  head: () => pageHead("/calendario"),
  component: CalendarioPage,
});
