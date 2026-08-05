/**
 * Zentraler Home-Assistant-Service (Version 2.0).
 *
 * Alles läuft im Browser, weil Home Assistant meist nur im Heimnetz erreichbar
 * ist (homeassistant.local / lokale IP). Der Server der App kann diese Adresse
 * nicht erreichen – der Browser des Nutzers schon.
 *
 * Zuständig für:
 *  • REST API        • WebSocket API     • Authentifizierung
 *  • Token-Verwaltung• Reconnect         • Cache
 *  • Fehlerbehandlung• Live-Updates
 *
 * Alle Seiten dürfen ausschließlich diesen Service verwenden.
 */
import { supabase } from "@/integrations/supabase/client";

export type HaConnection = {
  baseUrl: string;
  token: string;
  version?: string | null;
  locationName?: string | null;
};

export type HaEntity = {
  entity_id: string;
  state: string;
  attributes: Record<string, unknown>;
  last_changed?: string;
  last_updated?: string;
};

export type HaArea = { area_id: string; name: string };

export type HaStatus = {
  rest: "unknown" | "ok" | "error";
  websocket: "closed" | "connecting" | "open" | "error";
  latencyMs: number | null;
  version: string | null;
  locationName: string | null;
  entityCount: number;
  deviceCount: number;
  lastSyncAt: string | null;
  lastError: string | null;
  baseUrl: string | null;
};

export const SUPPORTED_DOMAINS = [
  "light",
  "switch",
  "sensor",
  "binary_sensor",
  "camera",
  "cover",
  "fan",
  "climate",
  "vacuum",
  "media_player",
  "weather",
  "scene",
  "automation",
  "lock",
  "person",
] as const;

export type HaDomain = (typeof SUPPORTED_DOMAINS)[number];

const STORAGE_KEY = "ha.connection";
const DISCOVERY_CANDIDATES = [
  "http://homeassistant.local:8123",
  "http://homeassistant:8123",
  "http://192.168.178.2:8123",
  "http://192.168.1.2:8123",
];

export function domainOf(entityId: string): string {
  return entityId.split(".")[0] ?? "";
}

