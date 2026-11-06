import { randomBytes } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { serverEnv } from "./runtime-env";

const secretPattern = /^[\da-f]{64}$/i;
let generatedSecret: string | undefined;

function secretPath() {
  return serverEnv("EDUCAI_AUTH_SECRET_FILE") ?? join(process.cwd(), ".data", "auth-secret");
}

function readStoredSecret(path: string) {
  try {
    const value = readFileSync(path, "utf8").trim();
    return secretPattern.test(value) ? value : undefined;
  } catch {
    return undefined;
  }
}

/**
 * Returns the session signing key. Uses EDUCAI_AUTH_JWT_SECRET when set;
 * otherwise generates one on first use and keeps it in .data/auth-secret so
 * sessions survive restarts without any manual setup.
 */
export function authSecret() {
  const configured = serverEnv("EDUCAI_AUTH_JWT_SECRET")?.trim();
  if (configured) return secretPattern.test(configured) ? configured : undefined;
  if (generatedSecret) return generatedSecret;

  const path = secretPath();
  const stored = readStoredSecret(path);
  if (stored) return (generatedSecret = stored);

  const created = randomBytes(32).toString("hex");
  try {
    mkdirSync(dirname(path), { recursive: true, mode: 0o700 });
    // "wx" keeps the key another process may have written in the meantime.
    writeFileSync(path, created, { flag: "wx", mode: 0o600 });
    generatedSecret = created;
  } catch {
    // Read-only or ephemeral disk: reuse a concurrent write or keep the key in memory.
    generatedSecret = readStoredSecret(path) ?? created;
    if (generatedSecret === created) {
      console.warn(
        "educAI: não foi possível salvar a chave de sessão em disco; as sessões expiram ao reiniciar. Defina EDUCAI_AUTH_JWT_SECRET para mantê-las.",
      );
    }
  }
  return generatedSecret;
}
