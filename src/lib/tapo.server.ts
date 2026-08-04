/**
 * Tapo / TP-Link Cloud API helpers. Server-only: reads TAPO_EMAIL and
 * TAPO_PASSWORD from the server environment. Never import from the browser.
 */

const CLOUD_URL = "https://eu-wap.tplinkcloud.com/";
const TERMINAL_UUID = "9d0f9b1a-6c8c-4a1e-9f34-7b1e2c8a5d31";

type CloudResponse<T> = { error_code: number; msg?: string; result?: T };

async function cloudCall<T>(url: string, body: unknown): Promise<CloudResponse<T>> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`Tapo Cloud antwortete mit Status ${res.status}`);
  return (await res.json()) as CloudResponse<T>;
}

export async function tapoLogin(): Promise<string> {
  const cloudUserName = process.env["TAPO_EMAIL"];
  const cloudPassword = process.env["TAPO_PASSWORD"];
  if (!cloudUserName || !cloudPassword) {
    throw new Error("Tapo-Zugangsdaten sind nicht hinterlegt.");
  }

  const data = await cloudCall<{ token: string }>(CLOUD_URL, {
    method: "login",
    params: {
      appType: "Tapo_Android",
      cloudUserName,
      cloudPassword,
      terminalUUID: TERMINAL_UUID,
    },
  });

  if (data.error_code !== 0 || !data.result?.token) {
    throw new Error(
      data.error_code === -20601
        ? "Tapo-Login fehlgeschlagen: E-Mail oder Passwort stimmt nicht."
        : `Tapo-Login fehlgeschlagen (Code ${data.error_code}).`,
    );
  }
  return data.result.token;
}

export interface TapoCloudDevice {
  deviceId: string;
  alias: string;
  deviceModel: string;
  deviceType: string;
  fwVer: string;
  status: number;
  isOnline: boolean;
}

function decodeAlias(raw: string, fallback: string): string {
  try {
    const text = Buffer.from(raw, "base64").toString("utf8");
    // Some aliases are stored plain, some base64 — reject binary garbage.
    return /[\p{L}\p{N}]/u.test(text) && !/[\uFFFD]/.test(text) ? text : fallback;
  } catch {
    return fallback;
  }
}

/** Entfernt Tokens, Passwörter und Konto-Daten aus Rohantworten. */
const SECRET_KEY = /token|password|passwd|secret|key|email|account|terminal|username|ssid|mac|ip/i;

export function redact(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(redact);
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = SECRET_KEY.test(k) ? "«entfernt»" : redact(v);
    }
    return out;
  }
  return value;
}

export async function tapoDeviceList(
  token: string,
): Promise<{ devices: TapoCloudDevice[]; raw: unknown }> {
  const data = await cloudCall<{ deviceList: Array<Record<string, unknown>> }>(
    `${CLOUD_URL}?token=${encodeURIComponent(token)}`,
    { method: "getDeviceList" },
  );
  if (data.error_code !== 0) {
    throw new Error(`Geräteliste konnte nicht geladen werden (Code ${data.error_code}).`);
  }

  const devices = (data.result?.deviceList ?? []).map((raw) => {
    const model = String(raw["deviceModel"] ?? "Gerät");
    // Fehlt das Statusfeld, gilt ein gelistetes Gerät als erreichbar.
    const rawStatus = raw["status"];
    const status = rawStatus === undefined || rawStatus === null ? 1 : Number(rawStatus);
    return {
      deviceId: String(raw["deviceId"] ?? ""),
      alias: decodeAlias(String(raw["alias"] ?? ""), String(raw["deviceName"] ?? model)),
      deviceModel: model,
      deviceType: String(raw["deviceType"] ?? ""),
      fwVer: String(raw["fwVer"] ?? ""),
      status,
      isOnline: status !== 0,
    };
  });

  return { devices, raw: redact(data) };
}

