import { createFileRoute } from "@tanstack/react-router";
import { pageHead } from "@/lib/route-access";
import { SettingsPage } from "@/features/configuracoes/settings-page";

export const Route = createFileRoute("/configuracoes")({
  head: () => pageHead("/configuracoes"),
  component: SettingsPage,
});
