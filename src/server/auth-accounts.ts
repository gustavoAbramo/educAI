import { createHash, randomUUID } from "node:crypto";
import { link, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { serverEnv } from "./runtime-env";

export type AuthAccount = { id: string; email: string; password_hash: string };

function accountPath(email: string) {
  const directory =
    serverEnv("EDUCAI_AUTH_ACCOUNTS_DIR") ?? join(process.cwd(), ".data", "accounts");
  const key = createHash("sha256").update(email).digest("hex");
  return join(directory, `${key}.json`);
}

function supabaseAccounts() {
  if (serverEnv("EDUCAI_AUTH_STORE") !== "supabase") return undefined;
  const url = serverEnv("SUPABASE_URL")?.replace(/\/+$/, "");
  const key = serverEnv("SUPABASE_SECRET_KEY") ?? serverEnv("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !key) throw new Error("Supabase account storage is not configured.");
  return {
    url: `${url}/rest/v1/educai_accounts`,
    headers: {
      apikey: key,
      ...(key.startsWith("sb_secret_") ? {} : { authorization: `Bearer ${key}` }),
      "content-type": "application/json",
    },
  };
}

export async function findAuthAccount(email: string): Promise<AuthAccount | undefined> {
  const remote = supabaseAccounts();
  if (remote) {
    const url = new URL(remote.url);
    url.searchParams.set("email", `eq.${email}`);
    const response = await fetch(url, {
      headers: remote.headers,
      signal: AbortSignal.timeout(5000),
    });
    if (!response.ok) throw new Error(`Account lookup failed (${response.status}).`);
    const accounts = (await response.json()) as AuthAccount[];
    return accounts[0];
  }

  try {
    return JSON.parse(await readFile(accountPath(email), "utf8")) as AuthAccount;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return undefined;
    throw error;
  }
}

export async function insertAuthAccount(account: AuthAccount) {
  const remote = supabaseAccounts();
  if (remote) {
    const response = await fetch(remote.url, {
      method: "POST",
      headers: remote.headers,
      body: JSON.stringify(account),
      signal: AbortSignal.timeout(5000),
    });
    if (response.status === 409) return false;
    if (!response.ok) throw new Error(`Account creation failed (${response.status}).`);
    return true;
  }

  const destination = accountPath(account.email);
  const temporary = `${destination}.${randomUUID()}.tmp`;
  await mkdir(dirname(destination), { recursive: true, mode: 0o700 });
  try {
    await writeFile(temporary, JSON.stringify(account), { flag: "wx", mode: 0o600, flush: true });
    // Publish the complete record only if the email is still available.
    await link(temporary, destination);
    return true;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "EEXIST") return false;
    throw error;
  } finally {
    await rm(temporary, { force: true }).catch((error: unknown) => console.error(error));
  }
}