/** Cloud passthrough. Tapo devices usually reject this ("Device is offline"). */
export async function tapoPassthrough(
  token: string,
  deviceId: string,
  request: unknown,
): Promise<{ ok: boolean; message: string }> {
  const data = await cloudCall<{ responseData: string }>(
    `${CLOUD_URL}?token=${encodeURIComponent(token)}`,
    {
      method: "passthrough",
      params: { deviceId, requestData: JSON.stringify(request) },
    },
  );

  if (data.error_code === 0) return { ok: true, message: "Befehl gesendet" };
  if (data.error_code === -20571) {
    return {
      ok: false,
      message:
        "Tapo lässt für dieses Gerät keine Steuerung über die Cloud zu – es akzeptiert Befehle nur aus deinem Heimnetz.",
    };
  }
  return { ok: false, message: data.msg ?? `Tapo-Fehler ${data.error_code}` };
}

export function kindForModel(deviceType: string, model: string) {
  const t = deviceType.toUpperCase();
  const m = model.toUpperCase();
  if (t.includes("IPCAMERA")) return { kind: "sensor" as const, label: "Kamera" };
  if (t.includes("HUB") || m.startsWith("H1") || m.startsWith("KH"))
    return { kind: "sensor" as const, label: "Steuerzentrale" };
  if (m.startsWith("KE1") || t.includes("THERMOSTAT") || t.includes("TRV"))
    return { kind: "thermostat" as const, label: "Heizkörperthermostat" };
  if (m.startsWith("P1") || m.startsWith("P3") || t.includes("PLUG"))
    return { kind: "plug" as const, label: "Steckdose" };
  if (m.startsWith("L") || t.includes("BULB") || t.includes("LIGHT"))
    return { kind: "light" as const, label: "Licht" };
  if (t.includes("SWITCH")) return { kind: "plug" as const, label: "Schalter" };
  return { kind: "sensor" as const, label: "Gerät" };
}

/** Ist das Gerät eine Steuerzentrale (Tapo H100 / Kasa KH100)? */
export function isHubDevice(deviceType: string, model: string): boolean {
  const t = deviceType.toUpperCase();
  const m = model.toUpperCase();
  return t.includes("HUB") || m.startsWith("H100") || m.startsWith("KH100");
}

/** Lesbares Label für Sensoren am Hub. */
export function childLabel(model: string, category: string): string {
  const m = model.toUpperCase();
  const c = category.toLowerCase();
  if (m.startsWith("T110") || c.includes("contact")) return "Tür-/Fenstersensor";
  if (m.startsWith("T100") || c.includes("motion")) return "Bewegungsmelder";
  if (m.startsWith("T31") || m.startsWith("T30") || c.includes("temp"))
    return "Temperatur-/Feuchtesensor";
  if (m.startsWith("S200") || c.includes("button")) return "Taster";
  if (m.startsWith("KE100") || c.includes("kasa.switch.outlet.sub-fan")) return "Heizkörperthermostat";
  if (m.startsWith("S210") || m.startsWith("S220") || c.includes("switch")) return "Schalter";
  return "Sensor";
}

export interface TapoChildDevice {
  deviceId: string;
  parentId: string;
  name: string;
  model: string;
  category: string;
  online: boolean;
  battery: number | null;
  sensorValue: number | null;
  sensorUnit: string | null;
}

function decodeNickname(raw: unknown, fallback: string): string {
  if (typeof raw !== "string" || !raw) return fallback;
  return decodeAlias(raw, fallback);
}

export interface ChildProbeAttempt {
  /** Name der versuchten Cloud-Schnittstelle. */
  method: string;
  /** Wurden Untergeräte geliefert? */
  found: number;
  /** Hat die Cloud die Abfrage überhaupt beantwortet? */
  ok: boolean;
  message: string;
}

export interface HubChildResult {
  children: TapoChildDevice[];
  attempts: ChildProbeAttempt[];
  /** true, wenn irgendeine Cloud-Schnittstelle Untergeräte geliefert hat. */
  cloudSupported: boolean;
  error: string | null;
  raw: unknown[];
}

