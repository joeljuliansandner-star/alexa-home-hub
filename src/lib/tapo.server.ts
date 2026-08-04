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

/**
 * Untergeräte einer Steuerzentrale laden (Tapo H100, Kasa KH100).
 * Die Cloud liefert die Liste per Passthrough; schläft der Hub, wirft sie einen Fehler.
 */
export async function tapoChildDevices(
  token: string,
  hubId: string,
): Promise<{ children: TapoChildDevice[]; error: string | null }> {
  const children: TapoChildDevice[] = [];
  let startIndex = 0;

  for (let page = 0; page < 6; page += 1) {
    let payload: CloudResponse<{ responseData: string }>;
    try {
      payload = await cloudCall<{ responseData: string }>(
        `${CLOUD_URL}?token=${encodeURIComponent(token)}`,
        {
          method: "passthrough",
          params: {
            deviceId: hubId,
            requestData: JSON.stringify({
              method: "get_child_device_list",
              params: { start_index: startIndex },
            }),
          },
        },
      );
    } catch (err) {
      return { children, error: err instanceof Error ? err.message : "Unbekannter Fehler" };
    }

    if (payload.error_code !== 0) {
      return {
        children,
        error:
          payload.error_code === -20571
            ? "Die Steuerzentrale nimmt über die Cloud keine Abfragen an (nur im Heimnetz erreichbar)."
            : `Untergeräte konnten nicht geladen werden (Code ${payload.error_code}).`,
      };
    }

    let inner: { error_code?: number; result?: { child_device_list?: Array<Record<string, unknown>>; sum?: number } };
    try {
      inner = JSON.parse(String(payload.result?.responseData ?? "{}"));
    } catch {
      return { children, error: "Antwort der Steuerzentrale war unlesbar." };
    }

    if (inner.error_code && inner.error_code !== 0) {
      return { children, error: `Steuerzentrale meldet Fehler ${inner.error_code}.` };
    }

    const list = inner.result?.child_device_list ?? [];
    if (!list.length) break;

    for (const raw of list) {
      const model = String(raw["model"] ?? "Gerät");
      const temperature = raw["current_temp"] ?? raw["temperature"] ?? raw["target_temp"];
      const humidity = raw["current_humidity"] ?? raw["humidity"];
      const hasTemp = typeof temperature === "number";
      children.push({
        deviceId: String(raw["device_id"] ?? ""),
        parentId: hubId,
        name: decodeNickname(raw["nickname"], model),
        model,
        category: String(raw["category"] ?? raw["type"] ?? ""),
        online: raw["status"] === undefined ? true : String(raw["status"]).toLowerCase() !== "offline",
        battery: typeof raw["battery_percentage"] === "number" ? (raw["battery_percentage"] as number) : null,
        sensorValue: hasTemp ? (temperature as number) : typeof humidity === "number" ? humidity : null,
        sensorUnit: hasTemp ? "°C" : typeof humidity === "number" ? "%" : null,
      });
    }

    startIndex += list.length;
    if (inner.result?.sum !== undefined && startIndex >= Number(inner.result.sum)) break;
  }

  return { children, error: null };
}
