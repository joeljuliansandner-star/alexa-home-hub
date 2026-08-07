import {
  Link,
  Outlet,
  createFileRoute,
  redirect,
  useNavigate,
  useRouterState,
} from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  LayoutDashboard,
  Sparkles,
  Timer,
  Settings2,
  Home,
  Bot,
  DoorOpen,
  LogOut,
  House,
  Activity,
  Brain,
  Zap,
  Camera,
  Bell,
} from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

import { useHaConnection, useHomeAssistantLive } from "@/services/homeAssistant.hooks";
import { useTelemetryRecorder } from "@/lib/os/telemetry";
import { GlobalSearch, GlobalSearchButton } from "@/components/os/GlobalSearch";
import { NotificationCenter } from "@/components/os/NotificationCenter";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    const { data } = await supabase.auth.getSession();
    if (!data.session) throw redirect({ to: "/auth" });
  },
  component: AuthenticatedLayout,
});

const nav = [
  { to: "/home", label: "Startseite", shortLabel: "Start", icon: Home },
  { to: "/dashboard", label: "Übersicht", shortLabel: "Geräte", icon: LayoutDashboard },
  { to: "/rooms", label: "Räume", shortLabel: "Räume", icon: DoorOpen },
  { to: "/vacuum", label: "Staubsauger", shortLabel: "Staubi", icon: Bot },
  { to: "/scenes", label: "Szenen", shortLabel: "Szenen", icon: Sparkles },
  { to: "/automations", label: "Automationen", shortLabel: "Regeln", icon: Timer },
  { to: "/settings", label: "Einstellungen", shortLabel: "Setup", icon: Settings2 },
] as const;

const osNav = [
  { to: "/insights", label: "Smart Insights", icon: Brain },
  { to: "/status", label: "Hausstatus", icon: Activity },
  { to: "/energy", label: "Energie", icon: Zap },
  { to: "/cameras", label: "Kameras", icon: Camera },
] as const;

function AuthenticatedLayout() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [email, setEmail] = useState<string | null>(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);

  // Home Assistant ist die einzige Datenquelle: verbinden, live aktualisieren
  // und Registry-Änderungen automatisch abgleichen.
  useHomeAssistantLive();

  // Version 5.0: lokale Telemetrie für Muster- und Trendanalysen aufzeichnen.
  useTelemetryRecorder();

  const haConnection = useHaConnection();
  const pathname = useRouterState({ select: (state) => state.location.pathname });

  useEffect(() => {
    if (haConnection.isLoading) return;
    if (haConnection.data) return;
    if (pathname.startsWith("/setup") || pathname.startsWith("/integration")) return;
    navigate({ to: "/setup", replace: true });
  }, [haConnection.isLoading, haConnection.data, pathname, navigate]);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setEmail(data.user?.email ?? "Gastzugang"));
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_OUT") navigate({ to: "/auth", replace: true });
    });
    return () => sub.subscription.unsubscribe();
  }, [navigate]);

  async function handleSignOut() {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  return (
    <div className="hero-glow min-h-dvh">
      <div className="mx-auto flex min-h-dvh w-full max-w-7xl flex-col gap-5 px-4 py-4 md:flex-row md:gap-8 md:px-8 md:py-8">
        <aside className="md:w-60 md:shrink-0">
          <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 md:flex md:flex-col md:items-stretch md:gap-8">
            <Link to="/dashboard" className="flex min-w-0 items-center gap-2.5">
              <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground">
                <House className="size-5" />
              </span>
              <span className="truncate font-display text-lg font-semibold tracking-tight">
                SmartHUB - Sandner
              </span>
            </Link>

            <div className="col-start-2 row-start-1 flex items-center gap-1 md:col-auto md:row-auto">
              <GlobalSearchButton onClick={() => setSearchOpen(true)} />
              <Button
                variant="ghost"
                size="icon"
                className="size-11 shrink-0"
                aria-label="Benachrichtigungen öffnen"
                onClick={() => setNotificationsOpen(true)}
              >
                <Bell className="size-4" />
              </Button>
            </div>

            <nav className="hidden gap-1 md:flex md:flex-col">
              {[...nav, ...osNav].map((item) => (
                <Link
                  key={item.to}
                  to={item.to}
                  className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
                  activeProps={{ className: "bg-secondary text-foreground" }}
                >
                  <item.icon className="size-4" />
                  {item.label}
                </Link>
              ))}
            </nav>

            <div className="hidden md:mt-auto md:block">
              <p className="truncate px-3 text-xs text-muted-foreground">{email}</p>
              <Button
                variant="ghost"
                size="sm"
                className="mt-2 w-full justify-start gap-2 text-muted-foreground"
                onClick={handleSignOut}
              >
                <LogOut className="size-4" /> Abmelden
              </Button>
            </div>

            <Button
              variant="ghost"
              size="icon"
              className="size-11 shrink-0 md:hidden"
              onClick={handleSignOut}
              aria-label="Abmelden"
            >
              <LogOut className="size-4" />
            </Button>
          </div>

          <nav
            className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-7 gap-0.5 border-t border-border bg-surface/95 px-1 pt-1 backdrop-blur md:hidden"
            style={{ paddingBottom: "max(0.25rem, env(safe-area-inset-bottom))" }}
          >
            {nav.map((item) => (
              <Link
                key={item.to}
                to={item.to}
                className={cn(
                  "flex min-h-11 flex-col items-center justify-center gap-1 rounded-xl px-0.5 py-1.5 text-[10px] font-medium leading-tight text-muted-foreground",
                )}
                activeProps={{ className: "bg-secondary text-foreground" }}
              >
                <item.icon className="size-4 shrink-0" />
                <span className="w-full truncate text-center">{item.shortLabel}</span>
              </Link>
            ))}
          </nav>
        </aside>

        <main className="min-w-0 flex-1 pb-28 md:pb-10">
          <Outlet />
        </main>

        <GlobalSearch open={searchOpen} onOpenChange={setSearchOpen} />
        <NotificationCenter open={notificationsOpen} onOpenChange={setNotificationsOpen} />
      </div>
    </div>
  );
}
