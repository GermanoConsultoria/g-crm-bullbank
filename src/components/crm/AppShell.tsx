import { Link, Outlet, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  LayoutDashboard,
  Users,
  KanbanSquare,
  ListChecks,
  BarChart3,
  Wallet,
  Tags,
  UserCog,
  LogOut,
  PanelLeftOpen,
  Banknote,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  ClipboardList,
} from "lucide-react";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";

import { supabase } from "@/integrations/supabase/client";
import { fetchFunnels, fetchMyRole } from "@/lib/crm";
import { getSupportUrl } from "@/lib/support";
import { ForcePasswordDialog } from "@/components/crm/ForcePasswordDialog";

const nav = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/clientes",  label: "Contatos",  icon: Users },
  { to: "/funil",     label: "Funil",     icon: KanbanSquare },
  { to: "/tarefas",   label: "Tarefas",   icon: ListChecks },
  { to: "/formularios", label: "Formulários", icon: ClipboardList },
  { to: "/relatorios",label: "Relatórios",icon: BarChart3 },
  { to: "/comissoes", label: "Comissões", icon: Wallet },
  { to: "/tipos-de-lead", label: "Tipos de lead", icon: Tags, adminOnly: true },
  { to: "/usuarios", label: "Usuários", icon: UserCog, adminOnly: true },
] as const;

const MIN_W = 48;   // colapsada (só ícones)
const MAX_W = 320;
const DEFAULT_W = 240;
const SNAP_COLLAPSED = 72; // abaixo disso → colapsa para ícones

// Slots do header ficam no shell persistente; cada página porta seu
// título/ações para dentro deles em vez de remontar o shell inteiro.
const HeaderSlotContext = createContext<{ titleSlot: HTMLDivElement | null; actionsSlot: HTMLDivElement | null }>({
  titleSlot: null,
  actionsSlot: null,
});

