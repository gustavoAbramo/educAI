import { createFileRoute } from "@tanstack/react-router";
import { Landing } from "@/features/landing/landing-page";
import { redirectSignedIn } from "@/lib/auth-session";

export const Route = createFileRoute("/")({
  beforeLoad: redirectSignedIn,
  head: () => ({ meta: [{ title: "educAI — Sua aula vira material pronto" }] }),
  component: Landing,
});
