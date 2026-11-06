export const defaultDestination = "/painel";

// Aceita so caminhos internos para o "voltar" depois do login, evitando
// redirecionamento aberto para outro site.
export function localDestination(value: unknown) {
  if (typeof value !== "string" || !value.startsWith("/") || value.length > 2048) {
    return defaultDestination;
  }
  const base = "https://educai.invalid";
  if (!URL.canParse(value, base)) return defaultDestination;
  const url = new URL(value, base);
  if (
    url.origin !== base ||
    url.pathname.startsWith("//") ||
    /^\/(login|cadastro)\/*$/.test(url.pathname)
  ) {
    return defaultDestination;
  }
  return `${url.pathname}${url.search}${url.hash}`;
}
