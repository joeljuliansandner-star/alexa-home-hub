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

type DreameApiRecord = {
  did?: unknown;
  model?: unknown;
  customName?: unknown;
  deviceInfo?: { displayName?: unknown };
  online?: unknown;
  bindDomain?: unknown;
  [key: string]: unknown;
};

type DreamePropResponse = {
  code?: number;
  siid?: number;
  piid?: number;
  value?: unknown;
};

type DreameApiResponse = {
  code?: number;
  data?: {
    result?: DreamePropResponse[];
    page?: { records?: unknown };
    records?: unknown;
    [key: string]: unknown;
  };
  result?: DreamePropResponse[];
};

let cached: { session: DreameSession; expires: number } | null = null;

export async function dreameLogin(): Promise<DreameSession> {
  if (cached && cached.expires > Date.now() + 60_000) return cached.session;

  const email = process.env["DREAME_EMAIL"];
  const password = process.env["DREAME_PASSWORD"];
  if (!email || !password) throw new Error("Dreame-Zugangsdaten fehlen.");

  const hashed = createHash("md5")
    .update(password + PASSWORD_SALT)
    .digest("hex");

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

  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    throw new Error("Dreame-Geräteliste: unerwartete Antwort");
  }

  const parsed = json as {
    data?: {
      page?: { records?: unknown };
      records?: unknown;
      [key: string]: unknown;
    };
    [key: string]: unknown;
  };
  const list = (parsed?.data?.page?.records ??
    parsed?.data?.records ??
    parsed?.data ??
    []) as unknown;
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

/** MIoT-Eigenschaften (Standard-Dreame-Spezifikation). */
const PROPS = {
  state: [2, 1],
  error: [2, 2],
  battery: [3, 1],
  chargingState: [3, 2],
  status: [4, 1],
  cleanTime: [4, 2],
  cleanArea: [4, 3],
  suction: [4, 4],
  water: [4, 5],
  waterTank: [4, 6],
  taskStatus: [4, 7],
  resumeCleaning: [4, 11],
  carpetBoost: [4, 12],
  childLock: [4, 13],
  autoEmpty: [4, 26],
  dndEnabled: [5, 1],
  dndStart: [5, 2],
  dndEnd: [5, 3],
  volume: [7, 2],
  mainBrushLife: [9, 2],
  sideBrushLife: [10, 2],
  filterLife: [11, 2],
  mapObject: [6, 6],
} as const;

export type DreamePropKey = keyof typeof PROPS;

export type DreameState = {
  battery: number | null;
  state: number | null;
  status: number | null;
  chargingState: number | null;
  cleanArea: number | null;
  cleanTime: number | null;
  error: number | null;
  suction: number | null;
  water: number | null;
  waterTank: number | null;
  taskStatus: number | null;
  resumeCleaning: number | null;
  carpetBoost: number | null;
  childLock: number | null;
  autoEmpty: number | null;
  dndEnabled: number | null;
  dndStart: string | null;
  dndEnd: string | null;
  volume: number | null;
  mainBrushLife: number | null;
  sideBrushLife: number | null;
  filterLife: number | null;
  rooms: { id: number; name: string }[];
  isRunning: boolean;
  label: string;
  reachable: boolean;
};

