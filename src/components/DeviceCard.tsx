import {
  Lightbulb,
  Plug,
  Thermometer,
  Gauge,
  Blinds,
  Speaker,
  Bot,
  WifiOff,
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
}: {
  device: Device;
  onToggle: (next: boolean) => void;
  onBrightness: (value: number) => void;
}) {
  const Icon = icons[device.kind] ?? Lightbulb;
  const isSensor = device.kind === "sensor" || device.kind === "thermostat";
  const active = device.is_on && !isSensor;

  return (
    <div
      className={cn(
        "panel flex flex-col gap-4 p-4 transition-all duration-300",
        active && "tile-on",
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <span
            className={cn(
              "flex size-10 shrink-0 items-center justify-center rounded-xl transition-colors",
              active
                ? "bg-primary text-primary-foreground"
                : isSensor
                  ? "bg-accent/15 text-accent"
                  : "bg-secondary text-muted-foreground",
            )}
          >
            <Icon className="size-5" />
          </span>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold">{device.name}</p>
            <p className="text-xs text-muted-foreground">
              {deviceKindLabel[device.kind] ?? device.kind}
              {device.manufacturer ? ` · ${device.manufacturer}` : ""}
            </p>
          </div>
        </div>

        {isSensor ? (
          <span className="font-display text-lg font-semibold text-accent">
            {device.sensor_value ?? "–"}
            <span className="ml-0.5 text-xs text-muted-foreground">{device.sensor_unit}</span>
          </span>
        ) : (
          <Switch checked={device.is_on} onCheckedChange={onToggle} aria-label={device.name} />
        )}
      </div>

      {device.kind === "light" && device.is_on ? (
        <div className="space-y-2">
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

      {!device.is_online ? (
        <p className="flex items-center gap-1.5 text-xs text-destructive">
          <WifiOff className="size-3.5" /> offline
        </p>
      ) : null}
    </div>
  );
}
