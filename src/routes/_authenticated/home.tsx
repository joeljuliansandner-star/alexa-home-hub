import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMemo } from "react";
import {
  Bell,
  LayoutDashboard,
  Lightbulb,
  Loader2,
  Plug,
  RefreshCw,
  Star,
  WifiOff,
} from "lucide-react";
import { toast } from "sonner";

import { WeatherClock } from "@/components/WeatherClock";
import { DeviceCard } from "@/components/DeviceCard";
import { Button } from "@/components/ui/button";
import {
  useActivity,
  useBulkToggleKind,
  useDevices,
  useRooms,
  useToggleFavorite,
  useUpdateDevice,
} from "@/lib/smarthome";
import { cn } from "@/lib/utils";
import {
  EmptyState,
  LoadingState,
  PageHeader,
  Section,
  StatTile,
  grids,
  stacks,
} from "@/components/kit";

export const Route = createFileRoute("/_authenticated/home")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Startseite – Smarthome Control" },
      {
        name: "description",
        content: "Begrüßung, Status deines Zuhauses, Favoriten und Wetter in Wurzen.",
      },
      { property: "og:title", content: "Startseite – Smarthome Control" },
      {
        property: "og:description",
        content: "Begrüßung, Status deines Zuhauses, Favoriten und Wetter in Wurzen.",
      },
    ],
  }),
  component: HomePage,
});

function greeting() {
  const hour = new Date().getHours();
  if (hour < 5) return "Gute Nacht";
  if (hour < 11) return "Guten Morgen";
  if (hour < 18) return "Guten Tag";
  return "Guten Abend";
}

