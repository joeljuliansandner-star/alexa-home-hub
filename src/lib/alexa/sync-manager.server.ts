/**
 * AlexaSyncManager – verbindet Auth, API und Datenbank.
 * Server-only.
 */
import { isExpired, refreshTokens } from "./auth-manager.server";
import {
  ALEXA_DEVICE_ENDPOINTS,
  alexaRequest,
  parseDevices,
  type AlexaApiCall,
} from "./service.server";
import {
  addLogEntries,
  getConnection,
  listDevices,
  listLogEntries,
  patchConnection,
  upsertDevices,
  type AlexaDeviceUpsert,
} from "./repository.server";
import { ALEXA_UNAVAILABLE, type AlexaSyncResult } from "./model";

/** Gültiges Zugriffstoken beschaffen (bei Bedarf erneuern). */
export async function accessTokenFor(userId: string): Promise<string> {
  const connection = await getConnection(userId);
  if (!connection) throw new Error("Kein Amazon-Konto verbunden.");
  if (!isExpired(connection.expires_at)) return connection.access_token;

  if (!connection.refresh_token) {
    await patchConnection(userId, { last_error: "Sitzung abgelaufen – bitte neu anmelden." });
    throw new Error("Sitzung abgelaufen – bitte neu bei Amazon anmelden.");
  }

  const tokens = await refreshTokens(connection.refresh_token);
  await patchConnection(userId, {
    access_token: tokens.accessToken,
    refresh_token: tokens.refreshToken,
    token_type: tokens.tokenType,
    scope: tokens.scope,
    expires_at: tokens.expiresAt,
    last_error: null,
  });
  return tokens.accessToken;
}

const RETRIES = 2;

async function callWithRetry(url: string, token: string): Promise<AlexaApiCall> {
  let last = await alexaRequest(url, token);
  for (let attempt = 1; attempt <= RETRIES && !last.ok; attempt += 1) {
    if (last.status && last.status < 500 && last.status !== 429) break;
    await new Promise((resolve) => setTimeout(resolve, 600 * attempt));
    last = await alexaRequest(url, token);
  }
  return last;
}

/** Geräteabgleich mit Amazon; liefert immer ein auswertbares Ergebnis. */
export async function syncAlexaDevices(userId: string): Promise<AlexaSyncResult> {
  const token = await accessTokenFor(userId);
  const calls: AlexaApiCall[] = [];
  let parsed: ReturnType<typeof parseDevices> = [];
  let source = "";

  for (const endpoint of ALEXA_DEVICE_ENDPOINTS) {
    const call = await callWithRetry(endpoint, token);
    calls.push(call);
    if (!call.ok) continue;
    const devices = parseDevices(call.body);
    if (devices.length) {
      parsed = devices;
      source = endpoint;
      break;
    }
  }

  const rows: AlexaDeviceUpsert[] = parsed.map((device) => ({
    device_id: device.deviceId,
    serial_number: device.serialNumber,
    name: device.name,
    device_type: device.deviceType,
    device_family: device.deviceFamily,
    room: device.room,
    is_online: device.isOnline,
    firmware_version: device.firmwareVersion,
    software_version: device.softwareVersion,
    wifi_status: device.wifiStatus,
    capabilities: device.capabilities,
    unsupported_properties: [
      ...(device.firmwareVersion ? [] : ["Firmware"]),
      ...(device.room ? [] : ["Raumzuordnung"]),
      ...(device.wifiStatus ? [] : ["WLAN-Status"]),
    ],
    raw_source: source,
  }));

  const imported = await upsertDevices(userId, rows);
  await addLogEntries(
    userId,
    calls.map((call) => call.log),
  );

  const failure = calls.find((call) => !call.ok);
  const reason = rows.length
    ? null
    : failure
      ? `${ALEXA_UNAVAILABLE} Amazon meldet: ${failure.log.message ?? "keine Angabe"}.`
      : `${ALEXA_UNAVAILABLE} Amazon liefert für dieses Konto keine Geräteliste.`;

  const syncedAt = new Date().toISOString();
  await patchConnection(userId, { last_sync_at: syncedAt, last_error: reason });

  const devices = await listDevices(userId);
  return {
    available: rows.length > 0,
    reason,
    imported,
    online: devices.filter((device) => device.isOnline).length,
    devices,
    log: await listLogEntries(userId),
    syncedAt,
  };
}

export type AlexaCommandResult = { ok: boolean; message: string };

/**
 * Steuerbefehl (Lautstärke / Stummschaltung) an ein Echo-Gerät senden.
 * Amazon gibt diese Schnittstelle nur für berechtigte Konten frei – jede
 * Ablehnung wird protokolliert und im Klartext zurückgemeldet.
 */
export async function sendAlexaCommand(
  userId: string,
  deviceId: string,
  payload: { volume?: number; muted?: boolean },
): Promise<AlexaCommandResult> {
  const token = await accessTokenFor(userId);
  const endpoint = `https://api.amazonalexa.com/v1/devices/${encodeURIComponent(deviceId)}/settings/speaker`;
  const call = await alexaRequest(endpoint, token, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
  await addLogEntries(userId, [call.log]);
  return {
    ok: call.ok,
    message: call.ok
      ? "Befehl an Amazon übermittelt."
      : `${ALEXA_UNAVAILABLE} ${call.log.message ?? ""}`.trim(),
  };
}
