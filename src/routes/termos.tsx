import { createFileRoute } from "@tanstack/react-router";
import { Termos } from "@/features/termos/termos-page";

export const Route = createFileRoute("/termos")({
  head: () => ({ meta: [{ title: "educAI — Termos de Uso e Privacidade" }] }),
  component: Termos,
});
