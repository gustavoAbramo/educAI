import { createFileRoute } from "@tanstack/react-router";
import { AuthForm } from "@/components/auth-form";
import { redirectSignedIn, validateAuthSearch } from "@/lib/auth-session";

export const Route = createFileRoute("/cadastro")({
  validateSearch: validateAuthSearch,
  beforeLoad: redirectSignedIn,
  head: () => ({ meta: [{ title: "Criar conta | educAI" }] }),
  component: Cadastro,
});

function Cadastro() {
  const { voltar } = Route.useSearch();
  return <AuthForm mode="register" voltar={voltar} />;
}
