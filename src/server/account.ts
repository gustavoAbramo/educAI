import { randomUUID } from "node:crypto";
import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { z } from "zod";
import { maximumPasswordLength, passwordProblem } from "../lib/password-policy";
import {
  deleteAuthAccount,
  findAuthAccountById,
  updateAuthAccountPassword,
  type AuthAccount,
} from "./auth-accounts";
import { clearedSessionCookie, hashPassword, verifyPassword, type WorkspaceSession } from "./auth";
import { serverEnv } from "./runtime-env";
import { deleteVoiceSession, ensureVoiceStoreLoaded, listVoiceSessions } from "./voice-store";

export type AccountProfile = {
  email: string;
  name: string;
  avatar?: string;
  isAdmin: boolean;
  // A conta de administracao vem do .env: nao da para trocar a senha nem excluir por aqui.
  canChangePassword: boolean;
  canDelete: boolean;
};

type StoredProfile = { name?: string; avatar?: string };

const maxBodyBytes = 400 * 1024;
const maxAvatarLength = 300 * 1024;
const avatarPattern = /^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/]+=*$/;
const failureWindowMs = 5 * 60 * 1000;
const maxFailures = 5;
const failures = new Map<string, { count: number; resetAt: number }>();

const profileInput = z
  .object({
    name: z.string().trim().max(80).optional(),
    avatar: z.union([z.string().max(maxAvatarLength).regex(avatarPattern), z.null()]).optional(),
  })
  .strict();
const passwordInput = z.object({
  currentPassword: z.string().min(1).max(maximumPasswordLength),
  newPassword: z.string().min(1).max(maximumPasswordLength),
});
const deleteInput = z.object({ password: z.string().min(1).max(maximumPasswordLength) });

function reply(status: number, body: unknown, headers?: Record<string, string>) {
  return Response.json(body, { status, headers: { "cache-control": "no-store", ...headers } });
}

function fail(status: number, code: string, message: string) {
  return reply(status, { error: { code, message } });
}

function profileId(session: WorkspaceSession) {
  return session.isAdmin ? "workspace" : session.ownerId;
}

function profilePath(id: string) {
  const directory = serverEnv("EDUCAI_PROFILES_DIR") ?? join(process.cwd(), ".data", "profiles");
  return join(directory, `${id}.json`);
}

async function readProfile(id: string): Promise<StoredProfile> {
  try {
    return JSON.parse(await readFile(profilePath(id), "utf8")) as StoredProfile;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return {};
    throw error;
  }
}

async function writeProfile(id: string, profile: StoredProfile) {
  const destination = profilePath(id);
  const temporary = `${destination}.${randomUUID()}.tmp`;
  await mkdir(dirname(destination), { recursive: true, mode: 0o700 });
  try {
    await writeFile(temporary, JSON.stringify(profile), { mode: 0o600, flush: true });
    await rename(temporary, destination);
  } finally {
    await rm(temporary, { force: true }).catch(() => undefined);
  }
}

async function readBody(request: Request): Promise<unknown> {
  const contentType = request.headers.get("content-type")?.split(";", 1)[0];
  if (contentType !== "application/json") return undefined;
  const text = await request.text();
  if (text.length > maxBodyBytes) return undefined;
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return undefined;
  }
}

// Limita tentativas erradas de senha por conta, para a sessao logada nao
// virar um jeito de adivinhar a senha.
function tooManyFailures(id: string) {
  const entry = failures.get(id);
  if (!entry || entry.resetAt <= Date.now()) return false;
  return entry.count >= maxFailures;
}

function recordFailure(id: string) {
  const now = Date.now();
  const entry = failures.get(id);
  if (!entry || entry.resetAt <= now) {
    failures.set(id, { count: 1, resetAt: now + failureWindowMs });
  } else {
    entry.count += 1;
  }
}

async function memberAccount(session: WorkspaceSession): Promise<AuthAccount | undefined> {
  if (session.isAdmin) return undefined;
  return findAuthAccountById(session.ownerId);
}

