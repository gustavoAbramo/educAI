import { createFileRoute } from "@tanstack/react-router";
import { pageHead } from "@/lib/route-access";
import { AjudaPage } from "@/features/ajuda/ajuda-page";

export const Route = createFileRoute("/ajuda")({
  head: () => pageHead("/ajuda"),
  component: AjudaPage,
});
