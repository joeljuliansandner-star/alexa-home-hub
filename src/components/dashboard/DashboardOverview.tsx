import { useMemo, useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import {
  Activity,
  Boxes,
  Cloud,
  DoorOpen,
  Heart,
  Home,
  LayoutGrid,
  Plug,
  RefreshCw,
  Settings,
  ShieldCheck,
  Wifi,
  WifiOff,
} from "lucide-react";

import { DeviceCard } from "@/components/DeviceCard";
import { EmptyState, EntryList, EntryRow, IconTile, Panel, Section, StatTile } from "@/components/kit";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { formatSync, integrations, isConnected } from "@/lib/integrations";
import {
  useActivity,
  useDevices,
  useRooms,
  useToggleFavorite,
  useUpdateDevice,
} from "@/lib/smarthome";

const APP_VERSION = "1.4.0";

/** Kopf des Dashboards: Hausstatus, Kennzahlen, Favoriten, Systemstatus. */
export function DashboardOverview() {
  const rooms = useRooms();
  const devices = useDevices();
  const activity = useActivity();
  const updateDevice = useUpdateDevice();
  const toggleFavorite = useToggleFavorite();
  const navigate = useNavigate();
  const [away, setAway] = useState(false);

  const list = devices.data ?? [];
  const online = list.filter((d) => d.is_online).length;
  const offline = list.length - online;
  const favorites = list.filter((d) => d.is_favorite).slice(0, 6);

  const connected = useMemo(
    () => integrations.filter((entry) => isConnected(entry, list)),
    [list],
  );

  const lastSyncDate = useMemo(() => {
    const newest = list.reduce((max, device) => {
      const value = new Date(device.updated_at).getTime();
      return value > max ? value : max;
    }, 0);
    return newest ? new Date(newest) : null;
  }, [list]);

  return (
    <div className="space-y-8">
      {/* Hausstatus */}
      <Section title="Hausstatus">
        <Panel className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <IconTile icon={away ? DoorOpen : Home} tone={away ? "muted" : "primary"} />
              <div>
                <p className="font-medium">{away ? "Abwesend" : "Zuhause"}</p>
                <p className="text-xs text-muted-foreground">
                  Platzhalter – später über Standort oder Routine
                </p>
              </div>
            </div>
            <div className="flex w-full gap-2 sm:w-auto">
              {[
                { label: "Zuhause", value: false },
                { label: "Abwesend", value: true },
              ].map((option) => (
                <button
                  key={option.label}
                  type="button"
                  onClick={() => setAway(option.value)}
                  className={cn(
                    "min-h-11 flex-1 rounded-full border px-4 text-sm font-medium transition-all duration-200 sm:flex-none",
                    away === option.value
                      ? "border-primary/50 bg-primary text-primary-foreground shadow-[0_8px_24px_-12px_var(--primary)]"
                      : "border-border bg-secondary text-muted-foreground hover:text-foreground",
                  )}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <StatTile label="Verbunden" value={`${list.length}`} tone="primary" />
            <StatTile label="Online" value={`${online}`} tone="accent" />
            <StatTile label="Offline" value={`${offline}`} tone={offline ? "destructive" : "muted"} />
            <StatTile label="Letzter Abgleich" value={formatSync(lastSyncDate)} />
          </div>
        </Panel>
      </Section>

      {/* Smart-Home-Übersicht */}
      <Section title="Smart-Home-Übersicht">
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {[
            { to: "/rooms", icon: LayoutGrid, label: "Räume", value: (rooms.data ?? []).length },
            { to: "/dashboard", icon: Plug, label: "Geräte", value: list.length },
            {
              to: "/dashboard",
              icon: Heart,
              label: "Favoriten",
              value: list.filter((d) => d.is_favorite).length,
            },
            {
              to: "/integrations",
              icon: Boxes,
              label: "Integrationen",
              value: connected.length,
            },
          ].map((item) => (
            <Link key={item.label} to={item.to} className="block">
              <Panel hover className="flex h-full items-center gap-3">
                <IconTile icon={item.icon} tone="accent" />
                <div className="min-w-0">
                  <p className="stat-value text-xl">{item.value}</p>
                  <p className="truncate text-xs text-muted-foreground">{item.label}</p>
                </div>
              </Panel>
            </Link>
          ))}
        </div>
      </Section>

      {/* Favoriten */}
      <Section
        title="Favoriten"
        action={
          <span className="text-xs text-muted-foreground">max. 6 Geräte</span>
        }
      >
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
                onOpen={() => navigate({ to: "/device/$deviceId", params: { deviceId: device.id } })}
              />
            ))}
          </div>
        ) : (
          <EmptyState description="Noch keine Favoriten. Markiere Geräte mit dem Stern." />
        )}
      </Section>

      {/* Letzte Aktivitäten */}
      <Section title="Letzte Aktivitäten">
        {activity.data?.length ? (
          <EntryList>
            {activity.data.slice(0, 6).map((entry) => (
              <EntryRow
                key={entry.id}
                meta={new Date(entry.created_at).toLocaleString("de-DE", {
                  day: "2-digit",
                  month: "2-digit",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              >
                <span className="flex items-center gap-2">
                  <Activity className="size-3.5 shrink-0 text-accent" />
                  {entry.message}
                </span>
              </EntryRow>
            ))}
          </EntryList>
        ) : (
          <EmptyState description="Noch keine Ereignisse aufgezeichnet." />
        )}
      </Section>

      {/* Systemstatus */}
      <Section title="Systemstatus">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Panel className="flex items-center gap-3">
            <IconTile icon={ShieldCheck} tone={connected.length ? "primary" : "muted"} />
            <div className="min-w-0">
              <p className="text-sm font-medium">
                {connected.length} von {integrations.length}
              </p>
              <p className="text-xs text-muted-foreground">Integrationen verbunden</p>
            </div>
          </Panel>
          <Panel className="flex items-center gap-3">
            <IconTile icon={RefreshCw} tone="accent" />
            <div className="min-w-0">
              <p className="truncate text-sm font-medium">{formatSync(lastSyncDate)}</p>
              <p className="text-xs text-muted-foreground">Synchronisationsstatus</p>
            </div>
          </Panel>
          <Panel className="flex items-center gap-3">
            <IconTile icon={offline ? WifiOff : Wifi} tone={offline ? "destructive" : "accent"} />
            <div className="min-w-0">
              <p className="text-sm font-medium">{offline ? "Teilweise offline" : "Alles erreichbar"}</p>
              <p className="text-xs text-muted-foreground">Geräteverbindung</p>
            </div>
          </Panel>
          <Panel className="flex items-center gap-3">
            <IconTile icon={Cloud} tone="muted" />
            <div className="min-w-0">
              <p className="text-sm font-medium">Cloud aktiv · v{APP_VERSION}</p>
              <p className="text-xs text-muted-foreground">Cloudstatus (Platzhalter)</p>
            </div>
          </Panel>
        </div>
      </Section>

      {/* Schnellzugriffe */}
      <Section title="Schnellzugriffe">
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {[
            { to: "/dashboard", icon: Plug, label: "Geräte" },
            { to: "/rooms", icon: LayoutGrid, label: "Räume" },
            { to: "/integrations", icon: Boxes, label: "Integrationen" },
            { to: "/settings", icon: Settings, label: "Einstellungen" },
          ].map((item) => (
            <Button
              key={item.label}
              asChild
              variant="secondary"
              className="h-12 justify-start gap-2"
            >
              <Link to={item.to}>
                <item.icon className="size-4 text-primary" />
                {item.label}
              </Link>
            </Button>
          ))}
        </div>
      </Section>
    </div>
  );
}
