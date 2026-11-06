import { createHmac, randomBytes, randomUUID, scrypt, timingSafeEqual } from "node:crypto";
import { z } from "zod";
import {
  maximumPasswordLength,
  minimumPasswordLength,
  passwordProblem,
} from "../lib/password-policy";
import { findAuthAccount, insertAuthAccount } from "./auth-accounts";
import { serverEnv } from "./runtime-env";

const lifetimeSeconds = 4 * 60 * 60;
const attemptWindowMs = 5 * 60 * 1000;
const scryptOptions = { N: 2 ** 15, r: 8, p: 3, maxmem: 48 * 1024 * 1024 };
const jwtHeader = Buffer.from('{"alg":"HS256","typ":"JWT"}').toString("base64url");
const passwordHashPattern = /^scrypt:[\da-f]{32}:[\da-f]{64}$/i;
const memberId = z.string().uuid();
const loginInput = z.object({
  email: z.string().trim().email().max(254).toLowerCase(),
  password: z.string().min(1).max(maximumPasswordLength),
});
const registerInput = loginInput.extend({
  password: z.string().min(minimumPasswordLength).max(maximumPasswordLength),
});
const attemptsByEmail = new Map<string, number>();
let attemptWindowEnd = 0;
let pendingAttempts = 0;

export type WorkspaceSession =
  | { isAdmin: true; ownerId?: never }
  | { isAdmin: false; ownerId: string };

function authConfig() {
  const secret = serverEnv("EDUCAI_AUTH_JWT_SECRET") ?? "";
  if (!/^[\da-f]{64}$/i.test(secret)) return null;

  const key = Buffer.from(secret, "hex");
  const email = serverEnv("EDUCAI_AUTH_EMAIL")?.trim().toLowerCase();
  const hash = serverEnv("EDUCAI_AUTH_PASSWORD_HASH") ?? "";
  return {
    reservedEmail: email,
    memberKey: createHmac("sha256", key).update("educai:members:v1").digest(),
    admin:
      email && passwordHashPattern.test(hash)
        ? {
            hash,
            key: createHmac("sha256", key)
              .update(JSON.stringify(["educai", email, hash]))
              .digest(),
          }
        : undefined,
  };
}

function cookieOptions(url: URL) {
  if (url.protocol === "https:") return { name: "__Host-educai_session", secure: "; Secure" };
  if (url.protocol === "http:" && ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname)) {
    return { name: "educai_session", secure: "" };
  }
  return null;
}

function sessionCookie(options: NonNullable<ReturnType<typeof cookieOptions>>, token: string) {
  return `${options.name}=${token}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${token ? lifetimeSeconds : 0}${options.secure}`;
}

function sign(message: string, key: Buffer) {
  return createHmac("sha256", key).update(message).digest("base64url");
}

function createToken(subject: string, key: Buffer) {
  const claims = Buffer.from(
    JSON.stringify({
      iss: "educai",
      sub: subject,
      exp: Math.floor(Date.now() / 1000) + lifetimeSeconds,
      jti: randomUUID(),
    }),
  ).toString("base64url");
  const message = `${jwtHeader}.${claims}`;
  return `${message}.${sign(message, key)}`;
}

export function getWorkspaceSession(request: Request): WorkspaceSession | null {
  const cookie = cookieOptions(new URL(request.url));
  const token =
    cookie &&
    request.headers
      .get("cookie")
      ?.split(/;\s*/)
      .find((part) => part.startsWith(`${cookie.name}=`))
      ?.slice(cookie.name.length + 1);
  if (!token || token.length > 1024) return null;

  const config = authConfig();
  if (!config) return null;
  const [header, payload, signature, extra] = token.split(".");
  if (extra !== undefined || header !== jwtHeader || !payload || !signature) return null;

  try {
    const claims = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    if (
      claims.iss !== "educai" ||
      !Number.isInteger(claims.exp) ||
      claims.exp <= Math.floor(Date.now() / 1000)
    ) {
      return null;
    }
    const isAdmin = claims.sub === "workspace";
    const key = isAdmin ? config.admin?.key : config.memberKey;
    if (!key) return null;
    const expected = Buffer.from(sign(`${header}.${payload}`, key));
    const received = Buffer.from(signature);
    if (received.length !== expected.length || !timingSafeEqual(received, expected)) return null;
    if (isAdmin) return { isAdmin: true };
    const ownerId = memberId.safeParse(claims.sub);
    return ownerId.success ? { isAdmin: false, ownerId: ownerId.data } : null;
  } catch {
    return null;
  }
}

export function isSameOrigin(request: Request) {
  return request.headers.get("origin") === new URL(request.url).origin;
}

function authError(
  status: number,
  code: string,
  message: string,
  headers?: Record<string, string>,
) {
  return Response.json(
    { error: { code, message } },
    {
      status,
      headers: { "cache-control": "no-store", ...headers },
    },
  );
}

export function authRequired() {
  return authError(401, "AUTH_REQUIRED", "Entre para acessar o educAI.");
}

export function forbiddenOrigin() {
  return authError(403, "INVALID_ORIGIN", "A origem da solicitação não foi autorizada.");
}

function derivePasswordHash(password: string, salt: Buffer) {
  return new Promise<Buffer>((resolve, reject) => {
    scrypt(password, salt, 32, scryptOptions, (error, key) => {
      if (error) reject(error);
      else resolve(key);
    });
  });
}

