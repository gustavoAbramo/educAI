import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { mkdtemp, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import app from "../server";

test("account profile, password change and deletion", async (t) => {
  const root = await mkdtemp(join(tmpdir(), "educai-account-test-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  process.env.EDUCAI_VOICE_STORE_PATH = join(root, "voice.json");
  process.env.EDUCAI_APP_SETTINGS_PATH = join(root, "settings.json");
  process.env.EDUCAI_PROVIDER_SETTINGS_PATH = join(root, "provider-settings.json");
  process.env.EDUCAI_SETTINGS_SECRETS_PATH = join(root, "secrets.json");
  process.env.EDUCAI_SETTINGS_MASTER_KEY_PATH = join(root, "master.key");
  process.env.EDUCAI_PROFILES_DIR = join(root, "profiles");

  const origin = "https://educai.test";
  const accountsDirectory = join(root, "accounts");
  const env = {
    EDUCAI_AUTH_JWT_SECRET: randomBytes(32).toString("hex"),
    EDUCAI_AUTH_STORE: "local",
    EDUCAI_AUTH_ACCOUNTS_DIR: accountsDirectory,
    EDUCAI_PERSISTENCE_PROVIDER: "local",
  };
  Object.assign(process.env, env);

  const call = (path: string, options: RequestInit = {}) =>
    app.fetch(new Request(origin + path, options), env, undefined);
  const send = (method: string, path: string, body: unknown, cookie: string) =>
    call(path, {
      method,
      headers: { origin, "content-type": "application/json", cookie },
      body: JSON.stringify(body),
    });
  const cookieFrom = (response: Response) => response.headers.get("set-cookie")!.split(";")[0];

  const email = "dani@example.com";
  const password = "minha-senha-segura";
  const newPassword = "outra-senha-bem-longa";
  const registered = await send("POST", "/api/auth/register", { email, password }, "");
  assert.equal(registered.status, 201);
  const cookie = cookieFrom(registered);

  assert.equal((await call("/api/v1/account")).status, 401);

  const profile = await (await call("/api/v1/account", { headers: { cookie } })).json();
  assert.equal(profile.data.email, email);
  assert.equal(profile.data.name, "");
  assert.equal(profile.data.canDelete, true);

  const avatar = `data:image/png;base64,${Buffer.from("png").toString("base64")}`;
  const saved = await send("PATCH", "/api/v1/account", { name: "Dani", avatar }, cookie);
  assert.equal(saved.status, 200);
  assert.equal((await saved.json()).data.name, "Dani");
  assert.equal(
    (await send("PATCH", "/api/v1/account", { avatar: "javascript:alert(1)" }, cookie)).status,
    400,
  );
  const removed = await send("PATCH", "/api/v1/account", { avatar: null }, cookie);
  assert.equal((await removed.json()).data.avatar, undefined);

  const wrong = await send(
    "POST",
    "/api/v1/account/password",
    { currentPassword: "errada", newPassword },
    cookie,
  );
  assert.equal(wrong.status, 401);
  const weak = await send(
    "POST",
    "/api/v1/account/password",
    { currentPassword: password, newPassword: "curta" },
    cookie,
  );
  assert.equal(weak.status, 400);
  const changed = await send(
    "POST",
    "/api/v1/account/password",
    { currentPassword: password, newPassword },
    cookie,
  );
  assert.equal(changed.status, 200);
  assert.equal((await send("POST", "/api/auth/login", { email, password }, "")).status, 401);
  assert.equal(
    (await send("POST", "/api/auth/login", { email, password: newPassword }, "")).status,
    204,
  );

  const lesson = await send(
    "POST",
    "/api/v1/sessions",
    { type: "CLASS", title: "Aula da Dani", language: "pt-BR" },
    cookie,
  );
  assert.equal(lesson.status, 201);
  const list = await (await call("/api/v1/sessions", { headers: { cookie } })).json();
  assert.equal(list.data[0].durationSeconds, 0);

  assert.equal(
    (await send("DELETE", "/api/v1/account", { password: "errada" }, cookie)).status,
    401,
  );
  const deleted = await send("DELETE", "/api/v1/account", { password: newPassword }, cookie);
  assert.equal(deleted.status, 200);
  assert.match(deleted.headers.get("set-cookie") ?? "", /Max-Age=0/);
  assert.deepEqual(await readdir(accountsDirectory), []);
  assert.deepEqual(
    (await (await call("/api/v1/sessions", { headers: { cookie } })).json()).data,
    [],
  );
  assert.equal(
    (await send("POST", "/api/auth/login", { email, password: newPassword }, "")).status,
    401,
  );
});
