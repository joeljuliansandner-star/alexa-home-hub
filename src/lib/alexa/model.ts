/**
 * Alexa – Datenmodell (AlexaDeviceModel).
 *
 * Diese Datei ist bewusst frei von Server- und UI-Code: sie beschreibt nur
 * Typen und reine Abbildungsfunktionen und darf von Browser und Server
 * gleichermaßen importiert werden.
 */

export const ALEXA_UNAVAILABLE = "Von Amazon derzeit nicht verfügbar." as const;

/** Von Amazon offiziell benannte Echo-Produktfamilien. */
export type AlexaDeviceTypeId =
  | "echo-dot"
  | "echo-show"
  | "echo-pop"
  | "echo-studio"
  | "echo-flex"
  | "echo-auto"
  | "echo-hub"
  | "echo-input"
  | "echo"
  | "unknown";

export type AlexaDeviceModel = {
  id: string;
  deviceId: string;
  serialNumber: string | null;
  name: string;
  deviceType: string | null;
  deviceFamily: string | null;
  typeId: AlexaDeviceTypeId;
  typeLabel: string;
  room: string | null;
  isOnline: boolean;
  firmwareVersion: string | null;
  softwareVersion: string | null;
  wifiStatus: string | null;
  capabilities: string[];
  unsupportedProperties: string[];
  lastSyncedAt: string;
};

export type AlexaConnectionStatus = {
  /** Amazon-Zugangsdaten (Login with Amazon) im Backend hinterlegt? */
  configured: boolean;
  connected: boolean;
  accountName: string | null;
  accountEmail: string | null;
  /** Zugriffstoken abgelaufen und keine Erneuerung möglich → neu anmelden. */
  needsReauth: boolean;
  expiresAt: string | null;
  lastSyncAt: string | null;
  lastError: string | null;
  deviceCount: number;
};

export type AlexaSettingsModel = {
  autoSync: boolean;
  syncIntervalMinutes: number;
  debugMode: boolean;
};

export type AlexaLogEntry = {
  id: string;
  endpoint: string;
  method: string;
  statusCode: number | null;
  durationMs: number | null;
  ok: boolean;
  message: string | null;
  createdAt: string;
};

export type AlexaSyncResult = {
  /** Hat Amazon eine Geräteliste geliefert? */
  available: boolean;
  /** Klartext-Begründung, wenn Amazon nichts liefert. */
  reason: string | null;
  imported: number;
  online: number;
  devices: AlexaDeviceModel[];
  log: AlexaLogEntry[];
  syncedAt: string;
};

/** Alle unterstützten Steuerfunktionen – wird pro Gerät gefiltert. */
export type AlexaControl = "volume" | "mute";

export const alexaDeviceTypeLabel: Record<AlexaDeviceTypeId, string> = {
  "echo-dot": "Echo Dot",
  "echo-show": "Echo Show",
  "echo-pop": "Echo Pop",
  "echo-studio": "Echo Studio",
  "echo-flex": "Echo Flex",
  "echo-auto": "Echo Auto",
  "echo-hub": "Echo Hub",
  "echo-input": "Echo Input",
  echo: "Echo",
  unknown: "Unbekanntes Alexa-Gerät",
};

/** Ordnet die von Amazon gelieferte Gerätefamilie einer Produktfamilie zu. */
export function classifyAlexaDevice(
  deviceFamily: string | null | undefined,
  deviceType: string | null | undefined,
  name: string | null | undefined,
): AlexaDeviceTypeId {
  const haystack = `${deviceFamily ?? ""} ${deviceType ?? ""} ${name ?? ""}`.toLowerCase();
  if (haystack.includes("dot")) return "echo-dot";
  if (haystack.includes("show")) return "echo-show";
  if (haystack.includes("pop")) return "echo-pop";
  if (haystack.includes("studio")) return "echo-studio";
  if (haystack.includes("flex")) return "echo-flex";
  if (haystack.includes("auto")) return "echo-auto";
  if (haystack.includes("hub")) return "echo-hub";
  if (haystack.includes("input")) return "echo-input";
  if (haystack.includes("echo") || haystack.includes("alexa")) return "echo";
  return "unknown";
}

/** Anzeigewert oder transparenter Hinweis, wenn Amazon nichts liefert. */
export function alexaValue(value: string | null | undefined): string {
  return value && value.trim() ? value : ALEXA_UNAVAILABLE;
}

export function alexaControlLabel(control: AlexaControl): string {
  return control === "volume" ? "Lautstärke" : "Stummschaltung";
}