async function verifyPassword(password: string, hash = "") {
  const [, salt, digest] = hash.split(":");
  const actual = await derivePasswordHash(
    password,
    salt ? Buffer.from(salt, "hex") : Buffer.alloc(16),
  );
  return passwordHashPattern.test(hash) && timingSafeEqual(actual, Buffer.from(digest, "hex"));
}

async function readCredentials(request: Request) {
  const reader = request.body?.getReader();
  if (!reader) return null;

  const bytes = new Uint8Array(4096);
  let length = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      if (length + value.length > bytes.length) {
        await reader.cancel();
        return null;
      }
      bytes.set(value, length);
      length += value.length;
    }
    return JSON.parse(new TextDecoder().decode(bytes.subarray(0, length))) as unknown;
  } catch {
    return null;
  } finally {
    reader.releaseLock();
  }
}

function emailInUse() {
  return authError(
    409,
    "EMAIL_IN_USE",
    "Já existe uma conta com esse e-mail. Entre com sua senha.",
  );
}

export async function handleAuthRequest(request: Request, url: URL) {
  const { pathname } = url;
  const registering = pathname === "/api/auth/register";
  if (!registering && pathname !== "/api/auth/login" && pathname !== "/api/auth/logout") {
    return authError(404, "NOT_FOUND", "Rota de autenticação não encontrada.");
  }
  if (request.method !== "POST") {
    return authError(405, "METHOD_NOT_ALLOWED", "Método não permitido.", { allow: "POST" });
  }
  if (!isSameOrigin(request)) return forbiddenOrigin();

  const cookie = cookieOptions(url);
  if (!cookie) return authError(400, "HTTPS_REQUIRED", "Acesse por HTTPS para continuar.");
  if (pathname === "/api/auth/logout") {
    return new Response(null, {
      status: 204,
      headers: { "cache-control": "no-store", "set-cookie": sessionCookie(cookie, "") },
    });
  }

  const config = authConfig();
  if (!config) {
    return authError(
      503,
      "AUTH_NOT_CONFIGURED",
      "O acesso ainda precisa ser configurado no servidor.",
    );
  }

  const contentType = request.headers.get("content-type")?.split(";", 1)[0];
  if (contentType !== "application/json") {
    return authError(415, "INVALID_CONTENT_TYPE", "Envie as credenciais em JSON.");
  }
  const input = (registering ? registerInput : loginInput).safeParse(
    await readCredentials(request),
  );
  if (!input.success) {
    return registering
      ? authError(
          400,
          "INVALID_REGISTRATION",
          `Informe um e-mail válido e uma senha de pelo menos ${minimumPasswordLength} caracteres.`,
        )
      : authError(400, "INVALID_LOGIN", "Informe um e-mail e uma senha válidos.");
  }

  const { email, password } = input.data;
  const weakness = registering ? passwordProblem(password, email) : undefined;
  if (weakness) {
    return authError(400, "WEAK_PASSWORD", `Senha fraca: ${weakness.label.toLowerCase()}.`);
  }
  const now = Date.now();
  if (now >= attemptWindowEnd) {
    attemptWindowEnd = now + attemptWindowMs;
    attemptsByEmail.clear();
  }
  const attempts = attemptsByEmail.get(email) ?? 0;
  if (attempts >= 10 || (!attempts && attemptsByEmail.size >= 500) || pendingAttempts >= 2) {
    return authError(
      429,
      "TOO_MANY_ATTEMPTS",
      "Muitas tentativas. Aguarde um momento para tentar novamente.",
      {
        "retry-after":
          pendingAttempts >= 2 ? "1" : String(Math.ceil((attemptWindowEnd - now) / 1000)),
      },
    );
  }
  attemptsByEmail.set(email, attempts + 1);
  pendingAttempts += 1;

  try {
    let token: string;
    if (registering) {
      if (email === config.reservedEmail || (await findAuthAccount(email))) return emailInUse();

      const salt = randomBytes(16);
      const hash = await derivePasswordHash(password, salt);
      const account = {
        id: randomUUID(),
        email,
        password_hash: `scrypt:${salt.toString("hex")}:${hash.toString("hex")}`,
      };
      if (!(await insertAuthAccount(account))) return emailInUse();
      token = createToken(account.id, config.memberKey);
    } else {
      const admin = email === config.reservedEmail ? config.admin : undefined;
      const account = admin
        ? { id: "workspace", password_hash: admin.hash }
        : email === config.reservedEmail
          ? undefined
          : await findAuthAccount(email);
      const valid = await verifyPassword(password, account?.password_hash);
      if (!valid || !account) {
        return authError(401, "INVALID_CREDENTIALS", "E-mail ou senha incorretos.");
      }
      token = createToken(account.id, admin?.key ?? config.memberKey);
    }
    attemptsByEmail.delete(email);
    return new Response(null, {
      status: registering ? 201 : 204,
      headers: {
        "cache-control": "no-store",
        "set-cookie": sessionCookie(cookie, token),
      },
    });
  } catch (error) {
    console.error(error);
    return authError(
      503,
      "AUTH_UNAVAILABLE",
      "O serviço de contas está indisponível. Tente novamente.",
    );
  } finally {
    pendingAttempts -= 1;
  }
}
