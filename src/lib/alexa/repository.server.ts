/**
 * AlexaRepository – einziger Datenbankzugang der Alexa-Integration.
 *
 * Server-only. Verbindungsdaten (Tokens) liegen in einer Tabelle, auf die
 * ausschließlich der Server-Schlüssel Zugriff hat.
 */
import type { Tables } from "@/integrations/supabase/types";
import {
  classifyAlexaDevice,
  alexaDeviceTypeLabel,
  type AlexaDeviceModel,
  type AlexaLogEntry,
  type AlexaSettingsModel,
} from "./model";

export type AlexaConnectionRow = Tables<"alexa_connections">;

async function admin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

/* ------------------------------- Verbindung ------------------------------- */

export async function getConnection(userId: string): Promise<AlexaConnectionRow | null> {
  const db = await admin();
  const { data } = await db
    .from("alexa_connections")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();
  return data ?? null;
}

export async function saveConnection(
  userId: string,
  values: Partial<AlexaConnectionRow> & { access_token: string; expires_at: string },
): Promise<void> {
  const db = await admin();
  const existing = await getConnection(userId);
  const { error } = existing
    ? await db.from("alexa_connections").update(values).eq("user_id", userId)
    : await db.from("alexa_connections").insert({ ...values, user_id: userId });
  if (error) throw new Error(error.message);
}

export async function patchConnection(
  userId: string,
  values: Partial<AlexaConnectionRow>,
): Promise<void> {
  const db = await admin();
  await db.from("alexa_connections").update(values).eq("user_id", userId);
}

export async function deleteConnection(userId: string): Promise<void> {
  const db = await admin();
  await db.from("alexa_connections").delete().eq("user_id", userId);
}

/* --------------------------------- Geräte --------------------------------- */

function toModel(row: Tables<"alexa_devices">): AlexaDeviceModel {
  const typeId = classifyAlexaDevice(row.device_family, row.device_type, row.name);
  return {
    id: row.id,
    deviceId: row.device_id,
    serialNumber: row.serial_number,
    name: row.name,
    deviceType: row.device_type,
    deviceFamily: row.device_family,
    typeId,
    typeLabel: alexaDeviceTypeLabel[typeId],
    room: row.room,
    isOnline: row.is_online,
    firmwareVersion: row.firmware_version,
    softwareVersion: row.software_version,
    wifiStatus: row.wifi_status,
    capabilities: Array.isArray(row.capabilities) ? (row.capabilities as string[]) : [],
    unsupportedProperties: Array.isArray(row.unsupported_properties)
      ? (row.unsupported_properties as string[])
      : [],
    lastSyncedAt: row.last_synced_at,
  };
}

export async function listDevices(userId: string): Promise<AlexaDeviceModel[]> {
  const db = await admin();
  const { data } = await db
    .from("alexa_devices")
    .select("*")
    .eq("user_id", userId)
    .order("name");
  return (data ?? []).map(toModel);
}

export async function getDevice(
  userId: string,
  deviceId: string,
): Promise<AlexaDeviceModel | null> {
  const db = await admin();
  const { data } = await db
    .from("alexa_devices")
    .select("*")
    .eq("user_id", userId)
    .eq("device_id", deviceId)
    .maybeSingle();
  return data ? toModel(data) : null;
}

export type AlexaDeviceUpsert = {
  device_id: string;
  serial_number: string | null;
  name: string;
  device_type: string | null;
  device_family: string | null;
  room: string | null;
  is_online: boolean;
  firmware_version: string | null;
  software_version: string | null;
  wifi_status: string | null;
  capabilities: string[];
  unsupported_properties: string[];
  raw_source: string;
};

export async function upsertDevices(
  userId: string,
  devices: AlexaDeviceUpsert[],
): Promise<number> {
  if (!devices.length) return 0;
  const db = await admin();
  const stamp = new Date().toISOString();
  let saved = 0;

  for (const device of devices) {
    const payload = { ...device, user_id: userId, last_synced_at: stamp };
    const { data: existing } = await db
      .from("alexa_devices")
      .select("id")
      .eq("user_id", userId)
      .eq("device_id", device.device_id)
      .maybeSingle();

    const { error } = existing
      ? await db.from("alexa_devices").update(payload).eq("id", existing.id)
      : await db.from("alexa_devices").insert(payload);
    if (!error) saved += 1;
  }
  return saved;
}

export async function deleteDevices(userId: string): Promise<void> {
  const db = await admin();
  await db.from("alexa_devices").delete().eq("user_id", userId);
}

/* ------------------------------ Einstellungen ------------------------------ */

const defaultSettings: AlexaSettingsModel = {
  autoSync: true,
  syncIntervalMinutes: 15,
  debugMode: false,
};

export async function getSettings(userId: string): Promise<AlexaSettingsModel> {
  const db = await admin();
  const { data } = await db
    .from("alexa_settings")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();
  if (!data) return defaultSettings;
  return {
    autoSync: data.auto_sync,
    syncIntervalMinutes: data.sync_interval_minutes,
    debugMode: data.debug_mode,
  };
}

export async function saveSettings(
  userId: string,
  settings: AlexaSettingsModel,
): Promise<AlexaSettingsModel> {
  const db = await admin();
  const payload = {
    user_id: userId,
    auto_sync: settings.autoSync,
    sync_interval_minutes: settings.syncIntervalMinutes,
    debug_mode: settings.debugMode,
  };
  const { data: existing } = await db
    .from("alexa_settings")
    .select("user_id")
    .eq("user_id", userId)
    .maybeSingle();
  const { error } = existing
    ? await db.from("alexa_settings").update(payload).eq("user_id", userId)
    : await db.from("alexa_settings").insert(payload);
  if (error) throw new Error(error.message);
  return settings;
}

/* -------------------------------- Protokoll -------------------------------- */

export type AlexaLogInput = {
  endpoint: string;
  method: string;
  statusCode: number | null;
  durationMs: number | null;
  ok: boolean;
  message: string | null;
  details?: Record<string, unknown>;
};

export async function addLogEntries(userId: string, entries: AlexaLogInput[]): Promise<void> {
  if (!entries.length) return;
  const db = await admin();
  await db.from("alexa_sync_log").insert(
    entries.map((entry) => ({
      user_id: userId,
      endpoint: entry.endpoint,
      method: entry.method,
      status_code: entry.statusCode,
      duration_ms: entry.durationMs,
      ok: entry.ok,
      message: entry.message,
      details: entry.details ?? {},
    })),
  );
}

export async function listLogEntries(userId: string, limit = 40): Promise<AlexaLogEntry[]> {
  const db = await admin();
  const { data } = await db
    .from("alexa_sync_log")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(limit);
  return (data ?? []).map((row) => ({
    id: row.id,
    endpoint: row.endpoint,
    method: row.method,
    statusCode: row.status_code,
    durationMs: row.duration_ms,
    ok: row.ok,
    message: row.message,
    createdAt: row.created_at,
  }));
}

export async function clearLog(userId: string): Promise<void> {
  const db = await admin();
  await db.from("alexa_sync_log").delete().eq("user_id", userId);
}
