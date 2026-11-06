import { Link } from "@tanstack/react-router";
import { ArrowRight, GraduationCap } from "lucide-react";
import { useEffect, useRef, useState, type FormEvent } from "react";
import {
  minimumPasswordLength,
  maximumPasswordLength,
  passwordProblem,
} from "@/lib/password-policy";
import { localDestination } from "./auth-destination";
import { PasswordField } from "./password-field";
import { PasswordStrength } from "./password-strength";
import "./auth.css";

type Field = "email" | "password" | "confirmPassword" | "terms";
type FieldErrors = Partial<Record<Field, string>>;

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
// Ordem em que o foco procura o primeiro campo com erro.
const fieldOrder: Field[] = ["email", "password", "confirmPassword", "terms"];
const fieldIds: Record<Field, string> = {
  email: "login-email",
  password: "login-password",
  confirmPassword: "confirm-password",
  terms: "accept-terms",
};

function validate(
  registering: boolean,
  values: { email: string; password: string; confirmPassword: string; terms: boolean },
): FieldErrors {
  const errors: FieldErrors = {};
  const email = values.email.trim();
  if (!email) errors.email = "Informe seu e-mail.";
  else if (!emailPattern.test(email))
    errors.email = "Informe um e-mail válido, como voce@exemplo.com.";

  if (!values.password) errors.password = "Informe sua senha.";
  else if (registering) {
    const problem = passwordProblem(values.password, email);
    if (problem) errors.password = `A senha precisa cumprir: ${problem.label.toLowerCase()}.`;
  }

  if (registering) {
    if (!values.confirmPassword) errors.confirmPassword = "Confirme a senha.";
    else if (values.confirmPassword !== values.password) {
      errors.confirmPassword = "As senhas precisam ser iguais.";
    }
    if (!values.terms) errors.terms = "Aceite os termos para criar a conta.";
  }
  return errors;
}

// Leva o erro do servidor para o campo certo, quando ele se refere a um campo.
function fieldForServerError(code?: string): Field | undefined {
  if (code === "EMAIL_IN_USE") return "email";
  if (code === "WEAK_PASSWORD") return "password";
  return undefined;
}