function emptyState(): DreameState {
  return {
    battery: null,
    state: null,
    status: null,
    chargingState: null,
    cleanArea: null,
    cleanTime: null,
    error: null,
    suction: null,
    water: null,
    waterTank: null,
    taskStatus: null,
    resumeCleaning: null,
    carpetBoost: null,
    childLock: null,
    autoEmpty: null,
    dndEnabled: null,
    dndStart: null,
    dndEnd: null,
    volume: null,
    mainBrushLife: null,
    sideBrushLife: null,
    filterLife: null,
    rooms: [],
    isRunning: false,
    label: "Standby (schläft)",
    reachable: false,
  };
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export async function dreameGetState(session: DreameSession, did: string): Promise<DreameState> {
  const entries = Object.entries(PROPS) as [DreamePropKey, readonly [number, number]][];
  const values = new Map<DreamePropKey, unknown>();
  let reachable = false;

  // Der Roboter schläft in der Ladestation und antwortet dann erst nach ein paar
  // Versuchen (Cloud-Code 80001 = "Befehl abgelaufen") -> mit Wiederholungen wecken.
  for (let i = 0; i < entries.length; i += 6) {
    const chunk = entries.slice(i, i + 6);
    let results: DreamePropResponse[] = [];

    const attempts = i === 0 ? 4 : 2;
    for (let attempt = 0; attempt < attempts; attempt++) {
      let response: DreameApiResponse | null = null;
      try {
        response = await sendCommand(session, did, {
          did,
          id: Math.floor(Math.random() * 9000) + 1000,
          method: "get_properties",
          params: chunk.map(([, [siid, piid]]) => ({ did, siid, piid })),
          from: "XXXXXX",
        });
      } catch {
        response = null;
      }

      const list = (response?.data?.result ?? response?.result ?? []) as DreamePropResponse[];
      if (Array.isArray(list) && list.length > 0) {
        results = list;
        break;
      }
      // Nur wiederholen, wenn der Roboter geschlafen hat (Timeout der Cloud).
      if (attempt < attempts - 1) await sleep(1200);
    }

    if (results.length === 0) {
      // Erster Block ohne Antwort => Roboter schläft wirklich, weitere Blöcke sparen wir uns.
      if (i === 0) break;
      continue;
    }
    reachable = true;

    for (const [key, [siid, piid]] of chunk) {
      const hit = results.find((r) => r?.siid === siid && r?.piid === piid);
      if (hit && hit.code === 0 && hit.value !== undefined && hit.value !== null) {
        values.set(key, hit.value);
      }
    }
  }

  if (!reachable) return emptyState();

  const num = (key: DreamePropKey) => {
    const value = values.get(key);
    if (typeof value === "number") return value;
    if (typeof value === "string" && value.trim() !== "" && !Number.isNaN(Number(value))) {
      return Number(value);
    }
    return null;
  };
  const str = (key: DreamePropKey) => {
    const value = values.get(key);
    return typeof value === "string" ? value : null;
  };

  const state = num("state");
  const battery = num("battery");
  const chargingState = num("chargingState");
  const isRunning = state === 1 || state === 7;

  let label: string;
  if (isRunning) {
    label = state === 7 ? "Wischt" : "Reinigt";
  } else if (chargingState === 1) {
    label = battery !== null && battery >= 99 ? "Vollständig geladen" : "Lädt";
  } else {
    label = (state !== null ? DREAME_STATE_LABEL[state] : undefined) ?? "Bereit";
  }

  return {
    battery,
    state,
    status: num("status"),
    chargingState,
    cleanArea: num("cleanArea"),
    cleanTime: num("cleanTime"),
    error: num("error"),
    suction: num("suction"),
    water: num("water"),
    waterTank: num("waterTank"),
    taskStatus: num("taskStatus"),
    resumeCleaning: num("resumeCleaning"),
    carpetBoost: num("carpetBoost"),
    childLock: num("childLock"),
    autoEmpty: num("autoEmpty"),
    dndEnabled: num("dndEnabled"),
    dndStart: str("dndStart"),
    dndEnd: str("dndEnd"),
    volume: num("volume"),
    mainBrushLife: num("mainBrushLife"),
    sideBrushLife: num("sideBrushLife"),
    filterLife: num("filterLife"),
    rooms: [],
    isRunning,
    label,
    reachable: true,
  };
}

/** Setzt eine Einstellung (Saugkraft, Wasser, Lautstärke, …). */
export async function dreameSetProp(
  session: DreameSession,
  did: string,
  key: DreamePropKey,
  value: number | string,
): Promise<{ ok: boolean; message: string }> {
  const [siid, piid] = PROPS[key];
  const response = await sendCommand(session, did, {
    did,
    id: Math.floor(Math.random() * 9000) + 1000,
    method: "set_properties",
    params: [{ did, siid, piid, value }],
    from: "XXXXXX",
  });
  return interpret(response);
}

const ACTIONS = {
  start: [4, 1],
  pause: [4, 2],
  dock: [3, 1],
  locate: [7, 1],
  emptyDustbin: [15, 1],
} as const;

export type DreameActionKey = keyof typeof ACTIONS;

export async function dreameAction(
  session: DreameSession,
  did: string,
  action: DreameActionKey,
): Promise<{ ok: boolean; message: string }> {
  const [siid, aiid] = ACTIONS[action];
  const response = await sendCommand(session, did, {
    did,
    id: Math.floor(Math.random() * 9000) + 1000,
    method: "action",
    params: { did, siid, aiid, in: [] },
    from: "XXXXXX",
  });
  return interpret(response);
}

/** Startet die Reinigung ausgewählter Räume (Raum-IDs aus der Dreame-Karte). */
export async function dreameCleanRooms(
  session: DreameSession,
  did: string,
  roomIds: number[],
): Promise<{ ok: boolean; message: string }> {
  const segments = roomIds.map((id) => [id, 1]);
  const payload = JSON.stringify({ selects: segments });
  const response = await sendCommand(session, did, {
    did,
    id: Math.floor(Math.random() * 9000) + 1000,
    method: "action",
    params: {
      did,
      siid: 4,
      aiid: 1,
      in: [
        { piid: 1, value: 18 },
        { piid: 10, value: payload },
      ],
    },
    from: "XXXXXX",
  });
  return interpret(response);
}

function interpret(response: DreameApiResponse | null | undefined): {
  ok: boolean;
  message: string;
} {
  const code = response?.code ?? response?.data?.code ?? 0;
  if (code === 0) return { ok: true, message: "Befehl gesendet" };
  if (code === 80001) {
    return { ok: false, message: "Der Saugroboter hat nicht geantwortet (offline/Standby?)" };
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