export function normalizeUrl(raw: string): string {
  let url = raw.trim().replace(/\/+$/, "");
  if (!/^https?:\/\//i.test(url)) url = `http://${url}`;
  return url;
}

/* -------------------------------------------------------------------------- */
/*                                   Service                                  */
/* -------------------------------------------------------------------------- */

type Listener = () => void;

class HomeAssistantService {
  private connection: HaConnection | null = null;
  private socket: WebSocket | null = null;
  private msgId = 1;
  private pending = new Map<number, { resolve: (v: unknown) => void; reject: (e: Error) => void }>();
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private reconnectDelay = 2000;
  private listeners = new Set<Listener>();
  private closedByUs = false;

  /** Cache der letzten bekannten Zustände (entity_id -> Entität). */
  states = new Map<string, HaEntity>();
  /** Entitäten, deren neuer Zustand noch nicht in die App-Datenbank geschrieben wurde. */
  dirty = new Set<string>();
  areas: HaArea[] = [];
  status: HaStatus = {
    rest: "unknown",
    websocket: "closed",
    latencyMs: null,
    version: null,
    locationName: null,
    entityCount: 0,
    deviceCount: 0,
    lastSyncAt: null,
    lastError: null,
    baseUrl: null,
  };

  /* ----------------------------- Abonnements ----------------------------- */

  subscribe(listener: Listener) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private emit() {
    for (const listener of this.listeners) listener();
  }

  private patchStatus(patch: Partial<HaStatus>) {
    this.status = { ...this.status, ...patch };
    this.emit();
  }

  /* ------------------------------ Token-Teil ----------------------------- */

  getConnection() {
    return this.connection;
  }

  /** Lädt die gespeicherte Verbindung (Datenbank, Fallback lokaler Speicher). */
  async loadConnection(): Promise<HaConnection | null> {
    if (this.connection) return this.connection;

    const { data } = await supabase
      .from("ha_connections")
      .select("base_url, access_token, ha_version, location_name, last_sync_at, last_error, entity_count")
      .maybeSingle();

    if (data) {
      this.connection = {
        baseUrl: data.base_url,
        token: data.access_token,
        version: data.ha_version,
        locationName: data.location_name,
      };
      this.patchStatus({
        version: data.ha_version,
        locationName: data.location_name,
        lastSyncAt: data.last_sync_at,
        lastError: data.last_error,
        entityCount: data.entity_count,
        baseUrl: data.base_url,
      });
      this.cacheLocally(this.connection);
      return this.connection;
    }

    if (typeof window !== "undefined") {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) {
        try {
          this.connection = JSON.parse(raw) as HaConnection;
          this.patchStatus({ baseUrl: this.connection.baseUrl });
          return this.connection;
        } catch {
          window.localStorage.removeItem(STORAGE_KEY);
        }
      }
    }
    return null;
  }

  private cacheLocally(connection: HaConnection) {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(connection));
  }

  /** Speichert die Verbindung dauerhaft und startet die Live-Verbindung. */
  async saveConnection(baseUrl: string, token: string) {
    const info = await this.testConnection(baseUrl, token);
    if (!info.ok) throw new Error(info.message);

    const { data: user } = await supabase.auth.getUser();
    if (!user.user) throw new Error("Nicht angemeldet");

    const { error } = await supabase.from("ha_connections").upsert(
      {
        user_id: user.user.id,
        base_url: normalizeUrl(baseUrl),
        access_token: token,
        ha_version: info.version ?? null,
        location_name: info.locationName ?? null,
        last_error: null,
      },
      { onConflict: "user_id" },
    );
    if (error) throw new Error(error.message);

    this.connection = {
      baseUrl: normalizeUrl(baseUrl),
      token,
      version: info.version,
      locationName: info.locationName,
    };
    this.cacheLocally(this.connection);
    this.patchStatus({
      baseUrl: this.connection.baseUrl,
      version: info.version ?? null,
      locationName: info.locationName ?? null,
      lastError: null,
    });
    this.connectSocket();
    return this.connection;
  }

  async forgetConnection() {
    this.disconnectSocket();
    this.connection = null;
    this.states.clear();
    if (typeof window !== "undefined") window.localStorage.removeItem(STORAGE_KEY);
    const { data: user } = await supabase.auth.getUser();
    if (user.user) await supabase.from("ha_connections").delete().eq("user_id", user.user.id);
    this.patchStatus({ rest: "unknown", websocket: "closed", baseUrl: null, version: null });
  }

  /* -------------------------------- REST -------------------------------- */

  /**
   * Führt eine REST-Anfrage aus. Zuerst direkt aus dem Browser (nötig für
   * lokale Adressen im Heimnetz), bei einem Netzwerk-/CORS-Fehler automatisch
   * über den Server der App (nötig für Nabu Casa & Co.).
   */
  private async request(
    baseUrl: string,
    token: string,
    path: string,
    method = "GET",
    body: string | null = null,
  ): Promise<{ ok: boolean; status: number; text: string; error: string | null }> {
    const url = `${normalizeUrl(baseUrl)}/api${path.startsWith("/") ? path : `/${path}`}`;

    // 1) Direkt aus dem Browser
    try {
      const response = await fetch(url, {
        method,
        mode: "cors",
        credentials: "omit",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body,
      });
      return { ok: response.ok, status: response.status, text: await response.text(), error: null };
    } catch {
      /* CORS oder Netzwerk – jetzt über den Server versuchen */
    }

    // 2) Über den Server der App (umgeht CORS bei öffentlich erreichbaren Instanzen)
    try {
      const result = await haProxy({
        data: { baseUrl: normalizeUrl(baseUrl), token, path, method, body },
      });
      return { ok: result.ok, status: result.status, text: result.body, error: result.error };
    } catch (error) {
      return {
        ok: false,
        status: 0,
        text: "",
        error: error instanceof Error ? error.message : "Verbindung fehlgeschlagen",
      };
    }
  }

  async rest<T>(path: string, init?: RequestInit): Promise<T> {
    const connection = this.connection ?? (await this.loadConnection());
    if (!connection) throw new Error("Keine Home-Assistant-Verbindung hinterlegt");

    const started = performance.now();
    const result = await this.request(
      connection.baseUrl,
      connection.token,
      path,
      init?.method ?? "GET",
      typeof init?.body === "string" ? init.body : null,
    );
    const latencyMs = Math.round(performance.now() - started);

    if (!result.ok) {
      const message = result.error ?? `Home Assistant antwortete mit HTTP ${result.status}`;
      this.patchStatus({ rest: "error", latencyMs, lastError: message });
      throw new Error(message);
    }

    this.patchStatus({ rest: "ok", latencyMs, lastError: null });
    if (!result.text) return null as T;
    try {
      return JSON.parse(result.text) as T;
    } catch {
      return result.text as unknown as T;
    }
  }

  /** Prüft Adresse und Token über GET /api/ – ohne OAuth, nur mit dem Token. */
  async testConnection(baseUrl: string, token: string) {
    const url = normalizeUrl(baseUrl);
    const started = performance.now();

    const ping = await this.request(url, token, "/");
    const latencyMs = Math.round(performance.now() - started);

    if (ping.status === 401 || ping.status === 403) {
      return { ok: false as const, message: "Token wurde abgelehnt (401).", latencyMs };
    }
    if (!ping.ok) {
      return {
        ok: false as const,
        message: ping.error
          ? `${ping.error} – Adresse nicht erreichbar (${url}).`
          : `HTTP ${ping.status} von ${url}`,
        latencyMs,
      };
    }

    // Zusatzinfos sind optional – der Test gilt bereits als bestanden.
    let version: string | null = null;
    let locationName: string | null = null;
    const config = await this.request(url, token, "/config");
    if (config.ok && config.text) {
      try {
        const parsed = JSON.parse(config.text) as { version?: string; location_name?: string };
        version = parsed.version ?? null;
        locationName = parsed.location_name ?? null;
      } catch {
        /* Konfiguration ist optional */
      }
    }

    const socketOk = await this.probeSocket(url, token);
    return {
      ok: true as const,
      message: "Verbindung erfolgreich",
      latencyMs,
      version,
      locationName,
      websocket: socketOk,
    };
  }



  /** Sucht Home Assistant automatisch im Heimnetz. */
  async discover(extraCandidates: string[] = []) {
    const candidates = [...extraCandidates, ...DISCOVERY_CANDIDATES];
    for (const candidate of candidates) {
      try {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 2500);
        const response = await fetch(`${candidate}/api/`, { signal: controller.signal }).catch(
          () => null,
        );
        clearTimeout(timer);
        // 401 = Home Assistant lebt und will nur ein Token.
        if (response && (response.ok || response.status === 401)) {
          let version: string | null = null;
          try {
            const manifest = await fetch(`${candidate}/manifest.json`).then((r) => r.json());
            version = (manifest?.version as string) ?? null;
          } catch {
            /* Version ist optional */
          }
          return { found: true as const, url: candidate, version };
        }
      } catch {
        /* nächster Kandidat */
      }
    }
    return { found: false as const, url: null, version: null };
  }

  /* ------------------------------ WebSocket ------------------------------ */

  private socketUrl(baseUrl: string) {
    return `${baseUrl.replace(/^http/i, "ws")}/api/websocket`;
  }

  private probeSocket(baseUrl: string, token: string) {
    return new Promise<boolean>((resolve) => {
      if (typeof WebSocket === "undefined") return resolve(false);
      let settled = false;
      const done = (value: boolean) => {
        if (settled) return;
        settled = true;
        try {
          socket.close();
        } catch {
          /* egal */
        }
        resolve(value);
      };
      const socket = new WebSocket(this.socketUrl(normalizeUrl(baseUrl)));
      const timer = setTimeout(() => done(false), 5000);
      socket.onmessage = (event) => {
        const message = JSON.parse(String(event.data));
        if (message.type === "auth_required") {
          socket.send(JSON.stringify({ type: "auth", access_token: token }));
        } else if (message.type === "auth_ok") {
          clearTimeout(timer);
          done(true);
        } else if (message.type === "auth_invalid") {
          clearTimeout(timer);
          done(false);
        }
      };
      socket.onerror = () => done(false);
    });
  }

  /** Baut die Live-Verbindung auf (inkl. automatischem Reconnect). */
  async connectSocket() {
    if (typeof WebSocket === "undefined") return;
    const connection = this.connection ?? (await this.loadConnection());
    if (!connection) return;
    if (this.socket && (this.socket.readyState === 0 || this.socket.readyState === 1)) return;

    this.closedByUs = false;
    this.patchStatus({ websocket: "connecting" });
    const socket = new WebSocket(this.socketUrl(connection.baseUrl));
    this.socket = socket;

    socket.onmessage = (event) => {
      const message = JSON.parse(String(event.data));
      switch (message.type) {
        case "auth_required":
          socket.send(JSON.stringify({ type: "auth", access_token: connection.token }));
          break;
        case "auth_ok":
          this.reconnectDelay = 2000;
          this.patchStatus({ websocket: "open", lastError: null });
          void this.afterAuth();
          break;
        case "auth_invalid":
          this.patchStatus({ websocket: "error", lastError: "Token ungültig" });
          break;
        case "result": {
          const entry = this.pending.get(message.id);
          if (entry) {
            this.pending.delete(message.id);
            if (message.success) entry.resolve(message.result);
            else entry.reject(new Error(message.error?.message ?? "WebSocket-Fehler"));
          }
          break;
        }
        case "event": {
          const data = message.event?.data;
          if (data?.entity_id && data.new_state) {
            this.states.set(data.entity_id, data.new_state as HaEntity);
            this.dirty.add(data.entity_id);
            this.emit();
          }
          break;
        }
      }
    };

    socket.onclose = () => {
      this.patchStatus({ websocket: "closed" });
      for (const entry of this.pending.values()) entry.reject(new Error("Verbindung getrennt"));
      this.pending.clear();
      if (!this.closedByUs) this.scheduleReconnect();
    };
    socket.onerror = () => this.patchStatus({ websocket: "error" });
  }

  private async afterAuth() {
    await this.send({ type: "subscribe_events", event_type: "state_changed" }).catch(() => null);
    await this.loadStates().catch(() => null);
    await this.loadAreas().catch(() => null);
  }

  private scheduleReconnect() {
    if (this.reconnectTimer) return;
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.reconnectDelay = Math.min(this.reconnectDelay * 2, 30_000);
      void this.connectSocket();
    }, this.reconnectDelay);
  }

  disconnectSocket() {
    this.closedByUs = true;
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.reconnectTimer = null;
    try {
      this.socket?.close();
    } catch {
      /* egal */
    }
    this.socket = null;
    this.patchStatus({ websocket: "closed" });
  }

  private send<T>(payload: Record<string, unknown>): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      if (!this.socket || this.socket.readyState !== 1) {
        reject(new Error("WebSocket ist nicht verbunden"));
        return;
      }
      const id = this.msgId++;
      this.pending.set(id, {
        resolve: (value) => resolve(value as T),
        reject,
      });
      this.socket.send(JSON.stringify({ ...payload, id }));
    });
  }

  /* ------------------------------- Daten -------------------------------- */

  async loadStates(): Promise<HaEntity[]> {
    const states = await this.rest<HaEntity[]>("/states");
    this.states = new Map(states.map((entity) => [entity.entity_id, entity]));
    this.patchStatus({ entityCount: states.length });
    return states;
  }

  /** Bereiche kommen ausschließlich über die WebSocket-API. */
  async loadAreas(): Promise<HaArea[]> {
    try {
      const areas = await this.send<HaArea[]>({ type: "config/area_registry/list" });
      this.areas = areas ?? [];
    } catch {
      this.areas = [];
    }
    return this.areas;
  }

  async entityAreaMap(): Promise<Map<string, string>> {
    const map = new Map<string, string>();
    try {
      const entities = await this.send<
        { entity_id: string; area_id: string | null; device_id: string | null }[]
      >({ type: "config/entity_registry/list" });
      const devices = await this.send<{ id: string; area_id: string | null }[]>({
        type: "config/device_registry/list",
      });
      const deviceArea = new Map(devices.map((d) => [d.id, d.area_id]));
      for (const entity of entities) {
        const areaId = entity.area_id ?? (entity.device_id ? deviceArea.get(entity.device_id) : null);
        if (areaId) map.set(entity.entity_id, areaId);
      }
      this.patchStatus({ deviceCount: devices.length });
    } catch {
      /* ohne Registry bleiben Geräte ohne Raum */
    }
    return map;
  }

  /* ---------------------------- Gerätesteuerung -------------------------- */

  async callService(domain: string, service: string, data: Record<string, unknown>) {
    return this.rest(`/services/${domain}/${service}`, {
      method: "POST",
      body: JSON.stringify(data),
    });
  }

  async turnOn(entityId: string, extra: Record<string, unknown> = {}) {
    return this.callService(domainOf(entityId), "turn_on", { entity_id: entityId, ...extra });
  }

  async turnOff(entityId: string) {
    return this.callService(domainOf(entityId), "turn_off", { entity_id: entityId });
  }

  async setBrightness(entityId: string, percent: number) {
    return this.callService("light", "turn_on", {
      entity_id: entityId,
      brightness_pct: Math.max(0, Math.min(100, Math.round(percent))),
    });
  }

  async setTemperature(entityId: string, temperature: number) {
    return this.callService("climate", "set_temperature", { entity_id: entityId, temperature });
  }

  async setHvacMode(entityId: string, mode: string) {
    return this.callService("climate", "set_hvac_mode", { entity_id: entityId, hvac_mode: mode });
  }

  async setCover(entityId: string, open: boolean) {
    return this.callService("cover", open ? "open_cover" : "close_cover", { entity_id: entityId });
  }

  async setVolume(entityId: string, level: number) {
    return this.callService("media_player", "volume_set", {
      entity_id: entityId,
      volume_level: Math.max(0, Math.min(1, level)),
    });
  }

  async vacuumCommand(entityId: string, command: "start" | "pause" | "return_to_base" | "stop") {
    return this.callService("vacuum", command, { entity_id: entityId });
  }

  /** Ein einziger Einstieg für die bestehende Geräteoberfläche. */
  async control(entityId: string, patch: { on?: boolean; brightness?: number }) {
    const domain = domainOf(entityId);
    if (patch.brightness !== undefined && domain === "light") {
      if (patch.on === false) return this.turnOff(entityId);
      return this.setBrightness(entityId, patch.brightness);
    }
    if (patch.on === undefined) return null;
    if (domain === "cover") return this.setCover(entityId, patch.on);
    if (domain === "vacuum") return this.vacuumCommand(entityId, patch.on ? "start" : "return_to_base");
    return patch.on ? this.turnOn(entityId) : this.turnOff(entityId);
  }

  /* ---------------------------- Live-Übernahme --------------------------- */

  /**
   * Schreibt die per WebSocket gemeldeten Zustandsänderungen in die
   * Gerätetabelle der App. Gibt die Anzahl aktualisierter Geräte zurück.
   */
  async flushLiveStates(): Promise<number> {
    if (!this.dirty.size) return 0;
    const entityIds = [...this.dirty];
    this.dirty.clear();

    const { data: user } = await supabase.auth.getUser();
    if (!user.user) return 0;

    const { data: rows } = await supabase
      .from("devices")
      .select("id, external_id")
      .eq("user_id", user.user.id)
      .eq("external_source", "homeassistant")
      .in("external_id", entityIds);

    let changed = 0;
    for (const row of rows ?? []) {
      const entity = row.external_id ? this.states.get(row.external_id) : undefined;
      if (!entity) continue;
      const patch = entityToDeviceRow(entity, null);
      if (!patch) continue;
      const { room_id: _ignored, name: _name, ...rest } = patch;
      const { error } = await supabase.from("devices").update(rest).eq("id", row.id);
      if (!error) changed += 1;
    }
    return changed;
  }

  /* ------------------------------ Abgleich ------------------------------- */


  /** Holt Entitäten und Bereiche und schreibt sie in Räume/Geräte der App. */
  async sync() {
    const started = performance.now();
    const { data: user } = await supabase.auth.getUser();
    if (!user.user) throw new Error("Nicht angemeldet");
    const userId = user.user.id;

    const states = await this.loadStates();
    if (this.status.websocket !== "open") await this.connectSocket();
    await new Promise((resolve) => setTimeout(resolve, 400));
    const areas = await this.loadAreas();
    const entityArea = await this.entityAreaMap();

    /* Räume aus Home-Assistant-Bereichen übernehmen */
    const roomIdByArea = new Map<string, string>();
    let roomsImported = 0;
    for (const [index, area] of areas.entries()) {
      const { data: existing } = await supabase
        .from("rooms")
        .select("id")
        .eq("user_id", userId)
        .eq("name", area.name)
        .maybeSingle();
      let roomId = existing?.id ?? null;
      if (!roomId) {
        const { data: created, error } = await supabase
          .from("rooms")
          .insert({ user_id: userId, name: area.name, icon: "sofa", sort_order: index })
          .select("id")
          .single();
        if (error) throw new Error(error.message);
        roomId = created.id;
        roomsImported += 1;
      }
      roomIdByArea.set(area.area_id, roomId);
    }

    /* Entitäten als Geräte übernehmen */
    let created = 0;
    let updated = 0;
    let skipped = 0;
    const relevant = states.filter((entity) =>
      (SUPPORTED_DOMAINS as readonly string[]).includes(domainOf(entity.entity_id)),
    );

    for (const entity of relevant) {
      const domain = domainOf(entity.entity_id);
      const areaId = entityArea.get(entity.entity_id);
      const roomId = areaId ? (roomIdByArea.get(areaId) ?? null) : null;
      const row = entityToDeviceRow(entity, roomId);
      if (!row) {
        skipped += 1;
        continue;
      }

      const { data: existing } = await supabase
        .from("devices")
        .select("id")
        .eq("user_id", userId)
        .eq("external_source", "homeassistant")
        .eq("external_id", entity.entity_id)
        .maybeSingle();

      if (existing) {
        const { error } = await supabase.from("devices").update(row).eq("id", existing.id);
        if (error) throw new Error(error.message);
        updated += 1;
      } else {
        const { error } = await supabase.from("devices").insert({
          ...row,
          user_id: userId,
          external_source: "homeassistant",
          external_id: entity.entity_id,
          model: domain,
        });
        if (error) throw new Error(error.message);
        created += 1;
      }
    }

    const lastSyncAt = new Date().toISOString();
    await supabase
      .from("ha_connections")
      .update({ last_sync_at: lastSyncAt, entity_count: states.length, last_error: null })
      .eq("user_id", userId);

    this.patchStatus({ lastSyncAt, entityCount: states.length });

    return {
      ok: true,
      entities: states.length,
      imported: relevant.length,
      created,
      updated,
      skipped,
      rooms: areas.length,
      roomsImported,
      durationMs: Math.round(performance.now() - started),
    };
  }
}

