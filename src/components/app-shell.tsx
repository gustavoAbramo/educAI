import { Link, Outlet, useNavigate, useRouterState } from "@tanstack/react-router";
import {
  Accessibility,
  CalendarDays,
  CircleHelp,
  GraduationCap,
  History,
  LayoutDashboard,
  LogOut,
  Menu,
  Mic,
  Moon,
  PanelLeftClose,
  PanelLeftOpen,
  Search,
  Settings,
  Sparkles,
  Sun,
  UserRound,
  X,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Tooltip } from "@/components/tooltip";
import {
  type NavGroupData,
  type NavItemData,
  SidebarNav,
  SidebarSearch,
} from "@/components/ui/dashboard-sidebar";
import { initials, onAccountChanged } from "@/features/perfil/account-events";
import { screenTitle } from "@/lib/route-access";
import { getAccount, type AccountProfile } from "@/services/accountService";
import { cn } from "@/lib/utils";

const bottomItems: NavItemData[] = [
  { id: "perfil", title: "Perfil", icon: UserRound, to: "/perfil" },
  { id: "configuracoes", title: "Configurações", icon: Settings, to: "/configuracoes" },
];

function useTheme() {
  // O tema escuro e o padrao; o claro so vale se o usuario escolher.
  const [dark, setDark] = useState(true);

  useEffect(() => {
    const isDark = localStorage.getItem("educai-theme") !== "light";
    setDark(isDark);
    document.documentElement.classList.toggle("dark", isDark);
  }, []);

  const toggle = () => {
    const next = !dark;
    setDark(next);
    document.documentElement.classList.toggle("dark", next);
    localStorage.setItem("educai-theme", next ? "dark" : "light");
  };

  return { dark, toggle };
}

