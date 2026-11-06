import { createFileRoute } from "@tanstack/react-router";
import { pageHead } from "@/lib/route-access";
import { NovaAula } from "@/features/nova-aula/nova-aula-page";

export const Route = createFileRoute("/nova-aula")({
  head: () => pageHead("/nova-aula"),
  component: NovaAula,
});
