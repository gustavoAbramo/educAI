import { createFileRoute } from "@tanstack/react-router";
import { AuthForm } from "@/components/auth-form";
import { redirectSignedIn, validateAuthSearch } from "@/lib/auth-session";

export const Route = createFileRoute("/login")({
  validateSearch: validateAuthSearch,
  beforeLoad: redirectSignedIn,
  head: () => ({ meta: [{ title: "Entrar | educAI" }] }),
  component: Login,
});

function Login() {
  const { voltar } = Route.useSearch();
  return <AuthForm mode="login" voltar={voltar} />;
}
