import "./lib/error-capture";

import { consumeLastCapturedError } from "./lib/error-capture";
import { renderErrorPage } from "./lib/error-page";
import {
  authRequired,
  forbiddenOrigin,
  getWorkspaceSession,
  handleAuthRequest,
  isSameOrigin,
} from "./server/auth";
import { setServerRuntimeEnv } from "./server/runtime-env";
import { handleVoiceApiRequest } from "./server/voice-api";

type ServerEntry = {
  fetch: (request: Request, env: unknown, ctx: unknown) => Promise<Response> | Response;
};

let serverEntryPromise: Promise<ServerEntry> | undefined;

const publicApiPaths = new Set(["/api/v1", "/api/v1/", "/api/v1/health", "/api/v1/health/"]);
const readMethods = new Set(["GET", "HEAD", "OPTIONS"]);

async function getServerEntry(): Promise<ServerEntry> {
  if (!serverEntryPromise) {
    serverEntryPromise = import("@tanstack/react-start/server-entry").then(
      (m) => (m as { default?: ServerEntry }).default ?? (m as unknown as ServerEntry),
    );
  }
  return serverEntryPromise;
}

function brandedErrorResponse(): Response {
  return new Response(renderErrorPage(), {
    status: 500,
    headers: { "content-type": "text/html; charset=utf-8" },
  });
}

function isCatastrophicSsrErrorBody(body: string, responseStatus: number): boolean {
  let payload: unknown;
  try {
    payload = JSON.parse(body);
  } catch {
    return false;
  }

  if (!payload || Array.isArray(payload) || typeof payload !== "object") {
    return false;
  }

  const fields = payload as Record<string, unknown>;
  const expectedKeys = new Set(["message", "status", "unhandled"]);
  if (!Object.keys(fields).every((key) => expectedKeys.has(key))) {
    return false;
  }

  return (
    fields.unhandled === true &&
    fields.message === "HTTPError" &&
    (fields.status === undefined || fields.status === responseStatus)
  );
}

// h3 swallows in-handler throws into a normal 500 Response with body
// {"unhandled":true,"message":"HTTPError"} — try/catch alone never fires for those.
async function normalizeCatastrophicSsrResponse(response: Response): Promise<Response> {
  if (response.status < 500) return response;
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) return response;

  const body = await response.clone().text();
  if (!isCatastrophicSsrErrorBody(body, response.status)) {
    return response;
  }

  console.error(consumeLastCapturedError() ?? new Error(`h3 swallowed SSR error: ${body}`));
  return brandedErrorResponse();
}

export default {
  async fetch(request: Request, env: unknown, ctx: unknown) {
    try {
      setServerRuntimeEnv(env);
      const url = new URL(request.url);
      if (url.pathname.startsWith("/api/auth/")) return await handleAuthRequest(request, url);

      const privateApi = url.pathname.startsWith("/api/v1") && !publicApiPaths.has(url.pathname);
      const session = privateApi ? getWorkspaceSession(request) : null;
      if (privateApi && !session) return authRequired();
      if (privateApi && !readMethods.has(request.method) && !isSameOrigin(request)) {
        return forbiddenOrigin();
      }
      const apiResponse = await handleVoiceApiRequest(request, session ?? undefined);
      if (apiResponse) {
        if (privateApi) {
          apiResponse.headers.set("cache-control", "no-store");
          apiResponse.headers.delete("access-control-allow-origin");
        }
        return apiResponse;
      }

      const handler = await getServerEntry();
      const response = await handler.fetch(request, env, ctx);
      return await normalizeCatastrophicSsrResponse(response);
    } catch (error) {
      console.error(error);
      return brandedErrorResponse();
    }
  },
};
