import { createFileRoute } from "@tanstack/react-router";
import { pageHead } from "@/lib/route-access";
import { PerfilPage } from "@/features/perfil/perfil-page";

export const Route = createFileRoute("/perfil")({
  head: () => pageHead("/perfil"),
  component: PerfilPage,
});
