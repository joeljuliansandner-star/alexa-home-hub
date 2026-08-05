/**
 * Version 5.0 – lokaler Telemetrie-Speicher.
 *
 * Sammelt im Browser (localStorage) eine kompakte Historie der
 * Home-Assistant-Zustände: Zustandswechsel, Erreichbarkeit, Batterieverlauf,
 * Nutzungshäufigkeit und Tagesenergie. Daraus entstehen Muster, Trends und
 * Empfehlungen – vollständig lokal, ohne Backend, ohne externe Dienste und
 * ohne zusätzliche API-Aufrufe (es werden nur bereits vorhandene
 * WebSocket-Daten ausgewertet).
 */
import { useEffect } from "react";

import { domainOf, homeAssistant, type HaEntity } from "@/services/homeAssistant";

const STORAGE_KEY = "os.telemetry.v1";
const MAX_EVENTS = 24;
const MAX_BATTERY_POINTS = 30;
const MAX_DAYS = 62;

export type EntityTelemetry = {
  /** Anzahl beobachteter Zustandswechsel. */
  changes: number;
  /** Zeitpunkt der letzten Beobachtung. */
  lastSeen: number;
  /** Stichproben insgesamt bzw. davon erreichbar (für die Online-Quote). */
  samples: number;
  onlineSamples: number;
  /** Anzahl beobachteter Ausfälle und Zeitpunkt des letzten Ausfalls. */
  outages: number;
  lastOutageAt: number | null;
  /** Letzte Zustandswechsel: Zeitstempel + Zustand. */
  events: { t: number; s: string }[];
  /** Batterieverlauf: Zeitstempel + Prozent. */
  battery: { t: number; v: number }[];
  /** Manuelle Nutzung in der App (Suche, Öffnen, Schalten). */
  uses: number;
  lastUseAt: number | null;
};

export type DayTelemetry = {
  /** Höchster beobachteter Wert der „Energie heute"-Sensoren in kWh. */
  energy: number | null;
  /** Summe der Leistungsstichproben und Anzahl (für den Tagesmittelwert). */
  powerSum: number;
  powerCount: number;
  /** Zustandswechsel des Tages – ein Maß für Aktivität im Haus. */
  changes: number;
};

export type TelemetrySnapshot = {
  entities: Record<string, EntityTelemetry>;
  days: Record<string, DayTelemetry>;
  startedAt: number;
};

const empty: TelemetrySnapshot = { entities: {}, days: {}, startedAt: Date.now() };

function emptyEntity(now: number): EntityTelemetry {
  return {
    changes: 0,
    lastSeen: now,
    samples: 0,
    onlineSamples: 0,
    outages: 0,
    lastOutageAt: null,
    events: [],
    battery: [],
    uses: 0,
    lastUseAt: null,
  };
}

