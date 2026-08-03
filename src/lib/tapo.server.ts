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

export async function tapoDeviceList(token: string): Promise<TapoCloudDevice[]> {
  const data = await cloudCall<{ deviceList: Array<Record<string, unknown>> }>(
    `${CLOUD_URL}?token=${encodeURIComponent(token)}`,
    { method: "getDeviceList" },
  );
  if (data.error_code !== 0) {
    throw new Error(`Geräteliste konnte nicht geladen werden (Code ${data.error_code}).`);
  }

  return (data.result?.deviceList ?? []).map((raw) => {
    const model = String(raw["deviceModel"] ?? "Gerät");
    return {
      deviceId: String(raw["deviceId"] ?? ""),
      alias: decodeAlias(String(raw["alias"] ?? ""), String(raw["deviceName"] ?? model)),
      deviceModel: model,
      deviceType: String(raw["deviceType"] ?? ""),
      fwVer: String(raw["fwVer"] ?? ""),
      status: Number(raw["status"] ?? 0),
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
  if (t.includes("HUB")) return { kind: "sensor" as const, label: "Steuerzentrale" };
  if (m.startsWith("P1") || m.startsWith("P3") || t.includes("PLUG"))
    return { kind: "plug" as const, label: "Steckdose" };
  if (m.startsWith("L") || t.includes("BULB") || t.includes("LIGHT"))
    return { kind: "light" as const, label: "Licht" };
  if (t.includes("SWITCH")) return { kind: "plug" as const, label: "Schalter" };
  return { kind: "sensor" as const, label: "Gerät" };
}
