import { Link } from "@tanstack/react-router";
import { ChevronRight, Droplets, Thermometer, WifiOff } from "lucide-react";

import { cn } from "@/lib/utils";
import type { Device, Room } from "@/lib/smarthome";
import { roomIcon, roomStats } from "./roomStats";

/** Große Raumkarte mit Illustration, Kennzahlen und Aktivitätsstatus. */
export function RoomCard({ room, devices }: { room: Room; devices: Device[] }) {
  const stats = roomStats(devices);
  const Icon = roomIcon(room.icon);
  const active = stats.active > 0;

  return (
    <Link
      to="/room/$roomId"
      params={{ roomId: room.id }}
      className={cn(
        "panel panel-hover ripple-host rise-in group relative flex h-full flex-col justify-between gap-6 overflow-hidden p-6",
        "hover:-translate-y-1 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
        active && "tile-on bg-primary/[0.07]",
      )}
    >
      {/* Illustration */}
      <span
        aria-hidden="true"
        className={cn(
          "pointer-events-none absolute -right-6 -top-8 transition-all duration-500 group-hover:scale-110",
          active ? "text-primary/15" : "text-foreground/[0.05]",
        )}
      >
        <Icon className="size-40" strokeWidth={1} />
      </span>

      <div className="relative flex items-start justify-between gap-3">
        <span
          className={cn(
            "flex size-12 items-center justify-center rounded-2xl transition-colors duration-300",
            active ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground",
          )}
        >
          <Icon className="size-6" />
        </span>
        <ChevronRight className="size-5 text-muted-foreground transition-transform duration-300 group-hover:translate-x-1" />
      </div>

      <div className="relative min-w-0">
        <h3 className="truncate text-xl font-semibold">{room.name}</h3>
        <p className="mt-1 truncate text-xs text-muted-foreground">
          {stats.total} {stats.total === 1 ? "Gerät" : "Geräte"}
          {active ? ` · ${stats.active} aktiv` : " · Ruhezustand"}
        </p>
      </div>

      <div className="relative grid grid-cols-2 gap-2">
        <div className="rounded-2xl bg-secondary/50 px-3 py-2.5">
          <p className="text-[11px] uppercase tracking-wider text-muted-foreground">Temperatur</p>
          <p className="stat-value mt-0.5 flex items-center gap-1.5 text-lg text-accent">
            <Thermometer className="size-4" />
            {stats.temperature != null ? `${stats.temperature}°` : "–"}
          </p>
        </div>
        <div className="rounded-2xl bg-secondary/50 px-3 py-2.5">
          <p className="text-[11px] uppercase tracking-wider text-muted-foreground">Luftfeuchte</p>
          <p className="stat-value mt-0.5 flex items-center gap-1.5 text-lg text-accent">
            <Droplets className="size-4" />
            {stats.humidity != null ? `${stats.humidity}%` : "–"}
          </p>
        </div>
      </div>

      <p
        className={cn(
          "relative flex items-center gap-1.5 text-xs",
          stats.offline > 0 ? "text-destructive" : "text-muted-foreground",
        )}
      >
        {stats.offline > 0 ? (
          <>
            <WifiOff className="size-3.5" /> {stats.offline} offline
          </>
        ) : (
          <>
            <span className="live-dot size-2 rounded-full bg-success" />
            {stats.total ? "alle Geräte online" : "keine Geräte"}
          </>
        )}
      </p>
    </Link>
  );
}