// Chrome persistente: sidebar, header e drawer mobile. Renderizado uma única
// vez pelo layout `_authenticated`, então não remonta a cada navegação.
export function AppShellChrome() {
  const navigate = useNavigate();
  const { data: role } = useQuery({ queryKey: ["my-role"], queryFn: fetchMyRole });
  const { data: funnels = [] } = useQuery({ queryKey: ["funnels"], queryFn: fetchFunnels });
  const [funilExpanded, setFunilExpanded] = useState(false);
  const visibleNav = nav.filter((item) => !("adminOnly" in item && item.adminOnly) || role === "admin");
  const { data: user } = useQuery({
    queryKey: ["auth-user"],
    queryFn: async () => (await supabase.auth.getUser()).data.user,
  });
  const { data: mustChangePassword } = useQuery({
    queryKey: ["force-password-change", user?.id],
    queryFn: async () => {
      if (!user) return false;
      const { data } = await supabase
        .from("profiles")
        .select("force_password_change")
        .eq("id", user.id)
        .maybeSingle();
      return data?.force_password_change ?? false;
    },
    enabled: !!user,
  });

  const [width, setWidth] = useState<number>(() => {
    const saved = localStorage.getItem("sidebar-w");
    return saved ? Number(saved) : DEFAULT_W;
  });
  const [mobileOpen, setMobileOpen] = useState(false);
  const dragging = useRef(false);
  const startX = useRef(0);
  const startW = useRef(0);

  const collapsed = width <= SNAP_COLLAPSED;

  const onMouseDown = useCallback((e: React.MouseEvent) => {
    dragging.current = true;
    startX.current = e.clientX;
    startW.current = width;
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
  }, [width]);

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (!dragging.current) return;
      const delta = e.clientX - startX.current;
      const next = Math.min(MAX_W, Math.max(MIN_W, startW.current + delta));
      setWidth(next);
    };
    const onUp = () => {
      if (!dragging.current) return;
      dragging.current = false;
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
      setWidth((w) => {
        const snapped = w < SNAP_COLLAPSED ? MIN_W : w;
        localStorage.setItem("sidebar-w", String(snapped));
        return snapped;
      });
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, []);

  const signOut = async () => {
    await supabase.auth.signOut();
    navigate({ to: "/auth" });
  };

  const [titleSlot, setTitleSlot] = useState<HTMLDivElement | null>(null);
  const [actionsSlot, setActionsSlot] = useState<HTMLDivElement | null>(null);
  const slotValue = useMemo(() => ({ titleSlot, actionsSlot }), [titleSlot, actionsSlot]);

  const sidebarContent = (
    <>
      <div className={`pb-6 flex ${collapsed ? "flex-col items-center gap-2 px-0" : "items-center gap-2 px-2"}`}>
        <div className="flex size-8 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-white">
          <img src="/brand/logo-icon.png" alt="Blue Moon CRM" className="size-6 object-contain" />
        </div>
        {!collapsed && (
          <div className="flex-1">
            <p className="text-sm font-semibold tracking-tight text-sidebar-foreground">Blue Moon CRM</p>
            <p className="text-xs text-muted-foreground">Gestão comercial</p>
          </div>
        )}
      </div>

      <nav className="flex flex-1 flex-col gap-1 overflow-y-auto">
        {visibleNav.map((item) => {
          if (item.to === "/funil" && !collapsed) {
            return (
              <div key={item.to}>
                <div className="flex items-center gap-1">
                  <Link
                    to={item.to}
                    className="flex flex-1 items-center gap-2.5 rounded-md px-2.5 py-2 text-sm text-muted-foreground transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                    activeProps={{ className: "bg-sidebar-accent text-sidebar-accent-foreground font-medium" }}
                    onClick={() => setMobileOpen(false)}
                  >
                    <item.icon className="size-4 shrink-0" />
                    {item.label}
                  </Link>
                  <button
                    type="button"
                    className="flex size-7 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                    onClick={() => setFunilExpanded((v) => !v)}
                    title={funilExpanded ? "Recolher funis" : "Ver funis cadastrados"}
                  >
                    {funilExpanded ? <ChevronDown className="size-3.5" /> : <ChevronRight className="size-3.5" />}
                  </button>
                </div>
                {funilExpanded && (
                  <div className="ml-4 flex flex-col gap-0.5 border-l border-sidebar-border py-1 pl-3">
                    {funnels.map((funnel) => (
                      <Link
                        key={funnel.id}
                        to="/funil/$funnelId"
                        params={{ funnelId: funnel.id }}
                        className="truncate rounded-md px-2 py-1.5 text-xs text-muted-foreground transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                        activeProps={{ className: "bg-sidebar-accent text-sidebar-accent-foreground font-medium" }}
                        onClick={() => setMobileOpen(false)}
                      >
                        {funnel.name}
                      </Link>
                    ))}
                    {funnels.length === 0 && (
                      <p className="px-2 py-1 text-xs text-muted-foreground">Nenhum funil cadastrado</p>
                    )}
                  </div>
                )}
              </div>
            );
          }
          return (
            <Link
              key={item.to}
              to={item.to}
              title={collapsed ? item.label : undefined}
              className={`flex items-center gap-2.5 rounded-md py-2 text-sm text-muted-foreground transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground ${collapsed ? "justify-center px-0" : "px-2.5"}`}
              activeProps={{ className: "bg-sidebar-accent text-sidebar-accent-foreground font-medium" }}
              onClick={() => setMobileOpen(false)}
            >
              <item.icon className="size-4 shrink-0" />
              {!collapsed && item.label}
            </Link>
          );
        })}
      </nav>

      <button
        type="button"
        disabled
        title="Financeiro (em breve)"
        className={`flex cursor-not-allowed items-center gap-2.5 rounded-md py-2 text-sm text-muted-foreground/50 ${collapsed ? "justify-center px-0" : "px-2.5"}`}
      >
        <Banknote className="size-4 shrink-0" />
        {!collapsed && "Financeiro"}
      </button>

      <div className="border-t border-sidebar-border pt-3">
        {!collapsed && (
          <div className="px-2.5 pb-2">
            <p className="truncate text-xs font-medium text-sidebar-foreground">{user?.email ?? "—"}</p>
            <p className="text-xs capitalize text-muted-foreground">{role ?? ""}</p>
          </div>
        )}
        <button
          onClick={signOut}
          title={collapsed ? "Sair" : undefined}
          className={`flex w-full items-center gap-2.5 rounded-md py-2 text-sm text-muted-foreground transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground ${collapsed ? "justify-center px-0" : "px-2.5"}`}
        >
          <LogOut className="size-4 shrink-0" /> {!collapsed && "Sair"}
        </button>
      </div>
    </>
  );

  return (
    <div className="flex min-h-screen bg-background">
      {/* ── Sidebar desktop ── */}
      <aside
        style={{ width }}
        className="relative hidden shrink-0 flex-col border-r border-sidebar-border bg-sidebar py-5 md:flex sticky top-0 h-screen"
        aria-label="Navegação"
      >
        <div className={`flex h-full flex-col overflow-hidden ${collapsed ? "px-2" : "px-3"}`}>
          {sidebarContent}
        </div>

        {/* Handle de resize */}
        <div
          onMouseDown={onMouseDown}
          className="absolute right-0 top-0 h-full w-1 cursor-col-resize hover:bg-primary/40 active:bg-primary/60 transition-colors"
          role="separator"
          aria-orientation="vertical"
          aria-label="Redimensionar sidebar"
        />

        {/* Toggle recolher/expandir — flutuante no meio da borda */}
        <button
          onClick={() => {
            const next = collapsed ? DEFAULT_W : MIN_W;
            setWidth(next);
            localStorage.setItem("sidebar-w", String(next));
          }}
          className="absolute -right-3.5 top-1/2 z-10 flex size-7 -translate-y-1/2 items-center justify-center rounded-full border border-sidebar-border bg-background text-muted-foreground shadow-md ring-1 ring-black/5 backdrop-blur transition-all duration-200 hover:scale-110 hover:border-primary/50 hover:text-primary hover:shadow-lg active:scale-95"
          title={collapsed ? "Expandir sidebar" : "Colapsar sidebar"}
        >
          {collapsed ? <ChevronRight className="size-4" /> : <ChevronLeft className="size-4" />}
        </button>
      </aside>

      {/* ── Sidebar mobile (drawer) ── */}
      {mobileOpen && (
        <div className="fixed inset-0 z-40 md:hidden">
          <div className="absolute inset-0 bg-black/50" onClick={() => setMobileOpen(false)} />
          <aside className="absolute left-0 top-0 h-full w-60 flex flex-col border-r border-sidebar-border bg-sidebar px-3 py-5 z-50">
            {sidebarContent}
          </aside>
        </div>
      )}

      <main className="flex-1 overflow-x-hidden">
        <header className="flex flex-wrap items-end justify-between gap-3 border-b border-border px-5 py-4 md:px-8">
          <div className="flex items-center gap-3">
            {/* botão mobile */}
            <button
              className="md:hidden rounded-md p-1.5 text-muted-foreground hover:bg-accent"
              onClick={() => setMobileOpen(true)}
            >
              <PanelLeftOpen className="size-5" />
            </button>
            {/* preenchido via portal pela página atual (AppShell) */}
            <div ref={setTitleSlot} />
          </div>
          <div ref={setActionsSlot} className="flex items-center gap-2" />
        </header>

        {/* nav mobile scroll (fallback rápido) */}
        <nav className="flex gap-1 overflow-x-auto border-b border-border px-3 py-2 md:hidden">
          {visibleNav.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              className="whitespace-nowrap rounded-md px-2.5 py-1.5 text-xs text-muted-foreground"
              activeProps={{ className: "bg-secondary text-secondary-foreground" }}
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <HeaderSlotContext.Provider value={slotValue}>
          <Outlet />
        </HeaderSlotContext.Provider>
      </main>

      {mustChangePassword && user && <ForcePasswordDialog userId={user.id} />}

      <a
        href={getSupportUrl()}
        target="_blank"
        rel="noopener noreferrer"
        title="Suporte via WhatsApp"
        className="fixed bottom-5 right-5 z-50 flex size-14 items-center justify-center rounded-full bg-[#25D366] text-white shadow-lg transition-transform hover:scale-105 hover:shadow-xl"
      >
        <svg viewBox="0 0 24 24" fill="currentColor" className="size-7" aria-hidden="true">
          <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z" />
          <path d="M12.001 2c-5.514 0-9.987 4.472-9.987 9.987 0 1.761.462 3.482 1.34 4.997L2 22l5.146-1.34a9.955 9.955 0 0 0 4.855 1.237h.004c5.514 0 9.987-4.472 9.987-9.987 0-2.668-1.037-5.176-2.922-7.062A9.928 9.928 0 0 0 12.001 2zm0 18.276h-.003a8.29 8.29 0 0 1-4.223-1.155l-.303-.18-3.053.795.815-2.977-.198-.306a8.276 8.276 0 0 1-1.269-4.466c0-4.575 3.723-8.298 8.302-8.298 2.217 0 4.301.864 5.87 2.434a8.24 8.24 0 0 1 2.43 5.87c0 4.576-3.723 8.283-8.368 8.283z" />
        </svg>
      </a>
    </div>
  );
}

// Usado por cada rota: porta título/ações para os slots fixos do shell
// persistente em vez de renderizar sidebar/header próprios.
export function AppShell({
  title,
  subtitle,
  actions,
  children,
}: {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
  children: ReactNode;
}) {
  const { titleSlot, actionsSlot } = useContext(HeaderSlotContext);

  return (
    <>
      {titleSlot &&
        createPortal(
          <>
            <h1 className="text-lg font-semibold text-foreground">{title}</h1>
            {subtitle && <p className="text-sm text-muted-foreground">{subtitle}</p>}
          </>,
          titleSlot,
        )}
      {actionsSlot && actions && createPortal(actions, actionsSlot)}
      <div className="px-5 py-6 md:px-8">{children}</div>
    </>
  );
}
