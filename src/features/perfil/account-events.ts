import type { AccountProfile } from "@/services/accountService";

// Iniciais para o avatar quando nao ha foto: do nome, ou do e-mail.
export function initials(profile: Pick<AccountProfile, "name" | "email"> | null) {
  const source = profile?.name.trim() || profile?.email.split("@")[0] || "";
  const parts = source.split(/[\s._-]+/).filter(Boolean);
  return ((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "")).toUpperCase() || "?";
}

// Avisa o cabecalho do app quando nome ou foto mudam no Perfil.
const eventName = "educai:account-changed";

export function notifyAccountChanged(profile: AccountProfile) {
  window.dispatchEvent(new CustomEvent<AccountProfile>(eventName, { detail: profile }));
}

export function onAccountChanged(listener: (profile: AccountProfile) => void) {
  const handler = (event: Event) => listener((event as CustomEvent<AccountProfile>).detail);
  window.addEventListener(eventName, handler);
  return () => window.removeEventListener(eventName, handler);
}
