import { createFileRoute, redirect } from "@tanstack/react-router";

// A landing passou a ser a home. Mantemos /landing como atalho para links antigos.
export const Route = createFileRoute("/landing")({
  beforeLoad: () => {
    throw redirect({ to: "/" });
  },
});
