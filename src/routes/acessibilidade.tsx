import { createFileRoute } from "@tanstack/react-router";
import { AccessibilityPage } from "@/features/accessibility/accessibility-page";

export const Route = createFileRoute("/acessibilidade")({
  head: () => ({ meta: [{ title: "Acessibilidade | educAI" }] }),
  component: AccessibilityPage,
});
