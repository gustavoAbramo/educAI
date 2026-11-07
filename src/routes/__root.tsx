import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  HeadContent,
  Outlet,
  Scripts,
  createRootRouteWithContext,
  redirect,
  useRouterState,
} from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";
import { ConsentBanner } from "@/components/consent-banner";
import { Toaster } from "@/components/ui/sonner";
import { AccessibilityRuntime } from "@/features/accessibility/accessibility-runtime";
import { ErrorPage } from "@/features/system/error-page";
import { NotFoundPage } from "@/features/system/not-found-page";
import { accessibilityBootScript } from "@/lib/accessibility";
import { checkWorkspaceSession } from "@/lib/auth-session";
import { isAuthPath, isProtectedPath, normalizePath } from "@/lib/route-access";
import appCss from "../styles.css?url";

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  beforeLoad: async ({ location }) => {
    // So as telas internas pedem login; as publicas e os enderecos
    // desconhecidos (404) abrem sem sessao.
    if (!isProtectedPath(location.pathname)) return { canManageSettings: false };
    const session = await checkWorkspaceSession();
    if (!session) {
      // Quem clica em "Iniciar nova aula" na landing page precisa entrar
      // primeiro; depois do login a pessoa cai no Início, nao direto na
      // criacao da aula.
      const voltar = normalizePath(location.pathname) === "/nova-aula" ? "/painel" : location.href;
      throw redirect({
        to: "/login",
        search: { voltar },
        replace: true,
        headers: { "cache-control": "no-store" },
      });
    }
    return session;
  },
  head: ({ match }) => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      {
        title: match.globalNotFound
          ? "Página não encontrada | educAI"
          : "educAI — Assistente para aulas, reuniões e mentorias",
      },
      {
        name: "description",
        content:
          "educAI grava sessões, transcreve com IA e gera resumo, tópicos, relatório e materiais automaticamente.",
      },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Inter+Tight:wght@500;600;700&display=swap",
      },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundPage,
  errorComponent: ErrorPage,
});

function RootShell({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" className="dark" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: accessibilityBootScript }} />
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const signedInArea = isProtectedPath(pathname);

  return (
    <QueryClientProvider client={queryClient}>
      {signedInArea ? <AppShell /> : <Outlet />}
      {!isAuthPath(pathname) && <ConsentBanner />}
      <AccessibilityRuntime signedInArea={signedInArea} />
      <Toaster position="bottom-right" />
    </QueryClientProvider>
  );
}
