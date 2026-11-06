// Regras de senha usadas tanto no formulario de cadastro quanto no servidor,
// para que a mensagem que a pessoa ve seja a mesma que o backend aplica.

export const minimumPasswordLength = 12;
export const maximumPasswordLength = 256;

const commonPasswords = new Set([
  "123456789012",
  "senha1234567",
  "senhasenha12",
  "password1234",
  "qwertyuiop12",
  "abcdefghijkl",
  "educai123456",
  "minhasenha12",
  "aaaaaaaaaaaa",
]);

export type PasswordCheck = { id: string; label: string; ok: boolean };

export function passwordChecks(password: string, email = ""): PasswordCheck[] {
  const localPart = email.split("@", 1)[0]?.trim().toLowerCase() ?? "";
  const lower = password.toLowerCase();
  return [
    {
      id: "length",
      label: `Pelo menos ${minimumPasswordLength} caracteres`,
      ok: password.length >= minimumPasswordLength,
    },
    {
      id: "variety",
      label: "Pelo menos 5 caracteres diferentes",
      ok: new Set(password).size >= 5,
    },
    {
      id: "email",
      label: "Não contém o seu e-mail",
      ok: localPart.length < 4 || !lower.includes(localPart),
    },
    {
      id: "common",
      label: "Não é uma senha comum",
      ok: !commonPasswords.has(lower),
    },
  ];
}

// Primeira regra que a senha nao cumpre, ou undefined quando ela e aceita.
export function passwordProblem(password: string, email = "") {
  return passwordChecks(password, email).find((check) => !check.ok);
}

export type PasswordStrength = { score: 0 | 1 | 2 | 3 | 4; label: string };

// Estimativa simples (tamanho + tipos de caractere). Serve so para orientar;
// quem decide se a senha e aceita e passwordProblem.
export function passwordStrength(password: string, email = ""): PasswordStrength {
  if (!password) return { score: 0, label: "" };
  if (passwordProblem(password, email)) return { score: 1, label: "Fraca" };
  const kinds = [/[a-z]/, /[A-Z]/, /\d/, /[^\da-zA-Z]/].filter((pattern) =>
    pattern.test(password),
  ).length;
  const points = kinds + (password.length >= 16 ? 1 : 0) + (password.length >= 20 ? 1 : 0);
  if (points >= 5) return { score: 4, label: "Muito forte" };
  if (points >= 3) return { score: 3, label: "Forte" };
  return { score: 2, label: "Razoável" };
}
