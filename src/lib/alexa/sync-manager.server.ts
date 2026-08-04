/**
 * AlexaSyncManager – Verbindung, Tokenpflege und transparente Rückmeldung.
 * Server-only.
 *
 * Wichtig: Amazon stellt über „Login with Amazon" (LWA) keine öffentlich
 * dokumentierte API bereit, mit der sich die Echo-Geräte eines Kontos
 * auslesen oder steuern lassen. Die früher verwendeten Endpunkte unter
 * api.amazonalexa.com sind Skill-gebundene Schnittstellen (Alexa Smart Home /
 * Skill Messaging) und antworten für LWA-Tokens mit HTTP 404. Es werden
 * deshalb bewusst keine Geräteaufrufe mehr ausgeführt – auch keine
 * inoffiziellen Endpunkte.
 */
import { isExpired, refreshTokens } from "./auth-manager.server";
import {
  addLogEntries,
  getConnection,
  listDevices,
  listLogEntries,
  patchConnection,
} from "./repository.server";
import { ALEXA_NO_DEVICE_API, type AlexaSyncResult } from "./model";

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

/**
 * „Abgleich": prüft nur noch die Kontoverbindung (Token) und meldet
 * transparent, dass Amazon keine Geräteliste bereitstellt.
 */
export async function syncAlexaDevices(userId: string): Promise<AlexaSyncResult> {
  await accessTokenFor(userId);

  await addLogEntries(userId, [
    {
      endpoint: "—",
      method: "INFO",
      statusCode: null,
      durationMs: null,
      ok: false,
      message: ALEXA_NO_DEVICE_API,
      details: {},
    },
  ]);

  const syncedAt = new Date().toISOString();
  await patchConnection(userId, { last_sync_at: syncedAt, last_error: ALEXA_NO_DEVICE_API });

  const devices = await listDevices(userId);
  return {
    available: false,
    reason: ALEXA_NO_DEVICE_API,
    imported: 0,
    online: devices.filter((device) => device.isOnline).length,
    devices,
    log: await listLogEntries(userId),
    syncedAt,
  };
}

export type AlexaCommandResult = { ok: boolean; message: string };

/**
 * Steuerbefehle sind über Login with Amazon nicht möglich: Amazon bietet
 * dafür keine öffentlich dokumentierte Schnittstelle an.
 */
export async function sendAlexaCommand(
  userId: string,
  _deviceId: string,
  _payload: { volume?: number; muted?: boolean },
): Promise<AlexaCommandResult> {
  await addLogEntries(userId, [
    {
      endpoint: "—",
      method: "INFO",
      statusCode: null,
      durationMs: null,
      ok: false,
      message: ALEXA_NO_DEVICE_API,
      details: {},
    },
  ]);
  return { ok: false, message: ALEXA_NO_DEVICE_API };
}
