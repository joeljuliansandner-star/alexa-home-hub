import {
  Lightbulb,
  Plug,
  Thermometer,
  Gauge,
  Blinds,
  Speaker,
  Bot,
  WifiOff,
  Wifi,
  Star,
  ChevronRight,
} from "lucide-react";

import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { cn } from "@/lib/utils";
import { deviceKindLabel, type Device } from "@/lib/smarthome";

const icons = {
  light: Lightbulb,
  plug: Plug,
  thermostat: Thermometer,
  sensor: Gauge,
  blind: Blinds,
  speaker: Speaker,
  vacuum: Bot,
} as const;

export function DeviceCard({
  device,
  onToggle,
  onBrightness,
  onFavorite,
  onOpen,
}: {
  device: Device;
  onToggle: (next: boolean) => void;
  onBrightness: (value: number) => void;
  onFavorite?: (next: boolean) => void;
  onOpen?: () => void;
}) {
  const Icon = icons[device.kind] ?? Lightbulb;
  const isSensor = device.kind === "sensor" || device.kind === "thermostat";
  const active = device.is_on && !isSensor;

  return (
    <div
      className={cn(
        "panel panel-hover flex h-full flex-col gap-4 p-4 transition-all duration-300",
        active && "tile-on bg-primary/[0.06]",
        onOpen && "hover:-translate-y-0.5",
      )}
    >

      <div className="flex items-start justify-between gap-3">
        <button
          type="button"
          className="flex min-w-0 flex-1 items-start gap-3 text-left"
          onClick={onOpen}
          disabled={!onOpen}
        >
          <span
            className={cn(
              "flex size-10 shrink-0 items-center justify-center rounded-xl transition-all duration-300",
              active
                ? "bg-primary text-primary-foreground shadow-[0_8px_24px_-8px_var(--primary)]"
                : isSensor
                  ? "bg-accent/15 text-accent"
                  : "bg-secondary text-muted-foreground",
            )}
          >
            <Icon className="size-5" />
          </span>
          <div className="min-w-0">
            <p className="flex items-center gap-1 truncate text-sm font-semibold">
              <span className="truncate">{device.name}</span>
              {onOpen ? <ChevronRight className="size-3.5 shrink-0 text-muted-foreground" /> : null}
            </p>
            <p className="truncate text-xs text-muted-foreground">
              {deviceKindLabel[device.kind] ?? device.kind}
              {device.manufacturer ? ` · ${device.manufacturer}` : ""}
            </p>
          </div>
        </button>

        <div className="flex shrink-0 items-center gap-2">
          {onFavorite ? (
            <button
              type="button"
              aria-label={device.is_favorite ? "Favorit entfernen" : "Als Favorit markieren"}
              onClick={() => onFavorite(!device.is_favorite)}
              className={cn(
                "rounded-lg p-1.5 transition-colors",
                device.is_favorite
                  ? "text-primary"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              <Star className={cn("size-4", device.is_favorite && "fill-current")} />
            </button>
          ) : null}

          {isSensor ? (
            <span className="stat-value text-lg text-accent">
              {device.sensor_value ?? "–"}
              <span className="ml-0.5 text-xs font-normal text-muted-foreground">
                {device.sensor_unit}
              </span>
            </span>
          ) : (
            <Switch checked={device.is_on} onCheckedChange={onToggle} aria-label={device.name} />
          )}
        </div>
      </div>

      {device.kind === "light" && device.is_on ? (
        <div className="space-y-2 animate-fade-in">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>Helligkeit</span>
            <span className="text-foreground">{device.brightness}%</span>
          </div>
          <Slider
            value={[device.brightness]}
            min={1}
            max={100}
            step={1}
            onValueCommit={(v) => onBrightness(v[0] ?? device.brightness)}
          />
        </div>
      ) : null}

      <p
        className={cn(
          "mt-auto flex items-center gap-1.5 text-xs",
          device.is_online ? "text-muted-foreground" : "text-destructive",
        )}
      >
        {device.is_online ? (
          <>
            <Wifi className="size-3.5 text-success" /> online
          </>
        ) : (
          <>
            <WifiOff className="size-3.5" /> offline
          </>
        )}
      </p>
    </div>
  );
}
