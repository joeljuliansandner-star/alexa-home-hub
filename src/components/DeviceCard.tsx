import {
  Lightbulb,
  Plug,
  Thermometer,
  Gauge,
  Blinds,
  Speaker,
  Bot,
  WifiOff,
  Star,
  ChevronRight,
} from "lucide-react";

import { Slider } from "@/components/ui/slider";
import { Pressable } from "@/components/kit/Pressable";
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

function relativeTime(value: string) {
  const diff = Date.now() - new Date(value).getTime();
  const minutes = Math.round(diff / 60_000);
  if (!Number.isFinite(minutes)) return "–";
  if (minutes <= 1) return "gerade eben";
  if (minutes < 60) return `vor ${minutes} Min.`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `vor ${hours} Std.`;
  return `vor ${Math.round(hours / 24)} Tg.`;
}

/**
 * Premium-Gerätekarte: ein Tipp schaltet, langes Drücken öffnet die Details.
 * Zeigt Status, Raumtechnik-Infos, Aktualität und – falls vorhanden – Messwerte.
 */
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
    <article
      className={cn(
        "panel panel-hover group relative flex h-full flex-col gap-4 overflow-hidden p-5",
        active && "tile-on bg-primary/[0.07]",
      )}
    >
      <Pressable
        className="-m-1 flex items-start gap-4 rounded-2xl p-1"
        ariaLabel={
          isSensor
            ? `${device.name} öffnen`
            : `${device.name} ${device.is_on ? "ausschalten" : "einschalten"}`
        }
        onPress={() => (isSensor ? onOpen?.() : onToggle(!device.is_on))}
        onLongPress={onOpen}
        disabled={isSensor && !onOpen}
      >
        <span
          className={cn(
            "flex size-12 shrink-0 items-center justify-center rounded-2xl transition-all duration-500",
            active
              ? "bg-primary text-primary-foreground shadow-[0_10px_30px_-10px_var(--primary)]"
              : isSensor
                ? "bg-accent/12 text-accent"
                : "bg-secondary text-muted-foreground",
          )}
        >
          <Icon className={cn("size-6 transition-transform duration-500", active && "scale-110")} />
        </span>

        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-1">
            <span className="truncate text-base font-semibold">{device.name}</span>
            {onOpen ? (
              <ChevronRight className="size-4 shrink-0 text-muted-foreground opacity-0 transition-opacity duration-200 group-hover:opacity-100" />
            ) : null}
          </span>
          <span className="mt-0.5 block truncate text-xs text-muted-foreground">
            {deviceKindLabel[device.kind] ?? device.kind}
            {device.manufacturer ? ` · ${device.manufacturer}` : ""}
          </span>
        </span>

        <span className="flex shrink-0 flex-col items-end gap-1">
          {isSensor ? (
            <span className="stat-value text-2xl text-accent">
              {device.sensor_value ?? "–"}
              <span className="ml-0.5 text-xs font-normal text-muted-foreground">
                {device.sensor_unit}
              </span>
            </span>
          ) : (
            <span
              className={cn(
                "flex h-7 w-12 items-center rounded-full border px-1 transition-colors duration-300",
                device.is_on
                  ? "border-primary/50 bg-primary/85"
                  : "border-border bg-secondary",
              )}
            >
              <span
                className={cn(
                  "size-5 rounded-full bg-background transition-transform duration-300 ease-out",
                  device.is_on && "translate-x-5",
                )}
              />
            </span>
          )}
          <span
            className={cn(
              "text-[11px] font-medium",
              active ? "text-primary" : "text-muted-foreground",
            )}
          >
            {isSensor ? "Messwert" : device.is_on ? "An" : "Aus"}
          </span>
        </span>
      </Pressable>

      {device.kind === "light" && device.is_on ? (
        <div className="space-y-2 rise-in">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>Helligkeit</span>
            <span className="stat-value text-foreground">{device.brightness}%</span>
          </div>
          <Slider
            value={[device.brightness]}
            min={1}
            max={100}
            step={1}
            aria-label={`Helligkeit ${device.name}`}
            onValueCommit={(v) => onBrightness(v[0] ?? device.brightness)}
          />
        </div>
      ) : null}

      <div className="mt-auto flex items-center justify-between gap-3 border-t border-border/70 pt-3 text-[11px]">
        <span
          className={cn(
            "flex items-center gap-1.5",
            device.is_online ? "text-muted-foreground" : "text-destructive",
          )}
        >
          {device.is_online ? (
            <>
              <span className="live-dot size-2 rounded-full bg-success" />
              Online · {relativeTime(device.updated_at)}
            </>
          ) : (
            <>
              <WifiOff className="size-3.5" /> offline
            </>
          )}
        </span>

        {onFavorite ? (
          <button
            type="button"
            aria-label={device.is_favorite ? "Favorit entfernen" : "Als Favorit markieren"}
            onClick={() => onFavorite(!device.is_favorite)}
            className={cn(
              "-m-2 rounded-xl p-2 transition-colors",
              device.is_favorite ? "text-primary" : "text-muted-foreground hover:text-foreground",
            )}
          >
            <Star className={cn("size-4", device.is_favorite && "fill-current")} />
          </button>
        ) : null}
      </div>
    </article>
  );
}
