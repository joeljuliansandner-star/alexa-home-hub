import {
  Sofa,
  Utensils,
  Bed,
  Laptop,
  Bath,
  DoorOpen,
  Warehouse,
  Car,
  Trees,
  Home,
  type LucideIcon,
} from "lucide-react";

import { isCameraDevice, type Device } from "@/lib/smarthome";

/** Icon-Zuordnung für Räume – zentral, damit Übersicht und Detailseite gleich aussehen. */
const roomIcons: Record<string, LucideIcon> = {
  sofa: Sofa,
  utensils: Utensils,
  bed: Bed,
  laptop: Laptop,
  bath: Bath,
  door: DoorOpen,
  warehouse: Warehouse,
  garage: Car,
  garden: Trees,
  home: Home,
};

export function roomIcon(icon: string | null | undefined): LucideIcon {
  return roomIcons[(icon ?? "").toLowerCase()] ?? Sofa;
}

export type RoomStats = {
  total: number;
  controllable: number;
  active: number;
  offline: number;
  allOnline: boolean;
  temperature: number | null;
  humidity: number | null;
};

/** Kennzahlen eines Raumes – modular, damit später echte Sensordaten andocken können. */
export function roomStats(devices: Device[]): RoomStats {
  const controllable = devices.filter((d) => d.kind !== "sensor");
  const sensorValue = (match: RegExp, units: string[]) => {
    const hit = devices.find(
      (d) =>
        (d.kind === "sensor" || d.kind === "thermostat") &&
        d.sensor_value != null &&
        (units.includes(d.sensor_unit ?? "") || match.test(d.name.toLowerCase())),
    );
    return hit?.sensor_value != null ? Number(hit.sensor_value) : null;
  };

  return {
    total: devices.length,
    controllable: controllable.length,
    active: controllable.filter((d) => d.is_on).length,
    offline: devices.filter((d) => !d.is_online).length,
    allOnline: devices.length > 0 && devices.every((d) => d.is_online),
    temperature: sensorValue(/temp|wärme|heiz/, ["°C"]),
    humidity: sensorValue(/feucht|humid/, ["%"]),
  };
}

export type CategoryId = "light" | "plug" | "sensor" | "media" | "camera" | "other";

export const categoryLabel: Record<CategoryId, string> = {
  light: "Lichter",
  plug: "Steckdosen",
  sensor: "Sensoren",
  media: "Unterhaltung",
  camera: "Kameras",
  other: "Weitere Geräte",
};

export function deviceCategory(device: Device): CategoryId {
  if (isCameraDevice(device)) return "camera";
  if (device.kind === "light") return "light";
  if (device.kind === "plug") return "plug";
  if (device.kind === "sensor" || device.kind === "thermostat") return "sensor";
  if (device.kind === "speaker") return "media";
  return "other";
}

export const categoryOrder: CategoryId[] = ["light", "plug", "media", "sensor", "camera", "other"];
