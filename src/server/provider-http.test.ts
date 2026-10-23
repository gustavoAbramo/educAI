import * as assert from "node:assert/strict";
import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import { afterEach, describe, it } from "node:test";
import { ProviderHttpError, requestProviderJson } from "./provider-http";

const servers: Server[] = [];

afterEach(async () => {
  while (servers.length > 0) {
    const server = servers.pop();
    if (!server) continue;
    await new Promise<void>((resolve, reject) => {
      server.close((error) => {
        if (error) reject(error);
        else resolve();
      });
    });
  }
});

type TestRequestHandler = (request: IncomingMessage, response: ServerResponse) => void;

async function startServer(handler: TestRequestHandler) {
  const server = createServer(handler);
  servers.push(server);
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("Test server address unavailable.");
  return `http://127.0.0.1:${address.port}`;
}

describe("provider HTTP client", () => {
  it("returns parsed JSON from a healthy provider", async () => {
    const baseUrl = await startServer((_req, res) => {
      res.setHeader("content-type", "application/json");
      res.end(JSON.stringify({ status: "ok" }));
    });

    const payload = await requestProviderJson({
      provider: "Test Provider",
      url: baseUrl,
      timeoutMs: 500,
    });

    assert.equal(payload.status, "ok");
  });

  it("fails with a typed timeout error", async () => {
    const baseUrl = await startServer((_req, res) => {
      setTimeout(() => {
        res.setHeader("content-type", "application/json");
        res.end(JSON.stringify({ status: "late" }));
      }, 80);
    });

    await assert.rejects(
      () =>
        requestProviderJson({
          provider: "Slow Provider",
          url: baseUrl,
          timeoutMs: 20,
        }),
      (error: unknown) =>
        error instanceof ProviderHttpError &&
        error.code === "TIMEOUT" &&
        /timed out after 20ms/i.test(error.message),
    );
  });

  it("fails clearly when a provider returns invalid JSON", async () => {
    const baseUrl = await startServer((_req, res) => {
      res.setHeader("content-type", "text/plain");
      res.end("not-json");
    });

    await assert.rejects(
      () =>
        requestProviderJson({
          provider: "Broken Provider",
          url: baseUrl,
          timeoutMs: 500,
        }),
      (error: unknown) =>
        error instanceof ProviderHttpError &&
        error.code === "INVALID_JSON" &&
        /invalid JSON/i.test(error.message),
    );
  });
});
