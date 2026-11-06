import { Check, Circle } from "lucide-react";
import { passwordChecks, passwordStrength } from "@/lib/password-policy";

export function PasswordStrength({
  id,
  password,
  email,
}: {
  id: string;
  password: string;
  email: string;
}) {
  const strength = passwordStrength(password, email);
  const checks = passwordChecks(password, email);

  return (
    <div id={id} className="login-strength">
      <div className="login-strength-bar" aria-hidden="true">
        {[1, 2, 3, 4].map((step) => (
          <span key={step} data-on={strength.score >= step ? strength.score : undefined} />
        ))}
      </div>
      <p className="login-hint" aria-live="polite">
        {strength.label ? `Força da senha: ${strength.label}` : "Requisitos da senha:"}
      </p>
      <ul className="login-checks">
        {checks.map((check) => (
          <li key={check.id} data-ok={check.ok || undefined}>
            {check.ok ? <Check size={13} aria-hidden /> : <Circle size={13} aria-hidden />}
            <span>
              {check.label}
              <span className="sr-only">{check.ok ? " (cumprido)" : " (pendente)"}</span>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