/** Wandelt eine Entität in eine Zeile der bestehenden `devices`-Tabelle. */
export function entityToDeviceRow(entity: HaEntity, roomId: string | null) {
  const domain = domainOf(entity.entity_id);
  const attributes = entity.attributes ?? {};
  const name =
    (attributes["friendly_name"] as string | undefined) ?? entity.entity_id.split(".")[1] ?? entity.entity_id;
  const unavailable = entity.state === "unavailable" || entity.state === "unknown";

  const kind = kindForDomain(domain);
  if (!kind) return null;

  const brightnessRaw = attributes["brightness"] as number | undefined;
  const numericState = Number(entity.state);

  return {
    name,
    kind,
    room_id: roomId,
    is_on: ["on", "open", "playing", "cleaning", "home", "heat", "cool", "auto"].includes(entity.state),
    brightness:
      brightnessRaw !== undefined
        ? Math.round((brightnessRaw / 255) * 100)
        : (attributes["volume_level"] as number | undefined) !== undefined
          ? Math.round(((attributes["volume_level"] as number) ?? 0) * 100)
          : 100,
    is_online: !unavailable,
    sensor_value:
      Number.isFinite(numericState) && entity.state !== ""
        ? numericState
        : ((attributes["current_temperature"] as number | undefined) ?? null),
    sensor_unit:
      (attributes["unit_of_measurement"] as string | undefined) ??
      (domain === "climate" ? "°C" : null),
    target_value: (attributes["temperature"] as number | undefined) ?? null,
    manufacturer: "Home Assistant",
  };
}

export function kindForDomain(domain: string) {
  switch (domain) {
    case "light":
      return "light" as const;
    case "switch":
    case "fan":
    case "automation":
    case "scene":
    case "lock":
      return "plug" as const;
    case "climate":
      return "thermostat" as const;
    case "cover":
      return "blind" as const;
    case "media_player":
      return "speaker" as const;
    case "vacuum":
      return "vacuum" as const;
    case "sensor":
    case "binary_sensor":
    case "camera":
    case "weather":
    case "person":
      return "sensor" as const;
    default:
      return null;
  }
}

export const homeAssistant = new HomeAssistantService();
