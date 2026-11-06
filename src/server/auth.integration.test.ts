import assert from "node:assert/strict";
import { randomBytes, scryptSync } from "node:crypto";
import { mkdtemp, readdir, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import app from "../server";

test("registered accounts keep separate sessions and the existing admin keeps legacy access", async (t) => {
  const root = await mkdtemp(join(tmpdir(), "educai-accounts-test-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  process.env.EDUCAI_VOICE_STORE_PATH = join(root, "voice.json");
  process.env.EDUCAI_APP_SETTINGS_PATH = join(root, "settings.json");
  process.env.EDUCAI_PROVIDER_SETTINGS_PATH = join(root, "provider-settings.json");
  process.env.EDUCAI_SETTINGS_SECRETS_PATH = join(root, "secrets.json");
  process.env.EDUCAI_SETTINGS_MASTER_KEY_PATH = join(root, "master.key");

  const origin = "https://educai.test";
  const adminEmail = "admin@example.com";
  const password = "minha-senha-segura";
  const salt = randomBytes(16);
  const hash = scryptSync(password, salt, 32, { N: 2 ** 15, r: 8, p: 3, maxmem: 48 * 1024 * 1024 });
  const accountsDirectory = join(root, "accounts");
  const env = {
    EDUCAI_AUTH_JWT_SECRET: randomBytes(32).toString("hex"),
    EDUCAI_AUTH_EMAIL: adminEmail,
    EDUCAI_AUTH_PASSWORD_HASH: `scrypt:${salt.toString("hex")}:${hash.toString("hex")}`,
    EDUCAI_AUTH_STORE: "local",
    EDUCAI_AUTH_ACCOUNTS_DIR: accountsDirectory,
    EDUCAI_PERSISTENCE_PROVIDER: "local",
  };
  Object.assign(process.env, env);

  function call(path: string, options: RequestInit = {}) {
    return app.fetch(new Request(origin + path, options), env, undefined);
  }

  function post(path: string, body: object, cookie = "", requestOrigin = origin) {
    return call(path, {
      method: "POST",
      headers: { origin: requestOrigin, "content-type": "application/json", cookie },
      body: JSON.stringify(body),
    });
  }

  function cookieFrom(response: Response) {
    const header = response.headers.get("set-cookie");
    assert.match(
      header ?? "",
      /^__Host-educai_session=[^;]+; Path=\/; HttpOnly; SameSite=Strict; Max-Age=14400; Secure$/,
    );
    return header!.split(";")[0];
  }

  const register = (email: string) => post("/api/auth/register", { email, password });
  assert.equal(
    (await post("/api/auth/register", { email: "ana@example.com", password: "short" })).status,
    400,
  );
  assert.equal(
    (
      await post(
        "/api/auth/register",
        { email: "ana@example.com", password },
        "",
        "https://external.test",
      )
    ).status,
    403,
  );
  assert.equal((await register(adminEmail)).status, 409);

  const concurrent = await Promise.all([register("Ana@Example.com"), register("ana@example.com")]);
  assert.deepEqual(concurrent.map((response) => response.status).sort(), [201, 409]);
  const ana = cookieFrom(concurrent.find((response) => response.status === 201)!);
  const registeredBia = await register("bia@example.com");
  assert.equal(registeredBia.status, 201);
  const bia = cookieFrom(registeredBia);

  const storedAccounts = await readdir(accountsDirectory);
  assert.equal(storedAccounts.length, 2);
  for (const file of storedAccounts) {
    const stored = await readFile(join(accountsDirectory, file), "utf8");
    assert.match(JSON.parse(stored).password_hash, /^scrypt:[\da-f]{32}:[\da-f]{64}$/);
    assert.ok(!stored.includes(password));
  }

  const adminResponse = await post("/api/auth/login", { email: adminEmail, password });
  assert.equal(adminResponse.status, 204);
  const admin = cookieFrom(adminResponse);
  const sessionsPath = "/api/v1/sessions";
  const lesson = { type: "CLASS", title: "Aula de teste", language: "pt-BR" };
  const legacyLesson = await post(sessionsPath, lesson, admin);
  assert.equal(legacyLesson.status, 201);
  const anaLesson = await post(sessionsPath, lesson, ana);
  assert.equal(anaLesson.status, 201);
  const {
    data: { id },
  } = await anaLesson.json();
  const lessonPath = `${sessionsPath}/${id}`;

  assert.equal((await call(lessonPath)).status, 401);
  assert.equal((await call(lessonPath, { headers: { cookie: ana } })).status, 200);
  assert.equal((await call(lessonPath, { headers: { cookie: bia } })).status, 404);
  assert.equal((await call(lessonPath, { headers: { cookie: admin } })).status, 404);
  assert.equal((await call(`${lessonPath}/overview`, { headers: { cookie: bia } })).status, 404);
  assert.equal(
    (
      await call(lessonPath, {
        method: "PATCH",
        headers: { origin, cookie: bia, "content-type": "application/json" },
        body: JSON.stringify({ title: "Alteração indevida" }),
      })
    ).status,
    404,
  );
  assert.deepEqual(
    (await (await call(sessionsPath, { headers: { cookie: bia } })).json()).data,
    [],
  );
  const anaList = await (await call(sessionsPath, { headers: { cookie: ana } })).json();
  assert.deepEqual(
    anaList.data.map((item: { id: string }) => item.id),
    [id],
  );
  const adminList = await (await call(sessionsPath, { headers: { cookie: admin } })).json();
  assert.deepEqual(
    adminList.data.map((item: { id: string }) => item.id),
    [(await legacyLesson.json()).data.id],
  );
  assert.equal((await call("/api/v1/settings", { headers: { cookie: ana } })).status, 403);
  assert.equal(
    (await call("/api/v1/settings/audio-defaults", { headers: { cookie: ana } })).status,
    200,
  );
  assert.equal((await call("/api/v1/settings", { headers: { cookie: admin } })).status, 200);

  const logout = await post("/api/auth/logout", {}, ana);
  assert.match(logout.headers.get("set-cookie") ?? "", /Max-Age=0; Secure$/);
  assert.equal(
    (await post("/api/auth/login", { email: "ana@example.com", password: "wrong" })).status,
    401,
  );
  const login = await post("/api/auth/login", { email: "ANA@example.com", password });
  assert.equal(login.status, 204);
  assert.equal((await call(lessonPath, { headers: { cookie: cookieFrom(login) } })).status, 200);
});