function parseChild(entry: Record<string, unknown>, hubId: string): TapoChildDevice {
  const model = String(entry["model"] ?? entry["deviceModel"] ?? "Gerät");
  const temperature = entry["current_temp"] ?? entry["temperature"] ?? entry["target_temp"];
  const humidity = entry["current_humidity"] ?? entry["humidity"];
  const hasTemp = typeof temperature === "number";
  const status = entry["status"];
  return {
    deviceId: String(entry["device_id"] ?? entry["deviceId"] ?? entry["mac"] ?? ""),
    parentId: hubId,
    name: decodeNickname(entry["nickname"] ?? entry["alias"], model),
    model,
    category: String(entry["category"] ?? entry["type"] ?? entry["deviceType"] ?? ""),
    online: status === undefined ? true : String(status).toLowerCase() !== "offline",
    battery:
      typeof entry["battery_percentage"] === "number" ? (entry["battery_percentage"] as number) : null,
    sensorValue: hasTemp ? (temperature as number) : typeof humidity === "number" ? humidity : null,
    sensorUnit: hasTemp ? "°C" : typeof humidity === "number" ? "%" : null,
  };
}

/** Ein Passthrough-Aufruf an die Steuerzentrale; liefert das entpackte Ergebnis. */
async function hubPassthrough(
  token: string,
  hubId: string,
  request: unknown,
): Promise<{ ok: boolean; message: string; inner: Record<string, unknown> | null }> {
  let payload: CloudResponse<{ responseData: string }>;
  try {
    payload = await cloudCall<{ responseData: string }>(
      `${CLOUD_URL}?token=${encodeURIComponent(token)}`,
      { method: "passthrough", params: { deviceId: hubId, requestData: JSON.stringify(request) } },
    );
  } catch (err) {
    return { ok: false, inner: null, message: err instanceof Error ? err.message : "Unbekannter Fehler" };
  }

  if (payload.error_code !== 0) {
    return {
      ok: false,
      inner: null,
      message:
        payload.error_code === -20571
          ? "Die TP-Link Cloud gibt diese Abfrage nicht an die Steuerzentrale weiter (nur im Heimnetz erreichbar)."
          : payload.msg ?? `Cloud-Fehler ${payload.error_code}`,
    };
  }

  try {
    const inner = JSON.parse(String(payload.result?.responseData ?? "{}")) as Record<string, unknown>;
    return { ok: true, inner, message: "Antwort erhalten" };
  } catch {
    return { ok: false, inner: null, message: "Antwort der Steuerzentrale war unlesbar." };
  }
}

/** Sammelt Untergeräte-Listen aus beliebig verschachtelten Antworten. */
function collectChildEntries(value: unknown): Array<Record<string, unknown>> {
  const out: Array<Record<string, unknown>> = [];
  const walk = (node: unknown) => {
    if (Array.isArray(node)) {
      for (const item of node) walk(item);
      return;
    }
    if (!node || typeof node !== "object") return;
    for (const [key, child] of Object.entries(node as Record<string, unknown>)) {
      if (/child(_?device)?(_?list|ren)/i.test(key) && Array.isArray(child)) {
        for (const item of child) {
          if (item && typeof item === "object") out.push(item as Record<string, unknown>);
        }
        continue;
      }
      walk(child);
    }
  };
  walk(value);
  return out;
}

/**
 * Prüft nacheinander alle bekannten Cloud-Wege, um Untergeräte einer
 * Steuerzentrale (Tapo H100 / Kasa KH100) zu laden. Liefert keine der
 * Schnittstellen Daten, wird das im Ergebnis klar gekennzeichnet.
 */