export function AuthForm({ mode, voltar }: { mode: "login" | "register"; voltar?: string }) {
  const registering = mode === "register";
  const endpoint = `/api/auth/${mode}`;
  const actionError = registering ? "Não foi possível criar a conta." : "Não foi possível entrar.";
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [terms, setTerms] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [ready, setReady] = useState(false);
  const [pending, setPending] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [error, setError] = useState("");
  const [retryIn, setRetryIn] = useState(0);
  const [emailInUse, setEmailInUse] = useState(false);
  const errorRef = useRef<HTMLParagraphElement>(null);

  useEffect(() => setReady(true), []);

  // Contagem regressiva quando o servidor pede para aguardar (429).
  useEffect(() => {
    if (retryIn <= 0) return;
    const timer = window.setTimeout(() => setRetryIn((seconds) => seconds - 1), 1000);
    return () => window.clearTimeout(timer);
  }, [retryIn]);

  function focusFirstError(errors: FieldErrors) {
    const field = fieldOrder.find((name) => errors[name]);
    if (field) document.getElementById(fieldIds[field])?.focus();
  }

  // Revalida so o campo que ja mostrava erro, para nao acusar enquanto a pessoa digita.
  function clearFieldError(field: Field) {
    if (fieldErrors[field]) setFieldErrors(({ [field]: _removed, ...rest }) => rest);
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending || retryIn > 0) return;
    const errors = validate(registering, { email, password, confirmPassword, terms });
    setFieldErrors(errors);
    if (Object.keys(errors).length) {
      setError("");
      focusFirstError(errors);
      return;
    }
    setError("");
    setEmailInUse(false);
    setPending(true);
    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email: email.trim(), password }),
      });
      if (response.ok) {
        window.location.replace(localDestination(voltar));
        return;
      }
      const payload = await response.json().catch(() => ({}));
      const message: string = payload.error?.message ?? `${actionError} Tente novamente.`;
      const field = fieldForServerError(payload.error?.code);
      setEmailInUse(payload.error?.code === "EMAIL_IN_USE");
      if (response.status === 429) {
        setRetryIn(Math.min(Number(response.headers.get("retry-after")) || 30, 600));
      }
      if (field) {
        const next = { [field]: message };
        setFieldErrors(next);
        focusFirstError(next);
      } else {
        setError(message);
        requestAnimationFrame(() => errorRef.current?.focus());
      }
    } catch {
      setError(`${actionError} Verifique sua conexão e tente novamente.`);
      requestAnimationFrame(() => errorRef.current?.focus());
    }
    setPending(false);
  }

  const submitLabel = registering
    ? pending
      ? "Criando conta…"
      : "Criar conta"
    : pending
      ? "Entrando…"
      : "Entrar";

  return (
    <main className="login-page">
      <div className="login-card">
        <div className="login-panel">
          <Link to="/" className="login-brand" aria-label="educAI, voltar para a página inicial">
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

            <form
              method="post"
              action={endpoint}
              onSubmit={submit}
              className="login-form"
              noValidate
              aria-describedby="login-required"
            >
              <p id="login-required" className="sr-only">
                Todos os campos são obrigatórios.
              </p>

              <label htmlFor="login-email">E-mail</label>
              <input
                id="login-email"
                name="email"
                type="email"
                inputMode="email"
                autoComplete={registering ? "email" : "username"}
                autoCapitalize="none"
                spellCheck={false}
                maxLength={254}
                placeholder="voce@exemplo.com"
                value={email}
                onChange={(event) => {
                  setEmail(event.target.value);
                  clearFieldError("email");
                }}
                aria-invalid={fieldErrors.email ? true : undefined}
                aria-describedby={fieldErrors.email ? "login-email-error" : undefined}
                required
              />
              {fieldErrors.email ? (
                <p id="login-email-error" className="login-field-error">
                  {fieldErrors.email}
                  {emailInUse ? (
                    <>
                      {" "}
                      <Link to="/login" search={{ voltar }}>
                        Ir para o login
                      </Link>
                    </>
                  ) : null}
                </p>
              ) : null}

              <PasswordField
                id="login-password"
                name="password"
                label="Senha"
                autoComplete={registering ? "new-password" : "current-password"}
                minLength={registering ? minimumPasswordLength : undefined}
                maxLength={maximumPasswordLength}
                placeholder={registering ? "Crie uma senha" : "Digite sua senha"}
                value={password}
                onChange={(event) => {
                  setPassword(event.target.value);
                  clearFieldError("password");
                }}
                error={fieldErrors.password}
                visible={showPassword}
                onToggleVisible={() => setShowPassword((visible) => !visible)}
                aria-details={registering ? "password-strength" : undefined}
                required
              />

              {registering ? (
                <>
                  <PasswordStrength id="password-strength" password={password} email={email} />

                  <PasswordField
                    id="confirm-password"
                    name="confirmPassword"
                    label="Confirme a senha"
                    autoComplete="new-password"
                    maxLength={maximumPasswordLength}
                    placeholder="Digite a senha novamente"
                    value={confirmPassword}
                    onChange={(event) => {
                      setConfirmPassword(event.target.value);
                      clearFieldError("confirmPassword");
                    }}
                    error={fieldErrors.confirmPassword}
                    hint={
                      confirmPassword && confirmPassword === password
                        ? "As senhas conferem."
                        : undefined
                    }
                    visible={showPassword}
                    onToggleVisible={() => setShowPassword((visible) => !visible)}
                    required
                  />

                  <div className="login-terms">
                    <input
                      id="accept-terms"
                      name="terms"
                      type="checkbox"
                      checked={terms}
                      onChange={(event) => {
                        setTerms(event.target.checked);
                        clearFieldError("terms");
                      }}
                      aria-invalid={fieldErrors.terms ? true : undefined}
                      aria-describedby={fieldErrors.terms ? "accept-terms-error" : undefined}
                      required
                    />
                    <label htmlFor="accept-terms">
                      Li e aceito os{" "}
                      <Link to="/termos" target="_blank" rel="noopener">
                        Termos de uso
                        <span className="sr-only"> (abre em nova aba)</span>
                      </Link>{" "}
                      e a{" "}
                      <Link to="/termos" hash="privacidade" target="_blank" rel="noopener">
                        Política de privacidade
                        <span className="sr-only"> (abre em nova aba)</span>
                      </Link>
                      .
                    </label>
                  </div>
                  {fieldErrors.terms ? (
                    <p id="accept-terms-error" className="login-field-error">
                      {fieldErrors.terms}
                    </p>
                  ) : null}
                </>
              ) : null}

              <div aria-live="assertive">
                {error ? (
                  <p ref={errorRef} className="login-error" role="alert" tabIndex={-1}>
                    {error}
                    {retryIn > 0 ? ` Você poderá tentar de novo em ${retryIn}s.` : null}
                  </p>
                ) : null}
              </div>

              <button
                className="login-submit"
                type="submit"
                disabled={!ready || pending || retryIn > 0}
                aria-busy={pending || undefined}
              >
                {retryIn > 0 ? `Aguarde ${retryIn}s` : submitLabel}
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