export function dayKey(date: Date | number = new Date()) {
  const value = typeof date === "number" ? new Date(date) : date;
  return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, "0")}-${String(
    value.getDate(),
  ).padStart(2, "0")}`;
}

class TelemetryStore {
  private data: TelemetrySnapshot | null = null;
  private lastStates = new Map<string, string>();
  private listeners = new Set<() => void>();
  private version = 0;
  private saveTimer: ReturnType<typeof setTimeout> | null = null;

  get snapshot(): TelemetrySnapshot {
    if (this.data) return this.data;
    if (typeof window === "undefined") return empty;
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      this.data = raw ? (JSON.parse(raw) as TelemetrySnapshot) : { ...empty, startedAt: Date.now() };
    } catch {
      this.data = { ...empty, startedAt: Date.now() };
    }
    this.data.entities ??= {};
    this.data.days ??= {};
    this.data.startedAt ??= Date.now();
    return this.data;
  }

  get revision() {
    return this.version;
  }

  subscribe(listener: () => void) {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notify() {
    this.version += 1;
    this.listeners.forEach((listener) => listener());
  }

  private save() {
    if (typeof window === "undefined") return;
    if (this.saveTimer) clearTimeout(this.saveTimer);
    this.saveTimer = setTimeout(() => {
      try {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(this.snapshot));
      } catch {
        /* Speicher voll – Telemetrie bleibt für die Sitzung im Arbeitsspeicher */
      }
    }, 1500);
  }

  entity(entityId: string): EntityTelemetry | null {
    return this.snapshot.entities[entityId] ?? null;
  }

  /** Merkt sich, dass der Nutzer eine Entität aktiv verwendet hat. */
  recordUse(entityId: string) {
    const now = Date.now();
    const store = this.snapshot;
    const record = (store.entities[entityId] ??= emptyEntity(now));
    record.uses += 1;
    record.lastUseAt = now;
    this.save();
    this.notify();
  }

  /** Wertet eine Momentaufnahme aller Entitäten aus. */
  record(entities: HaEntity[]) {
    if (!entities.length) return;
    const now = Date.now();
    const store = this.snapshot;
    const today = (store.days[dayKey(now)] ??= {
      energy: null,
      powerSum: 0,
      powerCount: 0,
      changes: 0,
    });

    let powerSum = 0;
    let powerSeen = false;
    let energyToday: number | null = null;

    for (const entity of entities) {
      const id = entity.entity_id;
      const state = entity.state;
      const record = (store.entities[id] ??= emptyEntity(now));
      const available = !["unavailable", "unknown", ""].includes(state.toLowerCase());

      record.samples += 1;
      if (available) record.onlineSamples += 1;
      record.lastSeen = now;

      const previous = this.lastStates.get(id);
      if (previous !== undefined && previous !== state) {
        record.changes += 1;
        today.changes += 1;
        record.events.push({ t: now, s: state });
        if (record.events.length > MAX_EVENTS) record.events.splice(0, record.events.length - MAX_EVENTS);
        const wasAvailable = !["unavailable", "unknown", ""].includes(previous.toLowerCase());
        if (wasAvailable && !available) {
          record.outages += 1;
          record.lastOutageAt = now;
        }
      }
      this.lastStates.set(id, state);

      const deviceClass = String(entity.attributes?.["device_class"] ?? "").toLowerCase();
      const numeric = Number(state);
      if (Number.isFinite(numeric)) {
        if (deviceClass === "battery") {
          const last = record.battery[record.battery.length - 1];
          if (!last || last.v !== numeric || now - last.t > 6 * 3600_000) {
            record.battery.push({ t: now, v: numeric });
            if (record.battery.length > MAX_BATTERY_POINTS) record.battery.shift();
          }
        }
        if (deviceClass === "power" && domainOf(id) === "sensor") {
          powerSum += numeric;
          powerSeen = true;
        }
        if (
          deviceClass === "energy" &&
          /today|heute|daily|tag/i.test(id + String(entity.attributes?.["friendly_name"] ?? ""))
        ) {
          energyToday = (energyToday ?? 0) + numeric;
        }
      }
    }

    if (powerSeen) {
      today.powerSum += powerSum;
      today.powerCount += 1;
    }
    if (energyToday != null) {
      today.energy = Math.max(today.energy ?? 0, energyToday);
    }

    // Alte Tage abräumen, damit der Speicher klein bleibt.
    const keys = Object.keys(store.days).sort();
    if (keys.length > MAX_DAYS) {
      for (const key of keys.slice(0, keys.length - MAX_DAYS)) delete store.days[key];
    }

    this.save();
    this.notify();
  }

  reset() {
    this.data = { entities: {}, days: {}, startedAt: Date.now() };
    this.lastStates.clear();
    if (typeof window !== "undefined") {
      try {
        window.localStorage.removeItem(STORAGE_KEY);
      } catch {
        /* ignorieren */
      }
    }
    this.notify();
  }
}

export const telemetry = new TelemetryStore();

/**
 * Zeichnet die Live-Zustände regelmäßig auf. Wird einmal im Layout
 * eingebunden – es entstehen dabei keine zusätzlichen API-Aufrufe, da nur der
 * bereits vorhandene WebSocket-Cache gelesen wird.
 */
export function useTelemetryRecorder(intervalMs = 20_000) {
  useEffect(() => {
    const tick = () => telemetry.record([...homeAssistant.states.values()]);
    tick();
    const timer = setInterval(tick, intervalMs);
    return () => clearInterval(timer);
  }, [intervalMs]);
}
