import type { LucideIcon } from "lucide-react";
import {
  Camera,
  DoorClosed,
  Flame,
  Lightbulb,
  Plug,
  Thermometer,
  WashingMachine,
  Bot,
  AppWindow,
} from "lucide-react";

import { cn } from "@/lib/utils";
import type { Device } from "@/lib/smarthome";

type StatusItem = {
  id: string;
  label: string;
  value: string;
  hint: string;
  icon: LucideIcon;
  tone: "primary" | "accent" | "muted" | "destructive";
};

const matches = (device: Device, words: string[]) => {
  const haystack =
    `${device.name} ${device.model ?? ""} ${device.manufacturer ?? ""}`.toLowerCase();
  return words.some((word) => haystack.includes(word));
};

/** Live-Statuskarten – rein abgeleitet aus den vorhandenen Gerätedaten. */
export function StatusCards({ devices }: { devices: Device[] }) {
  const lights = devices.filter((d) => d.kind === "light");
  const lightsOn = lights.filter((d) => d.is_on).length;

  const windows = devices.filter((d) => matches(d, ["fenster", "window"]));
  const windowsOpen = windows.filter((d) => d.is_on || (d.sensor_value ?? 0) > 0).length;

  const doors = devices.filter((d) => matches(d, ["tür", "tur", "door", "garage"]));
  const doorsOpen = doors.filter((d) => d.is_on || (d.sensor_value ?? 0) > 0).length;

  const cameras = devices.filter((d) => matches(d, ["kamera", "camera", "cam"]));
  const camerasOnline = cameras.filter((d) => d.is_online).length;

  const heating = devices.filter((d) => d.kind === "thermostat" || matches(d, ["heiz", "therm"]));
  const heatingOn = heating.filter((d) => d.is_on).length;

  const washer = devices.filter((d) => matches(d, ["wasch", "trockner", "spülmasch"]));
  const washerOn = washer.filter((d) => d.is_on).length;

  const vacuums = devices.filter((d) => d.kind === "vacuum" || matches(d, ["saug", "vacuum"]));
  const vacuumOn = vacuums.filter((d) => d.is_on).length;

  const plugs = devices.filter((d) => d.kind === "plug");
  const plugsOn = plugs.filter((d) => d.is_on).length;

  const items: StatusItem[] = [
    {
      id: "lights",
      label: "Lichter",
      value: `${lightsOn}`,
      hint: lights.length ? `von ${lights.length} an` : "keine Lichter",
      icon: Lightbulb,
      tone: lightsOn ? "primary" : "muted",
    },
    {
      id: "windows",
      label: "Fenster",
      value: `${windowsOpen}`,
      hint: windowsOpen ? "offen" : windows.length ? "alle geschlossen" : "keine Sensoren",
      icon: AppWindow,
      tone: windowsOpen ? "destructive" : "muted",
    },
    {
      id: "doors",
      label: "Türen",
      value: `${doorsOpen}`,
      hint: doorsOpen ? "offen" : doors.length ? "alle geschlossen" : "keine Sensoren",
      icon: DoorClosed,
      tone: doorsOpen ? "destructive" : "muted",
    },
    {
      id: "cameras",
      label: "Kameras",
      value: `${camerasOnline}`,
      hint: cameras.length ? `von ${cameras.length} online` : "keine Kameras",
      icon: Camera,
      tone: camerasOnline ? "accent" : "muted",
    },
    {
      id: "heating",
      label: "Heizung",
      value: `${heatingOn}`,
      hint: heating.length ? `von ${heating.length} aktiv` : "keine Thermostate",
      icon: heatingOn ? Flame : Thermometer,
      tone: heatingOn ? "primary" : "muted",
    },
    {
      id: "washer",
      label: "Waschen",
      value: washer.length ? (washerOn ? "läuft" : "fertig") : "–",
      hint: washer.length ? `${washer.length} Geräte` : "kein Gerät",
      icon: WashingMachine,
      tone: washerOn ? "accent" : "muted",
    },
    {
      id: "vacuum",
      label: "Staubsauger",
      value: vacuums.length ? (vacuumOn ? "aktiv" : "Dock") : "–",
      hint: vacuums.length ? `${vacuums.length} Geräte` : "kein Gerät",
      icon: Bot,
      tone: vacuumOn ? "primary" : "muted",
    },
    {
      id: "plugs",
      label: "Steckdosen",
      value: `${plugsOn}`,
      hint: plugs.length ? `von ${plugs.length} an` : "keine Steckdosen",
      icon: Plug,
      tone: plugsOn ? "primary" : "muted",
    },
  ];

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
      {items.map((item, index) => (
        <div
          key={item.id}
          className="panel-glass rise-in flex items-center gap-3 p-4"
          style={{ animationDelay: `${index * 40}ms` }}
        >
          <span
            className={cn(
              "flex size-11 shrink-0 items-center justify-center rounded-2xl transition-colors duration-300",
              item.tone === "primary" && "bg-primary/15 text-primary",
              item.tone === "accent" && "bg-accent/12 text-accent",
              item.tone === "destructive" && "bg-destructive/15 text-destructive",
              item.tone === "muted" && "bg-secondary text-muted-foreground",
            )}
          >
            <item.icon className="size-5" />
          </span>
          <div className="min-w-0">
            <p className="stat-value truncate text-xl">{item.value}</p>
            <p className="truncate text-xs font-medium">{item.label}</p>
            <p className="truncate text-[11px] text-muted-foreground">{item.hint}</p>
          </div>
        </div>
      ))}
    </div>
  );
}
