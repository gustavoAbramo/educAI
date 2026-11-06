import { Link } from "@tanstack/react-router";
import { ArrowRight, Eye, EyeOff, GraduationCap } from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";
import "../routes/login.css";

const defaultDestination = "/painel";

function localDestination(value: unknown) {
  if (typeof value !== "string" || !value.startsWith("/") || value.length > 2048) {
    return defaultDestination;
  }
  const base = "https://educai.invalid";
  if (!URL.canParse(value, base)) return defaultDestination;
  const url = new URL(value, base);
  if (
    url.origin !== base ||
    url.pathname.startsWith("//") ||
    /^\/(login|cadastro)\/*$/.test(url.pathname)
  ) {
    return defaultDestination;
  }
  return `${url.pathname}${url.search}${url.hash}`;
}

export function AuthForm({ mode, voltar }: { mode: "login" | "register"; voltar?: string }) {
  const registering = mode === "register";
  const endpoint = `/api/auth/${mode}`;
  const actionError = registering ? "Não foi possível criar a conta." : "Não foi possível entrar.";
  const [showPassword, setShowPassword] = useState(false);
  const [ready, setReady] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => setReady(true), []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    const form = new FormData(event.currentTarget);
    const password = form.get("password");
    if (registering && password !== form.get("confirmPassword")) {
      setError("As senhas precisam ser iguais.");
      return;
    }
    setError("");
    setPending(true);
    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email: form.get("email"), password }),
      });
      if (response.ok) {
        window.location.replace(localDestination(voltar));
        return;
      }
      const payload = await response.json();
      setError(payload.error?.message ?? `${actionError} Tente novamente.`);
    } catch {
      setError(`${actionError} Verifique sua conexão e tente novamente.`);
    }
    setPending(false);
  }

  return (
    <main className="login-page">
      <div className="login-card">
        <div className="login-panel">
          <Link to="/" className="login-brand" aria-label="Conheça o educAI">
            <span className="login-mark">
              <GraduationCap size={19} strokeWidth={1.7} aria-hidden />
            </span>
            educAI
          </Link>

          <section className="login-content" aria-labelledby="login-title">
            <h1 id="login-title">{registering ? "Crie sua conta" : "Boas-vindas de volta!"}</h1>
            <p className="login-intro">
              {registering
                ? "Organize suas aulas e materiais em um só lugar."
                : "Entre para acessar suas aulas e materiais."}
            </p>

            <form method="post" action={endpoint} onSubmit={submit} className="login-form">
              <label htmlFor="login-email">E-mail</label>
              <input
                id="login-email"
                name="email"
                type="email"
                autoComplete="username"
                maxLength={254}
                placeholder="voce@exemplo.com"
                required
              />

              <label htmlFor="login-password">Senha</label>
              <div className="login-password">
                <input
                  id="login-password"
                  name="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete={registering ? "new-password" : "current-password"}
                  minLength={registering ? 12 : undefined}
                  maxLength={256}
                  placeholder="Digite sua senha"
                  aria-describedby={registering ? "password-hint" : undefined}
                  required
                />
                <button
                  type="button"
                  aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
                  onClick={() => setShowPassword((visible) => !visible)}
                >
                  {showPassword ? <EyeOff size={17} aria-hidden /> : <Eye size={17} aria-hidden />}
                </button>
              </div>

              {registering && (
                <>
                  <p id="password-hint" className="login-hint">
                    Use pelo menos 12 caracteres.
                  </p>
                  <label htmlFor="confirm-password">Confirme a senha</label>
                  <input
                    id="confirm-password"
                    name="confirmPassword"
                    type="password"
                    autoComplete="new-password"
                    minLength={12}
                    maxLength={256}
                    placeholder="Digite a senha novamente"
                    required
                  />
                </>
              )}

              {error && (
                <p className="login-error" role="alert">
                  {error}
                </p>
              )}
              <button className="login-submit" type="submit" disabled={!ready || pending}>
                {registering
                  ? pending
                    ? "Criando conta…"
                    : "Criar conta"
                  : pending
                    ? "Entrando…"
                    : "Entrar"}
                <ArrowRight size={16} aria-hidden />
              </button>
            </form>
            <p className="login-switch">
              {registering ? "Já tem uma conta?" : "Ainda não tem uma conta?"}{" "}
              <Link to={registering ? "/login" : "/cadastro"} search={{ voltar }}>
                {registering ? "Entrar" : "Cadastre-se"}
              </Link>
            </p>
          </section>

          <nav className="login-footer" aria-label="Informações">
            <Link to="/">Sobre o educAI</Link>
            <Link to="/termos">Termos</Link>
            <Link to="/termos" hash="privacidade">
              Privacidade
            </Link>
          </nav>
        </div>
        <div className="login-art" aria-hidden="true" />
      </div>
    </main>
  );
}
