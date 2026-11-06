import { createFileRoute } from "@tanstack/react-router";
import { Landing } from "@/features/landing/landing-page";

export const Route = createFileRoute("/")({
  head: () => ({ meta: [{ title: "educAI — Sua aula vira material pronto" }] }),
  component: Landing,
});
