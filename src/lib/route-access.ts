// Mapa unico de quais telas pedem login e quais usam o layout do app.
// Rotas desconhecidas nao estao em nenhuma lista: caem na pagina 404 sem
// mandar a pessoa para o login.

export const authPaths = new Set(["/login", "/cadastro"]);

export const protectedPaths = new Set([
  "/painel",
  "/nova-aula",
  "/aula",
  "/processando",
  "/resultado",
  "/historico",
  "/assistente",
  "/acessibilidade",
  "/configuracoes",
  "/calendario",
  "/perfil",
  "/ajuda",
]);

export function normalizePath(pathname: string) {
  return pathname.replace(/\/+$/, "") || "/";
}

export function isProtectedPath(pathname: string) {
  return protectedPaths.has(normalizePath(pathname));
}

export function isAuthPath(pathname: string) {
  return authPaths.has(normalizePath(pathname));
}

// Titulo curto de cada tela, usado no cabecalho do app e no anuncio de
// navegacao para leitores de tela.
export const screenTitles: Record<string, string> = {
  "/": "Início",
  "/login": "Entrar",
  "/cadastro": "Criar conta",
  "/termos": "Termos e privacidade",
  "/painel": "Início",
  "/nova-aula": "Nova aula",
  "/aula": "Aula em andamento",
  "/processando": "Processando aula",
  "/resultado": "Resultado da sessão",
  "/historico": "Histórico",
  "/assistente": "Assistente",
  "/acessibilidade": "Acessibilidade",
  "/configuracoes": "Configurações",
  "/calendario": "Calendário",
  "/perfil": "Perfil",
  "/ajuda": "Ajuda",
};

export function screenTitle(pathname: string) {
  return screenTitles[normalizePath(pathname)];
}

export function pageHead(pathname: string) {
  const title = screenTitle(pathname);
  return { meta: [{ title: title ? `${title} | educAI` : "educAI" }] };
}
