import { Link } from "@tanstack/react-router";
import { ChevronRight, Droplets, Thermometer, Wifi, WifiOff } from "lucide-react";

import { IconTile, Panel } from "@/components/kit";
import { cn } from "@/lib/utils";
import type { Device, Room } from "@/lib/smarthome";
import { roomIcon, roomStats } from "./roomStats";

/** Raumkarte der Übersicht – zeigt Geräte, Aktivität, Sensorwerte und Verbindung. */
export function RoomCard({ room, devices }: { room: Room; devices: Device[] }) {
  const stats = roomStats(devices);
  const Icon = roomIcon(room.icon);
  const active = stats.active > 0;

  return (
    <Panel
      hover
      className={cn(
        "flex h-full flex-col gap-4 p-4 transition-all duration-300",
        active && "tile-on bg-primary/[0.06]",
      )}
    >
      <Link
        to="/room/$roomId"
        params={{ roomId: room.id }}
        className="flex min-w-0 items-start gap-3"
      >
        <IconTile icon={Icon} tone={active ? "primary" : "muted"} />
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-1 text-sm font-semibold">
            <span className="truncate">{room.name}</span>
            <ChevronRight className="size-3.5 shrink-0 text-muted-foreground" />
          </p>
          <p className="truncate text-xs text-muted-foreground">
            {stats.total} {stats.total === 1 ? "Gerät" : "Geräte"} · {stats.active} aktiv
          </p>
        </div>
      </Link>

      <div className="grid grid-cols-2 gap-2">
        <div className="rounded-xl bg-secondary/60 px-3 py-2">
          <p className="text-[11px] uppercase tracking-wider text-muted-foreground">Temperatur</p>
          <p className="stat-value flex items-center gap-1.5 text-base text-accent">
            <Thermometer className="size-4" />
            {stats.temperature != null ? `${stats.temperature} °C` : "–"}
          </p>
        </div>
        <div className="rounded-xl bg-secondary/60 px-3 py-2">
          <p className="text-[11px] uppercase tracking-wider text-muted-foreground">Luftfeuchte</p>
          <p className="stat-value flex items-center gap-1.5 text-base text-accent">
            <Droplets className="size-4" />
            {stats.humidity != null ? `${stats.humidity} %` : "–"}
          </p>
        </div>
      </div>

      <p
        className={cn(
          "mt-auto flex items-center gap-1.5 text-xs",
          stats.offline > 0 ? "text-destructive" : "text-muted-foreground",
        )}
      >
        {stats.offline > 0 ? (
          <>
            <WifiOff className="size-3.5" /> {stats.offline} offline
          </>
        ) : (
          <>
            <Wifi className="size-3.5 text-success" />
            {stats.total ? "alle Geräte online" : "keine Geräte"}
          </>
        )}
      </p>
    </Panel>
  );
}