function HomePage() {
  const devices = useDevices();
  const rooms = useRooms();
  const activity = useActivity();
  const updateDevice = useUpdateDevice();
  const toggleFavorite = useToggleFavorite();
  const bulkToggle = useBulkToggleKind();
  const navigate = useNavigate();

  const list = devices.data ?? [];
  const lights = list.filter((d) => d.kind === "light");
  const plugs = list.filter((d) => d.kind === "plug");
  const favorites = list.filter((d) => d.is_favorite);
  const activeCount = list.filter((d) => d.is_on && d.kind !== "sensor").length;
  const offline = list.filter((d) => !d.is_online);

  const lastSync = useMemo(() => {
    if (!list.length) return "—";
    const newest = Math.max(...list.map((d) => new Date(d.updated_at).getTime()));
    const minutes = Math.round((Date.now() - newest) / 60_000);
    if (minutes <= 1) return "gerade eben";
    if (minutes < 60) return `vor ${minutes} Min.`;
    return new Date(newest).toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" });
  }, [list]);

  const anyLightOn = lights.some((d) => d.is_on);
  const anyPlugOn = plugs.some((d) => d.is_on);

  const stats = [
    { label: "Aktive Geräte", value: String(activeCount), tone: "primary" as const },
    { label: "Räume", value: String((rooms.data ?? []).length), tone: "accent" as const },
    { label: "Offline", value: String(offline.length), tone: offline.length ? ("destructive" as const) : ("muted" as const) },
    { label: "Letzte Sync", value: lastSync, tone: "muted" as const },
  ];

  if (devices.isLoading) {
    return <LoadingState />;
  }

  return (
    <div className={stacks.page}>
      <PageHeader
        title={`${greeting()}, Joel`}
        description={
          activeCount > 0
            ? `${activeCount} Geräte sind gerade aktiv.`
            : "Aktuell ist alles ausgeschaltet."
        }
      />

      <WeatherClock />

      <section className={grids.stats}>
        {stats.map((stat) => (
          <StatTile key={stat.label} label={stat.label} value={stat.value} tone={stat.tone} />
        ))}
      </section>

      <Section title="Schnellaktionen">
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <QuickAction
            icon={Lightbulb}
            label="Alle Lichter"
            hint={`${lights.filter((d) => d.is_on).length}/${lights.length} an`}
            active={anyLightOn}
            disabled={!lights.length || bulkToggle.isPending}
            onClick={() =>
              bulkToggle.mutate(
                { devices: lights, on: !anyLightOn },
                {
                  onSuccess: (count) =>
                    toast.success(`${count} Lichter ${anyLightOn ? "aus" : "an"}geschaltet`),
                },
              )
            }
          />
          <QuickAction
            icon={Plug}
            label="Alle Steckdosen"
            hint={`${plugs.filter((d) => d.is_on).length}/${plugs.length} an`}
            active={anyPlugOn}
            disabled={!plugs.length || bulkToggle.isPending}
            onClick={() =>
              bulkToggle.mutate(
                { devices: plugs, on: !anyPlugOn },
                {
                  onSuccess: (count) =>
                    toast.success(`${count} Steckdosen ${anyPlugOn ? "aus" : "an"}geschaltet`),
                },
              )
            }
          />
          <QuickAction
            icon={Star}
            label="Favoriten"
            hint={`${favorites.length} gemerkt`}
            onClick={() => {
              document
                .getElementById("favoriten")
                ?.scrollIntoView({ behavior: "smooth", block: "start" });
            }}
          />
          <QuickAction
            icon={LayoutDashboard}
            label="Geräteübersicht"
            hint={`${list.length} Geräte`}
            onClick={() => navigate({ to: "/dashboard" })}
          />
        </div>
      </section>

      <section id="favoriten" className="space-y-3 scroll-mt-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            Favoriten
          </h2>
          <Link to="/dashboard" className="text-xs text-muted-foreground hover:text-foreground">
            Alle Geräte
          </Link>
        </div>
        {favorites.length ? (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {favorites.map((device) => (
              <DeviceCard
                key={device.id}
                device={device}
                onToggle={(next) =>
                  updateDevice.mutate({
                    device,
                    patch: { is_on: next },
                    log: `${device.name} ${next ? "eingeschaltet" : "ausgeschaltet"}`,
                  })
                }
                onBrightness={(value) => updateDevice.mutate({ device, patch: { brightness: value } })}
                onFavorite={(value) => toggleFavorite.mutate({ device, value })}
                onOpen={() =>
                  navigate({ to: "/device/$deviceId", params: { deviceId: device.id } })
                }
              />
            ))}
          </div>
        ) : (
          <div className="panel-glass flex flex-col items-start gap-3 p-5">
            <p className="text-sm text-muted-foreground">
              Noch keine Favoriten. Markiere Geräte in der Übersicht mit dem Stern, um sie hier
              schnell zu erreichen.
            </p>
            <Button asChild variant="secondary" className="min-h-11">
              <Link to="/dashboard">Geräte auswählen</Link>
            </Button>
          </div>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          Benachrichtigungen
        </h2>
        <div className="panel-glass divide-y divide-border p-1">
          {offline.length ? (
            <div className="flex items-start gap-3 px-3 py-3">
              <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-xl bg-destructive/15 text-destructive">
                <WifiOff className="size-4" />
              </span>
              <div className="min-w-0">
                <p className="text-sm font-medium">
                  {offline.length} {offline.length === 1 ? "Gerät ist" : "Geräte sind"} offline
                </p>
                <p className="truncate text-xs text-muted-foreground">
                  {offline.map((d) => d.name).join(", ")}
                </p>
              </div>
            </div>
          ) : (
            <div className="flex items-start gap-3 px-3 py-3">
              <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-xl bg-success/15 text-success">
                <Bell className="size-4" />
              </span>
              <div>
                <p className="text-sm font-medium">Alles in Ordnung</p>
                <p className="text-xs text-muted-foreground">Alle Geräte sind erreichbar.</p>
              </div>
            </div>
          )}

          <div className="flex items-start gap-3 px-3 py-3">
            <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-xl bg-accent/15 text-accent">
              <RefreshCw className="size-4" />
            </span>
            <div>
              <p className="text-sm font-medium">Letzte Synchronisierung</p>
              <p className="text-xs text-muted-foreground">{lastSync}</p>
            </div>
          </div>

          {(activity.data ?? []).slice(0, 3).map((entry) => (
            <div key={entry.id} className="flex items-center justify-between gap-4 px-3 py-3">
              <span className="truncate text-sm">{entry.message}</span>
              <time className="shrink-0 text-xs text-muted-foreground">
                {new Date(entry.created_at).toLocaleTimeString("de-DE", {
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </time>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

function QuickAction({
  icon: Icon,
  label,
  hint,
  active,
  disabled,
  onClick,
}: {
  icon: typeof Lightbulb;
  label: string;
  hint: string;
  active?: boolean;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "panel panel-hover flex h-full min-h-24 flex-col items-start justify-between gap-3 p-4 text-left",
        "hover:-translate-y-0.5 disabled:opacity-50",
        active && "tile-on",
      )}
    >
      <span
        className={cn(
          "flex size-10 items-center justify-center rounded-xl transition-colors",
          active ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground",
        )}
      >
        <Icon className="size-5" />
      </span>
      <span className="min-w-0">
        <span className="block truncate text-sm font-semibold">{label}</span>
        <span className="block truncate text-xs text-muted-foreground">{hint}</span>
      </span>
    </button>
  );
}
