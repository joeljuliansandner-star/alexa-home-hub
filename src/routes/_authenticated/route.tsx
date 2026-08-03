import { Link, Outlet, createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  LayoutDashboard,
  Sparkles,
  Timer,
  Settings2,
  LogOut,
  House,
} from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useTuyaLiveSync } from "@/lib/smarthome";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    const { data } = await supabase.auth.getSession();
    if (!data.session) throw redirect({ to: "/auth" });
  },
  component: AuthenticatedLayout,
});

const nav = [
  { to: "/dashboard", label: "Übersicht", icon: LayoutDashboard },
  { to: "/scenes", label: "Szenen", icon: Sparkles },
  { to: "/automations", label: "Automationen", icon: Timer },
  { to: "/settings", label: "Einstellungen", icon: Settings2 },
] as const;

function AuthenticatedLayout() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [email, setEmail] = useState<string | null>(null);

  // Änderungen aus der Smart-Life-App laufend ins Panel übernehmen
  useTuyaLiveSync();

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
    <div className="min-h-screen hero-glow">
      <div className="mx-auto flex min-h-screen w-full max-w-7xl flex-col gap-6 px-4 py-5 md:flex-row md:gap-8 md:px-8 md:py-8">
        <aside className="md:w-60 md:shrink-0">
          <div className="flex items-center justify-between gap-3 md:flex-col md:items-stretch md:gap-8">
            <Link to="/dashboard" className="flex items-center gap-2.5">
              <span className="flex size-9 items-center justify-center rounded-xl bg-primary text-primary-foreground">
                <House className="size-5" />
              </span>
              <span className="font-display text-lg font-semibold tracking-tight">
                Smarthome
              </span>
            </Link>

            <nav className="hidden gap-1 md:flex md:flex-col">
              {nav.map((item) => (
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
              className="md:hidden"
              onClick={handleSignOut}
              aria-label="Abmelden"
            >
              <LogOut className="size-4" />
            </Button>
          </div>

          <nav className="mt-4 grid grid-cols-4 gap-1 rounded-2xl border border-border bg-surface p-1 md:hidden">
            {nav.map((item) => (
              <Link
                key={item.to}
                to={item.to}
                className={cn(
                  "flex flex-col items-center gap-1 rounded-xl px-1 py-2 text-[11px] font-medium text-muted-foreground",
                )}
                activeProps={{ className: "bg-secondary text-foreground" }}
              >
                <item.icon className="size-4" />
                {item.label}
              </Link>
            ))}
          </nav>
        </aside>

        <main className="min-w-0 flex-1 pb-10">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
