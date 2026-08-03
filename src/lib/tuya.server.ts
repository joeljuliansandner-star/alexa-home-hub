/**
 * Tuya / Smart Life Cloud API (offizielle OpenAPI).
 * Server-only: liest TUYA_ACCESS_ID, TUYA_ACCESS_SECRET und optional
 * TUYA_REGION aus der Server-Umgebung. Niemals aus dem Browser importieren.
 */

const REGION_HOSTS: Record<string, string> = {
  eu: "https://openapi.tuyaeu.com",
  us: "https://openapi.tuyaus.com",
  cn: "https://openapi.tuyacn.com",
  in: "https://openapi.tuyain.com",
};

function config() {
  const accessId = process.env["TUYA_ACCESS_ID"];
  const accessSecret = process.env["TUYA_ACCESS_SECRET"];
  if (!accessId || !accessSecret) {
    throw new Error(
      "Tuya-Zugangsdaten fehlen. Bitte Access ID und Access Secret aus iot.tuya.com hinterlegen.",
    );
  }
  const region = (process.env["TUYA_REGION"] ?? "eu").toLowerCase();
  return { accessId, accessSecret, host: REGION_HOSTS[region] ?? REGION_HOSTS["eu"]! };
}

const encoder = new TextEncoder();

function toHex(buffer: ArrayBuffer): string {
  return Array.from(new Uint8Array(buffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

async function sha256(text: string): Promise<string> {
  return toHex(await crypto.subtle.digest("SHA-256", encoder.encode(text)));
}

async function hmacSha256(message: string, secret: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, encoder.encode(message));
  return toHex(sig).toUpperCase();
}

interface TuyaResponse<T> {
  success: boolean;
  code?: number;
  msg?: string;
  result?: T;
}

async function request<T>(
  method: "GET" | "POST",
  path: string,
  options: { body?: unknown; accessToken?: string } = {},
): Promise<T> {
  const { accessId, accessSecret, host } = config();
  const bodyText = options.body === undefined ? "" : JSON.stringify(options.body);
  const t = Date.now().toString();

  const stringToSign = [method, await sha256(bodyText), "", path].join("\n");
  const payload = accessId + (options.accessToken ?? "") + t + stringToSign;
  const sign = await hmacSha256(payload, accessSecret);

  const headers: Record<string, string> = {
    client_id: accessId,
    sign,
    t,
    sign_method: "HMAC-SHA256",
    "Content-Type": "application/json",
  };
  if (options.accessToken) headers["access_token"] = options.accessToken;

  const res = await fetch(`${host}${path}`, {
    method,
    headers,
    ...(bodyText ? { body: bodyText } : {}),
  });
  const data = (await res.json()) as TuyaResponse<T>;

  if (!data.success) {
    throw new Error(tuyaErrorMessage(data.code, data.msg));
  }
  return data.result as T;
}

function tuyaErrorMessage(code?: number, msg?: string): string {
  switch (code) {
    case 1004:
      return "Tuya: Signatur ungültig – Access Secret stimmt nicht.";
    case 1106:
      return "Tuya: Keine Berechtigung. Prüfe, ob im Cloud-Projekt die API IoT Core aktiviert ist.";
    case 1114:
    case 2406:
      return "Tuya: Falsches Rechenzentrum. Das Cloud-Projekt muss in derselben Region liegen wie deine Smart-Life-App (Europa).";
    case 28841002:
      return "Tuya: Die kostenlose Testlaufzeit des Cloud-Projekts ist abgelaufen – im Portal verlängern.";
    default:
      return `Tuya-Fehler ${code ?? "?"}: ${msg ?? "unbekannt"}`;
  }
}

export async function tuyaToken(): Promise<string> {
  const result = await request<{ access_token: string }>("GET", "/v1.0/token?grant_type=1");
  return result.access_token;
}

export interface TuyaDevice {
  id: string;
  name: string;
  category: string;
  product_name?: string;
  online: boolean;
  status: Array<{ code: string; value: unknown }>;
}

/** Alle Geräte, die mit dem verknüpften Smart-Life-Konto verbunden sind. */
export async function tuyaDeviceList(token: string): Promise<TuyaDevice[]> {
  const result = await request<{ devices: Array<Record<string, unknown>> }>(
    "GET",
    "/v1.0/iot-01/associated-users/devices?size=100",
    { accessToken: token },
  );

  return (result.devices ?? []).map((raw) => ({
    id: String(raw["id"] ?? ""),
    name: String(raw["name"] ?? "Gerät"),
    category: String(raw["category"] ?? ""),
    product_name: raw["product_name"] ? String(raw["product_name"]) : undefined,
    online: Boolean(raw["online"]),
    status: Array.isArray(raw["status"])
      ? (raw["status"] as Array<{ code: string; value: unknown }>)
      : [],
  }));
}

export async function tuyaDeviceStatus(
  token: string,
  deviceId: string,
): Promise<Array<{ code: string; value: unknown }>> {
  return request("GET", `/v1.0/iot-03/devices/${deviceId}/status`, { accessToken: token });
}

export async function tuyaSendCommands(
  token: string,
  deviceId: string,
  commands: Array<{ code: string; value: unknown }>,
): Promise<boolean> {
  return request<boolean>("POST", `/v1.0/iot-03/devices/${deviceId}/commands`, {
    accessToken: token,
    body: { commands },
  });
}

/** Findet den passenden Schalt-Datenpunkt (heißt je nach Gerät anders). */
export function switchCode(status: Array<{ code: string; value: unknown }>): string | null {
  const codes = status.filter((s) => typeof s.value === "boolean").map((s) => s.code);
  const preferred = ["switch_led", "switch", "switch_1"];
  for (const c of preferred) if (codes.includes(c)) return c;
  return codes.find((c) => c.startsWith("switch")) ?? null;
}

/** Findet den Dimm-Datenpunkt und seinen Wertebereich. */
export function brightnessCode(
  status: Array<{ code: string; value: unknown }>,
): { code: string; max: number } | null {
  const candidates = ["bright_value_v2", "bright_value", "brightness"];
  for (const code of candidates) {
    if (status.some((s) => s.code === code)) {
      return { code, max: code === "bright_value_v2" ? 1000 : 255 };
    }
  }
  return null;
}

const CATEGORY_KIND: Record<string, "light" | "plug" | "thermostat" | "blind" | "sensor"> = {
  dj: "light",
  dd: "light",
  dc: "light",
  xdd: "light",
  fwd: "light",
  gyd: "light",
  tgq: "light",
  tyndj: "light",
  cz: "plug",
  pc: "plug",
  kg: "plug",
  tdq: "plug",
  wk: "thermostat",
  wkf: "thermostat",
  qn: "thermostat",
  cl: "blind",
  clkg: "blind",
};

export function kindForCategory(category: string): "light" | "plug" | "thermostat" | "blind" | "sensor" {
  return CATEGORY_KIND[category.toLowerCase()] ?? "sensor";
}
