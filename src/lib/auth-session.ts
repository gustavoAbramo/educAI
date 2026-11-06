import { redirect } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { getRequest, setResponseHeader } from "@tanstack/react-start/server";
import { canManageSettings, getWorkspaceSession } from "@/server/auth";

export const checkWorkspaceSession = createServerFn().handler(() => {
  setResponseHeader("cache-control", "no-store");
  const session = getWorkspaceSession(getRequest());
  return session && { canManageSettings: canManageSettings(session) };
});

export function validateAuthSearch(search: Record<string, unknown>) {
  return { voltar: typeof search.voltar === "string" ? search.voltar : undefined };
}

export async function redirectSignedIn() {
  if (await checkWorkspaceSession()) {
    throw redirect({ to: "/painel", replace: true, headers: { "cache-control": "no-store" } });
  }
}
