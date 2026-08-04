/**
 * AlexaService – gekapselter Zugriff auf die offiziellen Amazon-Alexa-APIs.
 *
 * Server-only. Jeder Aufruf wird gemessen und als Protokolleintrag
 * zurückgegeben; Tokens werden dabei niemals protokolliert.
 */
import type { AlexaLogInput } from "./repository.server";

export type AlexaApiCall = {
  log: AlexaLogInput;
  ok: boolean;
  status: number | null;
  body: unknown;
};

/**
 * Offizielle Amazon-Endpunkte für Geräteinformationen. Amazon gibt sie nur
 * frei, wenn das verknüpfte Konto die jeweilige Berechtigung besitzt; sonst
 * antwortet die Cloud mit 401/403/404. Beide Fälle werden protokolliert.
 */
export const ALEXA_DEVICE_ENDPOINTS = [
  "https://api.amazonalexa.com/v1/devices",
  "https://api.amazonalexa.com/v2/devices",
  "https://api.eu.amazonalexa.com/v1/devices",
] as const;

const TIMEOUT_MS = 12_000;

/** Entfernt alles, was wie ein Zugangstoken aussieht, aus Debug-Ausgaben. */
export function redact(value: unknown): unknown {
  if (typeof value === "string") {
    return value.length > 24 && /^[A-Za-z0-9|._\-~]+$/.test(value) ? "«gekürzt»" : value;
  }
  if (Array.isArray(value)) return value.slice(0, 20).map(redact);
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [key, entry] of Object.entries(value as Record<string, unknown>)) {
      if (/token|secret|password|cookie|authorization|csrf/i.test(key)) {
        out[key] = "«entfernt»";
        continue;
      }
      out[key] = redact(entry);
    }
    return out;
  }
  return value;
}

export async function alexaRequest(
  url: string,
  accessToken: string,
  init: RequestInit = {},
): Promise<AlexaApiCall> {
  const method = init.method ?? "GET";
  const started = Date.now();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      ...init,
      method,
      signal: controller.signal,
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        ...(init.headers ?? {}),
        Authorization: `Bearer ${accessToken}`,
      },
    });
    const text = await response.text();
    let body: unknown = text;
    try {
      body = text ? JSON.parse(text) : null;
    } catch {
      /* Antwort war kein JSON – Rohtext behalten. */
    }
    return {
      ok: response.ok,
      status: response.status,
      body,
      log: {
        endpoint: url,
        method,
        statusCode: response.status,
        durationMs: Date.now() - started,
        ok: response.ok,
        message: response.ok ? "Antwort erhalten" : `Amazon antwortete mit ${response.status}`,
        details: redact(body) as never,
      },
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unbekannter Netzwerkfehler";
    return {
      ok: false,
      status: null,
      body: null,
      log: {
        endpoint: url,
        method,
        statusCode: null,
        durationMs: Date.now() - started,
        ok: false,
        message,
        details: {},
      },
    };
  } finally {
    clearTimeout(timer);
  }
}

export type RawAlexaDevice = {
  deviceId: string;
  serialNumber: string | null;
  name: string;
  deviceType: string | null;
  deviceFamily: string | null;
  room: string | null;
  isOnline: boolean;
  firmwareVersion: string | null;
  softwareVersion: string | null;
  wifiStatus: string | null;
  capabilities: string[];
};

function str(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value : null;
}

/** Übersetzt eine Amazon-Antwort in das interne Gerätemodell. */
export function parseDevices(body: unknown): RawAlexaDevice[] {
  const container = body as Record<string, unknown> | null;
  const list =
    (Array.isArray(container?.["devices"]) && (container["devices"] as unknown[])) ||
    (Array.isArray(container?.["results"]) && (container["results"] as unknown[])) ||
    (Array.isArray(body) ? (body as unknown[]) : []);

  return list
    .map((entry) => entry as Record<string, unknown>)
    .map((entry) => {
      const deviceId =
        str(entry["deviceSerialNumber"]) ?? str(entry["deviceId"]) ?? str(entry["id"]);
      if (!deviceId) return null;
      const capabilities = Array.isArray(entry["capabilities"])
        ? (entry["capabilities"] as unknown[]).map((cap) =>
            typeof cap === "string" ? cap : String((cap as Record<string, unknown>)?.["interface"] ?? ""),
          )
        : [];
      return {
        deviceId,
        serialNumber: str(entry["deviceSerialNumber"]),
        name: str(entry["accountName"]) ?? str(entry["friendlyName"]) ?? str(entry["name"]) ?? deviceId,
        deviceType: str(entry["deviceType"]),
        deviceFamily: str(entry["deviceFamily"]),
        room: str(entry["room"]) ?? str(entry["groupName"]),
        isOnline: entry["online"] === true || entry["connected"] === true,
        firmwareVersion: str(entry["deviceFirmwareVersion"]) ?? str(entry["firmwareVersion"]),
        softwareVersion: str(entry["softwareVersion"]),
        wifiStatus: str(entry["essid"]) ?? str(entry["wifiStatus"]),
        capabilities: capabilities.filter(Boolean),
      } satisfies RawAlexaDevice;
    })
    .filter((entry): entry is RawAlexaDevice => entry !== null);
}
