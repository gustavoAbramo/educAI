import { Link } from "@tanstack/react-router";
import { ChevronRight, Command, Search, X } from "lucide-react";
import { type ElementType, type ReactNode, useEffect, useMemo, useState } from "react";
import { cn } from "@/lib/utils";

export type NavItemData = {
  id: string;
  title: string;
  icon: ElementType;
  /** Rota de destino. Itens sem `to` precisam de `onSelect` ou `children`. */
  to?: string;
  badge?: number | string;
  shortcut?: string;
  onSelect?: () => void;
  children?: NavItemData[];
};

export type NavGroupData = {
  heading?: string;
  items: NavItemData[];
};

function NavItem({
  item,
  activePath,
  level = 0,
  collapsed = false,
}: {
  item: NavItemData;
  activePath: string;
  level?: number;
  collapsed?: boolean;
}) {
  const hasChildren = Boolean(item.children?.length);
  const childActive = item.children?.some((child) => child.to === activePath) ?? false;
  const [isOpen, setIsOpen] = useState(childActive);
  const isActive = item.to === activePath;

  const rowClassName = cn(
    "group relative flex items-center rounded-[6px] transition-all duration-200 select-none outline-none focus-visible:ring-2 focus-visible:ring-ring",
    collapsed
      ? "mx-auto size-10 shrink-0 justify-center"
      : "w-full justify-between py-[7px] pr-2.5 text-left",
    isActive
      ? "bg-black/5 font-medium text-foreground dark:bg-white/10"
      : "text-muted-foreground hover:bg-black/5 hover:text-foreground/90 dark:hover:bg-white/5",
  );

  // Na rail so ha o icone: o nome vai para o title/aria-label e o badge vira uma bolinha.
  const content = collapsed ? (
    <>
      <item.icon
        className={cn(
          "h-[18px] w-[18px] shrink-0 transition-colors",
          isActive ? "text-foreground" : "text-muted-foreground/70 group-hover:text-foreground/70",
        )}
        strokeWidth={1.5}
        aria-hidden
      />
      {item.badge !== undefined ? (
        <span
          aria-hidden
          className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-primary ring-2 ring-sidebar"
        />
      ) : null}
    </>
  ) : (
    <>
      <span className="flex min-w-0 items-center gap-2.5">
        <item.icon
          className={cn(
            "h-4 w-4 shrink-0 transition-colors",
            isActive
              ? "text-foreground"
              : "text-muted-foreground/70 group-hover:text-foreground/70",
          )}
          strokeWidth={1.5}
          aria-hidden
        />
        <span className="truncate text-[13px] tracking-wide">{item.title}</span>
      </span>
      <span className="flex items-center gap-2">
        {item.shortcut ? (
          <kbd className="hidden h-5 items-center justify-center rounded-[4px] border border-border/50 bg-background/50 px-1.5 font-mono text-[10px] font-medium text-muted-foreground/60 group-hover:inline-flex">
            {item.shortcut}
          </kbd>
        ) : null}
        {item.badge !== undefined ? (
          <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-primary/10 px-1.5 text-[10px] font-medium text-primary">
            {item.badge}
          </span>
        ) : null}
        {hasChildren ? (
          <ChevronRight
            className={cn(
              "h-3.5 w-3.5 text-muted-foreground/50 transition-transform duration-200",
              isOpen && "rotate-90",
            )}
            strokeWidth={2}
            aria-hidden
          />
        ) : null}
      </span>
    </>
  );

  const style = collapsed ? undefined : { paddingLeft: `${level * 12 + 10}px` };
  const title = collapsed
    ? item.shortcut
      ? `${item.title} (${item.shortcut})`
      : item.title
    : undefined;
  const ariaLabel = collapsed ? item.title : undefined;

  return (
    <div className="flex w-full flex-col">
      {item.to && !hasChildren ? (
        <Link
          to={item.to}
          className={rowClassName}
          style={style}
          title={title}
          aria-label={ariaLabel}
          aria-current={isActive ? "page" : undefined}
          onClick={item.onSelect}
        >
          {content}
        </Link>
      ) : (
        <button
          type="button"
          className={rowClassName}
          style={style}
          title={title}
          aria-label={ariaLabel}
          aria-expanded={hasChildren ? isOpen : undefined}
          onClick={() => (hasChildren ? setIsOpen((open) => !open) : item.onSelect?.())}
        >
          {content}
        </button>
      )}

      {hasChildren ? (
        <div
          className={cn(
            "grid transition-[grid-template-rows,opacity] duration-300 ease-in-out",
            isOpen ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0",
          )}
          inert={!isOpen}
        >
          <div className="relative mt-0.5 flex min-h-0 flex-col gap-0.5 overflow-hidden">
            {collapsed ? null : (
              <div
                className="absolute top-0 bottom-0 border-l border-black/5 dark:border-white/5"
                style={{ left: `${level * 12 + 17.5}px` }}
              />
            )}
            {item.children!.map((child) => (
              <NavItem
                key={child.id}
                item={child}
                activePath={activePath}
                level={level + 1}
                collapsed={collapsed}
              />
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}

export function SidebarNav({
  className,
  header,
  groups,
  bottomItems = [],
  activePath,
  collapsed = false,
}: {
  className?: string;
  header?: ReactNode;
  groups: NavGroupData[];
  bottomItems?: NavItemData[];
  activePath: string;
  /** "Rail": so os icones, com o nome em title/aria-label. A largura vem de quem monta. */
  collapsed?: boolean;
}) {
  return (
    <nav
      aria-label="Navegação principal"
      className={cn(
        "flex h-full w-full flex-col border-r border-border/50 bg-sidebar p-3 font-sans",
        className,
      )}
    >
      {header}

      <div className="no-scrollbar mt-2 flex flex-1 flex-col gap-4 overflow-x-hidden overflow-y-auto">
        {groups.map((group, index) => (
          <div key={group.heading ?? index} className="flex flex-col gap-0.5">
            {group.heading ? (
              collapsed ? (
                <hr className="mx-2 mb-1 border-border/50" aria-hidden />
              ) : (
                <span className="mb-1 px-2.5 text-[11px] font-semibold tracking-wider text-muted-foreground/50 uppercase">
                  {group.heading}
                </span>
              )
            ) : null}
            {group.items.map((item) => (
              <NavItem key={item.id} item={item} activePath={activePath} collapsed={collapsed} />
            ))}
          </div>
        ))}
      </div>

      {bottomItems.length ? (
        <div className="mt-auto flex flex-col gap-0.5 border-t border-border/50 pt-4">
          {bottomItems.map((item) => (
            <NavItem key={item.id} item={item} activePath={activePath} collapsed={collapsed} />
          ))}
        </div>
      ) : null}
    </nav>
  );
}

function flattenItems(items: NavItemData[]): NavItemData[] {
  return items.flatMap((item) => [item, ...flattenItems(item.children ?? [])]);
}

/** Busca rapida (Ctrl/⌘ + K) pelos itens navegaveis da sidebar. */
export function SidebarSearch({
  open,
  onOpenChange,
  groups,
  bottomItems = [],
  onNavigate,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  groups: NavGroupData[];
  bottomItems?: NavItemData[];
  onNavigate: (to: string) => void;
}) {
  const [query, setQuery] = useState("");

  const destinations = useMemo(
    () =>
      flattenItems([...groups.flatMap((group) => group.items), ...bottomItems]).filter(
        (item) => item.to,
      ),
    [groups, bottomItems],
  );
  const results = destinations.filter((item) =>
    item.title.toLowerCase().includes(query.trim().toLowerCase()),
  );

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        onOpenChange(!open);
      } else if (event.key === "Escape" && open) {
        onOpenChange(false);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onOpenChange]);

  useEffect(() => {
    if (!open) setQuery("");
  }, [open]);

  if (!open) return null;

  const go = (to: string) => {
    onOpenChange(false);
    onNavigate(to);
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-start justify-center bg-background/40 px-4 pt-[15vh] backdrop-blur-sm">
      <div className="absolute inset-0" onClick={() => onOpenChange(false)} />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Buscar"
        className="relative w-full max-w-xl overflow-hidden rounded-xl border border-border/50 bg-card shadow-2xl animate-in fade-in zoom-in-95 duration-200"
      >
        <div className="flex items-center border-b border-border/50 px-4">
          <Search
            className="mr-3 h-[18px] w-[18px] shrink-0 text-muted-foreground/70"
            strokeWidth={1.5}
            aria-hidden
          />
          <input
            autoFocus
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && results[0]?.to) go(results[0].to);
            }}
            aria-label="Buscar telas"
            className="flex-1 bg-transparent py-4 text-[14px] text-foreground outline-none placeholder:text-muted-foreground/50"
            placeholder="Buscar telas e ações..."
          />
          <kbd className="ml-2 hidden h-5 items-center justify-center rounded-[4px] border border-black/10 bg-black/5 px-1.5 font-mono text-[10px] font-medium text-muted-foreground/70 sm:inline-flex dark:border-white/10 dark:bg-white/10">
            ESC
          </kbd>
          <button
            onClick={() => onOpenChange(false)}
            className="ml-3 rounded-md p-1 text-muted-foreground/70 transition-colors hover:bg-black/5 hover:text-foreground dark:hover:bg-white/10"
            aria-label="Fechar busca"
          >
            <X className="h-[18px] w-[18px]" strokeWidth={1.5} />
          </button>
        </div>

        {results.length ? (
          <ul className="flex flex-col gap-0.5 p-2">
            {results.map((item) => (
              <li key={item.id}>
                <button
                  onClick={() => go(item.to!)}
                  className="flex w-full items-center gap-2.5 rounded-md px-3 py-2 text-left text-[13px] text-foreground/85 transition-colors outline-none hover:bg-black/5 focus-visible:bg-black/5 dark:hover:bg-white/5 dark:focus-visible:bg-white/5"
                >
                  <item.icon
                    className="h-4 w-4 text-muted-foreground"
                    strokeWidth={1.5}
                    aria-hidden
                  />
                  {item.title}
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <div className="flex flex-col items-center justify-center p-2 py-8">
            <Command className="mb-2 h-6 w-6 text-muted-foreground/30" strokeWidth={1.5} />
            <p className="text-[13px] font-medium text-muted-foreground">Nada encontrado.</p>
          </div>
        )}
      </div>
    </div>
  );
}