async function buildProfile(session: WorkspaceSession): Promise<AccountProfile | undefined> {
  const stored = await readProfile(profileId(session));
  if (session.isAdmin) {
    return {
      email: serverEnv("EDUCAI_AUTH_EMAIL")?.trim().toLowerCase() ?? "",
      name: stored.name ?? "",
      avatar: stored.avatar,
      isAdmin: true,
      canChangePassword: false,
      canDelete: false,
    };
  }
  const account = await memberAccount(session);
  if (!account) return undefined;
  return {
    email: account.email,
    name: stored.name ?? "",
    avatar: stored.avatar,
    isAdmin: false,
    canChangePassword: true,
    canDelete: true,
  };
}

export async function handleAccountRequest(
  request: Request,
  url: URL,
  session: WorkspaceSession,
): Promise<Response> {
  const path = url.pathname.replace(/\/+$/, "");

  try {
    if (path === "/api/v1/account" && request.method === "GET") {
      const profile = await buildProfile(session);
      if (!profile) return fail(404, "ACCOUNT_NOT_FOUND", "Conta não encontrada.");
      return reply(200, { data: profile });
    }

    if (path === "/api/v1/account" && request.method === "PATCH") {
      const input = profileInput.safeParse(await readBody(request));
      if (!input.success) {
        return fail(
          400,
          "INVALID_PROFILE",
          "Confira o nome (até 80 caracteres) e a foto (PNG, JPEG ou WebP pequena).",
        );
      }
      const id = profileId(session);
      const current = await readProfile(id);
      const next: StoredProfile = { ...current };
      if (input.data.name !== undefined) next.name = input.data.name;
      if (input.data.avatar === null) delete next.avatar;
      else if (input.data.avatar !== undefined) next.avatar = input.data.avatar;
      await writeProfile(id, next);
      return reply(200, { data: await buildProfile(session) });
    }

    if (path === "/api/v1/account/password" && request.method === "POST") {
      const account = await memberAccount(session);
      if (!account) {
        return fail(403, "PASSWORD_LOCKED", "A senha desta conta é definida no servidor.");
      }
      if (tooManyFailures(account.id)) {
        return fail(429, "TOO_MANY_ATTEMPTS", "Muitas tentativas. Aguarde alguns minutos.");
      }
      const input = passwordInput.safeParse(await readBody(request));
      if (!input.success) return fail(400, "INVALID_REQUEST", "Preencha a senha atual e a nova.");

      if (!(await verifyPassword(input.data.currentPassword, account.password_hash))) {
        recordFailure(account.id);
        return fail(401, "WRONG_PASSWORD", "A senha atual está incorreta.");
      }
      const weakness = passwordProblem(input.data.newPassword, account.email);
      if (weakness) {
        return fail(400, "WEAK_PASSWORD", `Senha fraca: ${weakness.label.toLowerCase()}.`);
      }
      await updateAuthAccountPassword(account, await hashPassword(input.data.newPassword));
      failures.delete(account.id);
      return reply(200, { data: { changed: true } });
    }

    if (path === "/api/v1/account" && request.method === "DELETE") {
      const account = await memberAccount(session);
      if (!account) {
        return fail(403, "ACCOUNT_LOCKED", "A conta de administração não pode ser excluída.");
      }
      if (tooManyFailures(account.id)) {
        return fail(429, "TOO_MANY_ATTEMPTS", "Muitas tentativas. Aguarde alguns minutos.");
      }
      const input = deleteInput.safeParse(await readBody(request));
      if (!input.success) return fail(400, "INVALID_REQUEST", "Digite sua senha para confirmar.");
      if (!(await verifyPassword(input.data.password, account.password_hash))) {
        recordFailure(account.id);
        return fail(401, "WRONG_PASSWORD", "Senha incorreta.");
      }

      await ensureVoiceStoreLoaded();
      for (const record of listVoiceSessions(account.id)) {
        await deleteVoiceSession(record.session.id);
      }
      await rm(profilePath(account.id), { force: true });
      await deleteAuthAccount(account);
      failures.delete(account.id);

      const cookie = clearedSessionCookie(url);
      return reply(200, { data: { deleted: true } }, cookie ? { "set-cookie": cookie } : undefined);
    }

    return fail(404, "NOT_FOUND", "Rota da conta não encontrada.");
  } catch (error) {
    console.error(error);
    return fail(503, "ACCOUNT_UNAVAILABLE", "O serviço de contas está indisponível agora.");
  }
}