export function AppShell() {
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const navigate = useNavigate();
  const { dark, toggle } = useTheme();
  const [mobileNav, setMobileNav] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [searchOpen, setSearchOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [account, setAccount] = useState<AccountProfile | null>(null);

  useEffect(() => {
    let active = true;
    getAccount()
      .then((response) => {
        if (active) setAccount(response.data);
      })
      .catch(() => undefined);
    const stop = onAccountChanged(setAccount);
    return () => {
      active = false;
      stop();
    };
  }, []);

  async function signOut() {
    setSigningOut(true);
    try {
      const response = await fetch("/api/auth/logout", { method: "POST" });
      if (!response.ok) throw new Error("Logout failed");
      window.location.replace("/login");
    } catch {
      toast.error("Não foi possível sair. Tente novamente.");
      setSigningOut(false);
    }
  }

  // A rail so existe no desktop; no celular a sidebar e uma gaveta sempre expandida.
  const [desktop, setDesktop] = useState(true);
  useEffect(() => {
    const query = window.matchMedia("(min-width: 768px)");
    const onChange = () => setDesktop(query.matches);
    onChange();
    query.addEventListener("change", onChange);
    return () => query.removeEventListener("change", onChange);
  }, []);
  const collapsed = desktop && !sidebarOpen;

  useEffect(() => setMobileNav(false), [pathname]);
  useEffect(() => {
    if (!mobileNav) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMobileNav(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [mobileNav]);

  const groups = useMemo<NavGroupData[]>(
    () => [
      {
        items: [
          {
            id: "buscar",
            title: "Buscar",
            icon: Search,
            shortcut: "Ctrl K",
            onSelect: () => setSearchOpen(true),
          },
          { id: "inicio", title: "Início", icon: LayoutDashboard, to: "/painel" },
          { id: "nova-aula", title: "Nova aula", icon: Mic, to: "/nova-aula" },
          { id: "historico", title: "Histórico", icon: History, to: "/historico" },
          { id: "calendario", title: "Calendário", icon: CalendarDays, to: "/calendario" },
        ],
      },
      {
        heading: "Ferramentas",
        items: [
          { id: "assistente", title: "Assistente", icon: Sparkles, to: "/assistente" },
          {
            id: "acessibilidade",
            title: "Acessibilidade",
            icon: Accessibility,
            to: "/acessibilidade",
          },
          { id: "ajuda", title: "Ajuda", icon: CircleHelp, to: "/ajuda" },
        ],
      },
    ],
    [],
  );

  const contextTitle = screenTitle(pathname) ?? "educAI";
  const isRecording = pathname === "/aula";

  const brand = (
    <div className={cn("mb-2 flex items-center py-2", collapsed ? "justify-center" : "gap-3 px-2")}>
      <Link
        to="/painel"
        title={collapsed ? "educAI" : undefined}
        aria-label={collapsed ? "educAI" : undefined}
        className="flex min-w-0 items-center gap-3 rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[6px] bg-primary text-primary-foreground shadow-sm">
          <GraduationCap className="h-4 w-4" strokeWidth={1.75} aria-hidden />
        </div>
        {collapsed ? null : (
          <div className="flex min-w-0 flex-col">
            <span className="mb-1 truncate text-[13px] leading-none font-medium text-foreground">
              educAI
            </span>
            <span className="truncate text-[11px] leading-none text-muted-foreground">
              Aulas assistidas por IA
            </span>
          </div>
        )}
      </Link>
      <button
        onClick={() => setMobileNav(false)}
        className="ml-auto grid h-7 w-7 place-items-center rounded-md text-muted-foreground hover:bg-black/5 md:hidden dark:hover:bg-white/5"
        aria-label="Fechar menu"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );

  return (
    <div className="flex h-screen w-full overflow-hidden bg-background text-foreground">
      <a
        href="#conteudo"
        className="sr-only z-[60] rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground focus:not-sr-only focus:fixed focus:top-3 focus:left-3"
      >
        Pular para o conteúdo
      </a>

      {mobileNav ? (
        <div
          className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm animate-fade-in md:hidden"
          onClick={() => setMobileNav(false)}
        />
      ) : null}

      <aside
        className={cn(
          "fixed z-50 h-full shrink-0 overflow-hidden transition-all duration-300 ease-in-out md:static",
          mobileNav ? "translate-x-0" : "-translate-x-full md:translate-x-0",
          // 65px = icone de 40px + 12px de respiro de cada lado + 1px da borda.
          collapsed ? "w-[65px]" : "w-[260px]",
        )}
        inert={!desktop && !mobileNav ? true : undefined}
        aria-label="Menu principal"
      >
        <SidebarNav
          collapsed={collapsed}
          header={brand}
          groups={groups}
          bottomItems={bottomItems}
          activePath={pathname}
        />
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-14 shrink-0 items-center gap-3 border-b border-border/50 bg-card px-3 sm:px-4">
          <button
            onClick={() => setMobileNav(true)}
            className="grid h-8 w-8 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-black/5 hover:text-foreground md:hidden dark:hover:bg-white/5"
            aria-label="Abrir menu"
            aria-expanded={mobileNav}
          >
            <Menu className="h-[18px] w-[18px]" strokeWidth={1.5} />
          </button>
          <button
            onClick={() => setSidebarOpen((open) => !open)}
            className="hidden rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-black/5 hover:text-foreground md:block dark:hover:bg-white/5"
            aria-label={sidebarOpen ? "Recolher menu" : "Expandir menu"}
            aria-expanded={sidebarOpen}
          >
            {sidebarOpen ? (
              <PanelLeftClose className="h-[18px] w-[18px]" strokeWidth={1.5} />
            ) : (
              <PanelLeftOpen className="h-[18px] w-[18px]" strokeWidth={1.5} />
            )}
          </button>

          <nav
            aria-label="Você está em"
            className="flex min-w-0 flex-1 items-center gap-2 text-sm text-muted-foreground"
          >
            <span className="hidden truncate sm:inline">educAI</span>
            <span className="hidden sm:inline" aria-hidden>
              /
            </span>
            <span className="truncate font-medium text-foreground" aria-current="page">
              {contextTitle}
            </span>
          </nav>

          {isRecording ? (
            <div className="hidden h-8 items-center gap-2 rounded-full border border-destructive/20 bg-destructive/10 px-3 text-xs font-medium text-destructive animate-fade-in sm:flex">
              <span className="h-1.5 w-1.5 rounded-full bg-recording animate-pulse-rec" />
              <span className="tabular-nums">Gravando</span>
            </div>
          ) : null}

          <button
            onClick={() => setSearchOpen(true)}
            className="hidden h-8 w-56 items-center gap-2 rounded-md bg-black/5 px-2.5 text-[13px] text-muted-foreground transition-colors hover:text-foreground lg:flex dark:bg-white/5"
          >
            <Search className="h-4 w-4" strokeWidth={1.5} aria-hidden />
            <span className="flex-1 text-left">Buscar...</span>
            <kbd className="font-mono text-[10px] text-muted-foreground/70">Ctrl K</kbd>
          </button>

          <Tooltip label={dark ? "Tema claro" : "Tema escuro"}>
            <button
              onClick={toggle}
              className="grid h-8 w-8 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-black/5 hover:text-foreground dark:hover:bg-white/5"
              aria-label="Tema escuro"
              aria-pressed={dark}
            >
              {dark ? (
                <Sun className="h-4 w-4" strokeWidth={1.5} />
              ) : (
                <Moon className="h-4 w-4" strokeWidth={1.5} />
              )}
            </button>
          </Tooltip>
          <Tooltip label={account?.name || account?.email || "Perfil"}>
            <Link
              to="/perfil"
              aria-label="Abrir perfil"
              className="grid h-8 w-8 place-items-center overflow-hidden rounded-full bg-gradient-brand-soft text-[11px] font-semibold text-primary outline-none ring-offset-background transition focus-visible:ring-2 focus-visible:ring-ring"
            >
              {account?.avatar ? (
                <img src={account.avatar} alt="" className="h-full w-full object-cover" />
              ) : account ? (
                <span aria-hidden>{initials(account)}</span>
              ) : (
                <UserRound className="h-4 w-4" strokeWidth={1.5} aria-hidden />
              )}
            </Link>
          </Tooltip>
          <Tooltip label="Sair da conta">
            <button
              type="button"
              onClick={signOut}
              disabled={signingOut}
              aria-label="Sair da conta"
              className="grid h-8 w-8 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-black/5 hover:text-foreground disabled:opacity-50 dark:hover:bg-white/5"
            >
              <LogOut className="h-4 w-4" strokeWidth={1.5} aria-hidden />
            </button>
          </Tooltip>
        </header>

        <main
          id="conteudo"
          tabIndex={-1}
          className="no-scrollbar relative flex-1 overflow-auto bg-black/[0.02] outline-none dark:bg-white/[0.02]"
        >
          <Outlet />
        </main>
      </div>

      <SidebarSearch
        open={searchOpen}
        onOpenChange={setSearchOpen}
        groups={groups}
        bottomItems={bottomItems}
        onNavigate={(to) => navigate({ to })}
      />
    </div>
  );
}
