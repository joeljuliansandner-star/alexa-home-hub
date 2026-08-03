import { createHash } from "node:crypto";

/**
 * Zugriff auf die Dreamehome-Cloud (inoffiziell, reverse engineered).
 * Wird ausschließlich serverseitig benutzt.
 */

const BASE = "https://eu.iot.dreame.tech:13267";
const BASIC = "Basic ZHJlYW1lX2FwcHYxOkFQXmR2QHpAU1FZVnhOODg=";
const PASSWORD_SALT = "RAylYC%fmSKp7%Tq";
// hex(AES-128-ECB("EETjszu*XI5znHsI", "eu|en|GB")) – fest, da Region/Sprache konstant
const RLC = "dc16ba99f108a716eccca52388aac983";

function baseHeaders(token?: string): Record<string, string> {
  return {
    "user-agent": "Dart/3.2 (dart:io)",
    authorization: BASIC,
    "dreame-auth": token ? `bearer ${token}` : "bearer",
    "dreame-meta": "cv=i_829",
    "dreame-rlc": RLC,
    "tenant-id": "000000",
  };
}

export type DreameSession = { token: string; uid: string };

let cached: { session: DreameSession; expires: number } | null = null;

export async function dreameLogin(): Promise<DreameSession> {
  if (cached && cached.expires > Date.now() + 60_000) return cached.session;

  const email = process.env["DREAME_EMAIL"];
  const password = process.env["DREAME_PASSWORD"];
  if (!email || !password) throw new Error("Dreame-Zugangsdaten fehlen.");

  const hashed = createHash("md5").update(password + PASSWORD_SALT).digest("hex");

  const body = new URLSearchParams({
    grant_type: "password",
    scope: "all",
    platform: "IOS",
    type: "account",
    username: email,
    password: hashed,
    country: "GB",
    lang: "en",
  });

  const res = await fetch(`${BASE}/dreame-auth/oauth/token`, {
    method: "POST",
    headers: { ...baseHeaders(), "content-type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });

  const text = await res.text();
  if (!res.ok) {
    throw new Error(`Dreame-Login fehlgeschlagen (${res.status}): ${text.slice(0, 200)}`);
  }

  let json: { access_token?: string; uid?: string; expires_in?: number };
  try {
    json = JSON.parse(text);
  } catch {
    throw new Error("Dreame-Login: unerwartete Antwort");
  }
  if (!json.access_token || !json.uid) {
    throw new Error("Dreame-Login: kein Zugriffstoken erhalten (evtl. 2FA aktiv)");
  }

  const session = { token: json.access_token, uid: String(json.uid) };
  cached = { session, expires: Date.now() + (json.expires_in ?? 7200) * 1000 };
  return session;
}

export type DreameDevice = {
  did: string;
  model: string;
  name: string;
  online: boolean;
};

export async function dreameDeviceList(session: DreameSession): Promise<DreameDevice[]> {
  const res = await fetch(`${BASE}/dreame-user-iot/iotuserbind/device/listV2`, {
    method: "POST",
    headers: { ...baseHeaders(session.token), "content-type": "application/json" },
    body: JSON.stringify({
      sharedStatus: 1,
      current: 1,
      size: 100,
      lang: "en",
      timestamp: Date.now(),
    }),
  });

  const text = await res.text();
  if (!res.ok) throw new Error(`Dreame-Geräteliste fehlgeschlagen (${res.status})`);

  let json: any;
  try {
    json = JSON.parse(text);
  } catch {
    throw new Error("Dreame-Geräteliste: unerwartete Antwort");
  }

  const list: any[] = json?.data?.page?.records ?? json?.data?.records ?? json?.data ?? [];
  if (!Array.isArray(list)) return [];

  return list
    .filter((d) => typeof d?.did === "string")
    .map((d) => ({
      did: String(d.did),
      model: String(d.model ?? "dreame.vacuum"),
      name: String(d.customName || d.deviceInfo?.displayName || d.model || "Dreame"),
      online: d.online === true || d.online === 1 || d.bindDomain != null,
    }));
}

async function sendCommand(session: DreameSession, did: string, data: unknown) {
  const res = await fetch(`${BASE}/dreame-iot-com-10000/device/sendCommand`, {
    method: "POST",
    headers: { ...baseHeaders(session.token), "content-type": "application/json" },
    body: JSON.stringify({ did, id: Math.floor(Math.random() * 9000) + 1000, data }),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`Dreame-Befehl fehlgeschlagen (${res.status})`);
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

const PROPS = {
  state: [2, 1],
  error: [2, 2],
  battery: [3, 1],
  chargingState: [3, 2],
  status: [4, 1],
  cleanTime: [4, 2],
  cleanArea: [4, 3],
} as const;

export type DreameState = {
  battery: number | null;
  state: number | null;
  status: number | null;
  chargingState: number | null;
  cleanArea: number | null;
  cleanTime: number | null;
  isRunning: boolean;
  label: string;
};


export async function dreameGetState(
  session: DreameSession,
  did: string,
): Promise<DreameState> {
  const id = Math.floor(Math.random() * 9000) + 1000;
  const params = Object.values(PROPS).map(([siid, piid]) => ({ did, siid, piid }));
  const response = await sendCommand(session, did, {
    did,
    id,
    method: "get_properties",
    params,
    from: "XXXXXX",
  });

  const results: any[] = response?.data?.result ?? response?.result ?? [];
  const pick = (siid: number, piid: number) => {
    const hit = Array.isArray(results)
      ? results.find((r) => r?.siid === siid && r?.piid === piid)
      : null;
    const value = hit?.value;
    return typeof value === "number" ? value : null;
  };

  const state = pick(PROPS.state[0], PROPS.state[1]);
  return {
    battery: pick(PROPS.battery[0], PROPS.battery[1]),
    state,
    status: pick(PROPS.status[0], PROPS.status[1]),
    cleanArea: pick(PROPS.cleanArea[0], PROPS.cleanArea[1]),
    cleanTime: pick(PROPS.cleanTime[0], PROPS.cleanTime[1]),
    isRunning: state === 1 || state === 7,
  };
}

const ACTIONS = {
  start: [4, 1],
  pause: [4, 2],
  dock: [3, 1],
  locate: [7, 1],
} as const;

export async function dreameAction(
  session: DreameSession,
  did: string,
  action: keyof typeof ACTIONS,
): Promise<{ ok: boolean; message: string }> {
  const [siid, aiid] = ACTIONS[action];
  const id = Math.floor(Math.random() * 9000) + 1000;
  const response = await sendCommand(session, did, {
    did,
    id,
    method: "action",
    params: { did, siid, aiid, in: [] },
    from: "XXXXXX",
  });

  const code = response?.code ?? response?.data?.code ?? 0;
  if (code === 0) return { ok: true, message: "Befehl gesendet" };
  if (code === 80001) {
    return { ok: false, message: "Der Saugroboter hat nicht geantwortet (offline?)" };
  }
  return { ok: false, message: `Dreame hat den Befehl abgelehnt (${code})` };
}

export const DREAME_STATE_LABEL: Record<number, string> = {
  1: "Reinigt",
  2: "Bereit",
  3: "Pausiert",
  4: "Fehler",
  5: "Fährt zur Ladestation",
  6: "Lädt",
  7: "Wischt",
  8: "Laden unterbrochen",
  9: "Erstellt Karte",
  13: "Schlafmodus",
  14: "Bereit",
};
