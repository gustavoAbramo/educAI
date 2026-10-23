import { serverEnv } from "./runtime-env";

function envFlag(name: string) {
  const value = serverEnv(name)?.trim().toLowerCase();
  return value === "1" || value === "true" || value === "yes" || value === "on";
}

function isPrivateIpv4(hostname: string) {
  const parts = hostname.split(".").map(Number);
  if (
    parts.length !== 4 ||
    parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)
  ) {
    return false;
  }

  return (
    parts[0] === 10 ||
    parts[0] === 127 ||
    (parts[0] === 169 && parts[1] === 254) ||
    (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) ||
    (parts[0] === 192 && parts[1] === 168)
  );
}

function isPrivateIpv6(hostname: string) {
  const normalized = hostname.replace(/^\[|\]$/g, "").toLowerCase();
  return (
    normalized === "::1" ||
    normalized.startsWith("fc") ||
    normalized.startsWith("fd") ||
    normalized.startsWith("fe8") ||
    normalized.startsWith("fe9") ||
    normalized.startsWith("fea") ||
    normalized.startsWith("feb")
  );
}

function isLocalHostname(hostname: string) {
  const normalized = hostname.toLowerCase();
  return (
    normalized === "localhost" ||
    normalized === "host.docker.internal" ||
    normalized.endsWith(".localhost") ||
    normalized.endsWith(".local") ||
    !normalized.includes(".") ||
    isPrivateIpv4(normalized) ||
    isPrivateIpv6(normalized)
  );
}

export function normalizeLocalProviderBaseUrl(value: string, label: string) {
  const trimmed = value.trim();
  if (!trimmed) {
    throw new Error(`${label} URL is required.`);
  }

  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    throw new Error(`${label} URL must be a valid absolute URL.`);
  }

  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error(`${label} URL must use http or https.`);
  }
  if (url.username || url.password) {
    throw new Error(`${label} URL must not include credentials.`);
  }
  if (url.search || url.hash) {
    throw new Error(`${label} URL must not include query parameters or fragments.`);
  }
  if (!isLocalHostname(url.hostname) && !envFlag("EDUCAI_ALLOW_REMOTE_LOCAL_PROVIDERS")) {
    throw new Error(
      `${label} URL must point to localhost or a private network. Set EDUCAI_ALLOW_REMOTE_LOCAL_PROVIDERS=true to allow remote endpoints.`,
    );
  }

  return url.toString().replace(/\/+$/, "");
}