export async function tapoChildDevices(token: string, hubId: string): Promise<HubChildResult> {
  const attempts: ChildProbeAttempt[] = [];
  const raw: unknown[] = [];
  const children: TapoChildDevice[] = [];
  const seen = new Set<string>();

  const push = (entries: Array<Record<string, unknown>>) => {
    let added = 0;
    for (const entry of entries) {
      const child = parseChild(entry, hubId);
      const key = child.deviceId || `${child.model}-${child.name}`;
      if (!key || seen.has(key)) continue;
      seen.add(key);
      children.push(child);
      added += 1;
    }
    return added;
  };

  // 1) Tapo-Standard: get_child_device_list, seitenweise.
  let startIndex = 0;
  let pagedFound = 0;
  let pagedMessage = "Keine Untergeräte in der Antwort";
  let pagedOk = false;
  for (let page = 0; page < 6; page += 1) {
    const res = await hubPassthrough(token, hubId, {
      method: "get_child_device_list",
      params: { start_index: startIndex },
    });
    if (!res.ok) {
      pagedMessage = res.message;
      break;
    }
    pagedOk = true;
    raw.push(redact(res.inner));
    const errorCode = Number((res.inner as Record<string, unknown>)["error_code"] ?? 0);
    if (errorCode !== 0) {
      pagedMessage = `Steuerzentrale meldet Fehler ${errorCode}`;
      break;
    }
    const entries = collectChildEntries(res.inner);
    if (!entries.length) break;
    pagedFound += push(entries);
    startIndex += entries.length;
    const sum = (res.inner?.["result"] as Record<string, unknown> | undefined)?.["sum"];
    if (sum !== undefined && startIndex >= Number(sum)) break;
  }
  attempts.push({
    method: "passthrough → get_child_device_list",
    found: pagedFound,
    ok: pagedOk,
    message: pagedFound ? `${pagedFound} Untergeräte geliefert` : pagedMessage,
  });

  // 2) Alternative Tapo-Schnittstelle (Komponentenliste).
  if (!children.length) {
    const res = await hubPassthrough(token, hubId, {
      method: "get_child_device_component_list",
      params: { start_index: 0 },
    });
    if (res.ok) raw.push(redact(res.inner));
    const entries = res.ok ? collectChildEntries(res.inner) : [];
    const added = push(entries);
    attempts.push({
      method: "passthrough → get_child_device_component_list",
      found: added,
      ok: res.ok,
      message: added ? `${added} Untergeräte geliefert` : res.ok ? "Keine Untergeräte enthalten" : res.message,
    });
  }

  // 3) Kasa-Legacy: get_sysinfo enthält bei KH100 die Kinderliste.
  if (!children.length) {
    const res = await hubPassthrough(token, hubId, { system: { get_sysinfo: {} } });
    if (res.ok) raw.push(redact(res.inner));
    const entries = res.ok ? collectChildEntries(res.inner) : [];
    const added = push(entries);
    attempts.push({
      method: "passthrough → system.get_sysinfo",
      found: added,
      ok: res.ok,
      message: added ? `${added} Untergeräte geliefert` : res.ok ? "Keine Untergeräte enthalten" : res.message,
    });
  }

  // 4) Direkte Cloud-Methode (falls TP-Link sie für das Konto freigibt).
  if (!children.length) {
    let ok = false;
    let message = "Cloud kennt diese Methode nicht";
    let added = 0;
    try {
      const payload = await cloudCall<Record<string, unknown>>(
        `${CLOUD_URL}?token=${encodeURIComponent(token)}`,
        { method: "getChildDeviceList", params: { deviceId: hubId } },
      );
      raw.push(redact(payload));
      ok = payload.error_code === 0;
      message = ok ? "Antwort erhalten" : payload.msg ?? `Cloud-Fehler ${payload.error_code}`;
      if (ok) added = push(collectChildEntries(payload.result));
    } catch (err) {
      message = err instanceof Error ? err.message : "Unbekannter Fehler";
    }
    attempts.push({
      method: "Cloud → getChildDeviceList",
      found: added,
      ok,
      message: added ? `${added} Untergeräte geliefert` : message,
    });
  }

  const cloudSupported = children.length > 0;
  const error = cloudSupported
    ? null
    : "Die TP-Link Cloud stellt für diese Steuerzentrale keine Untergeräte bereit (keine der bekannten Cloud-Schnittstellen liefert Child Devices).";

  return { children, attempts, cloudSupported, error, raw };
}

