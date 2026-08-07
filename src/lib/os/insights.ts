/**
 * Smart Home Hub OS – Analyse-Schicht.
 *
 * Reine Auswertungsfunktionen auf Basis der Home-Assistant-Zustände.
 * Es werden ausschließlich vorhandene Daten gelesen (keine neuen API-Aufrufe,
 * keine Backend-Änderungen).
 */
import { domainOf, type HaEntity, type HaStatus } from "@/services/homeAssistant";

export type Severity = "ok" | "info" | "warn" | "critical";

export type Check = {
  id: string;
  label: string;
  detail: string;
  severity: Severity;
  entities?: string[];
};

export type Hint = {
  id: string;
  title: string;
  detail: string;
  severity: Severity;
  category: "sicherheit" | "energie" | "komfort" | "wartung" | "geraete";
  entityId?: string;
};

export const UNAVAILABLE = new Set(["unavailable", "unknown", "none", ""]);

export function friendlyName(entity: HaEntity) {
  return (
    (entity.attributes?.["friendly_name"] as string | undefined) ??
    entity.entity_id.split(".")[1]?.replace(/_/g, " ") ??
    entity.entity_id
  );
}

export function deviceClassOf(entity: HaEntity) {
  return String(entity.attributes?.["device_class"] ?? "").toLowerCase();
}

export function isAvailable(entity: HaEntity) {
  return !UNAVAILABLE.has(entity.state.toLowerCase());
}

export function numericState(entity: HaEntity): number | null {
  const value = Number(entity.state);
  return Number.isFinite(value) ? value : null;
}

export function unitOf(entity: HaEntity) {
  return (entity.attributes?.["unit_of_measurement"] as string | undefined) ?? "";
}

/** Minuten seit der letzten Zustandsänderung. */
export function minutesSince(entity: HaEntity) {
  const stamp = entity.last_changed ?? entity.last_updated;
  if (!stamp) return null;
  const diff = Date.now() - new Date(stamp).getTime();
  return Number.isFinite(diff) ? Math.max(0, Math.round(diff / 60_000)) : null;
}

export function formatDuration(minutes: number) {
  if (minutes < 60) return `${minutes} Min.`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} Std.`;
  return `${Math.floor(hours / 24)} Tage`;
}

/* ------------------------------ Gruppierungen ----------------------------- */

const OPEN_CLASSES = new Set(["door", "garage_door", "window", "opening"]);

export function selectBinary(entities: HaEntity[], classes: string[]) {
  const wanted = new Set(classes);
  return entities.filter(
    (entity) => domainOf(entity.entity_id) === "binary_sensor" && wanted.has(deviceClassOf(entity)),
  );
}

export function selectSensors(entities: HaEntity[], deviceClass: string) {
  return entities.filter(
    (entity) => domainOf(entity.entity_id) === "sensor" && deviceClassOf(entity) === deviceClass,
  );
}

export function batterySensors(entities: HaEntity[]) {
  return selectSensors(entities, "battery");
}

export function openings(entities: HaEntity[]) {
  return entities.filter(
    (entity) =>
      domainOf(entity.entity_id) === "binary_sensor" && OPEN_CLASSES.has(deviceClassOf(entity)),
  );
}

export function personsHome(entities: HaEntity[]) {
  return entities.filter(
    (entity) => domainOf(entity.entity_id) === "person" && entity.state === "home",
  );
}

export function lightsOn(entities: HaEntity[]) {
  return entities.filter(
    (entity) => domainOf(entity.entity_id) === "light" && entity.state === "on",
  );
}

/* ------------------------------- Hausstatus ------------------------------- */

export function houseChecks(entities: HaEntity[], status: HaStatus): Check[] {
  const checks: Check[] = [];

  const doors = openings(entities).filter((e) =>
    ["door", "garage_door"].includes(deviceClassOf(e)),
  );
  const windows = openings(entities).filter((e) =>
    ["window", "opening"].includes(deviceClassOf(e)),
  );
  const openDoors = doors.filter((e) => e.state === "on");
  const openWindows = windows.filter((e) => e.state === "on");

  checks.push({
    id: "doors",
    label: "Türen",
    severity: openDoors.length ? "warn" : "ok",
    detail: doors.length
      ? openDoors.length
        ? `${openDoors.length} offen: ${openDoors.map(friendlyName).join(", ")}`
        : "Alle Türen geschlossen"
      : "Keine Türsensoren vorhanden",
    entities: openDoors.map((e) => e.entity_id),
  });

  checks.push({
    id: "windows",
    label: "Fenster",
    severity: openWindows.length ? "warn" : "ok",
    detail: windows.length
      ? openWindows.length
        ? `${openWindows.length} offen: ${openWindows.map(friendlyName).join(", ")}`
        : "Alle Fenster geschlossen"
      : "Keine Fenstersensoren vorhanden",
    entities: openWindows.map((e) => e.entity_id),
  });

  const alarms = entities.filter((e) => domainOf(e.entity_id) === "alarm_control_panel");
  const armed = alarms.filter((e) => e.state.startsWith("armed"));
  const triggered = alarms.filter((e) => e.state === "triggered");
  checks.push({
    id: "alarm",
    label: "Alarmanlage",
    severity: triggered.length ? "critical" : "ok",
    detail: alarms.length
      ? triggered.length
        ? "Alarm ausgelöst!"
        : armed.length
          ? `${armed.length} scharf geschaltet`
          : "Deaktiviert"
      : "Keine Alarmanlage eingebunden",
  });

  checks.push({
    id: "ha",
    label: "Home Assistant",
    severity: status.websocket === "open" ? "ok" : "critical",
    detail:
      status.websocket === "open"
        ? `Online${status.version ? ` · Version ${status.version}` : ""}`
        : (status.lastError ?? "Keine Live-Verbindung"),
  });

  checks.push({
    id: "network",
    label: "Verbindung",
    severity: status.rest === "ok" ? "ok" : status.rest === "unknown" ? "info" : "warn",
    detail:
      status.rest === "ok"
        ? `Erreichbar${status.latencyMs != null ? ` · ${status.latencyMs} ms` : ""}`
        : status.rest === "unknown"
          ? "Noch nicht geprüft"
          : "Instanz nicht erreichbar",
  });

  const cameras = entities.filter((e) => domainOf(e.entity_id) === "camera");
  const camerasOffline = cameras.filter((e) => !isAvailable(e));
  checks.push({
    id: "cameras",
    label: "Kameras",
    severity: camerasOffline.length ? "warn" : "ok",
    detail: cameras.length
      ? camerasOffline.length
        ? `${camerasOffline.length} von ${cameras.length} nicht erreichbar`
        : `${cameras.length} online`
      : "Keine Kameras eingebunden",
    entities: camerasOffline.map((e) => e.entity_id),
  });

  const lowBattery = batterySensors(entities).filter((e) => (numericState(e) ?? 100) <= 20);
  checks.push({
    id: "battery",
    label: "Batterien",
    severity: lowBattery.length ? "warn" : "ok",
    detail: lowBattery.length
      ? `${lowBattery.length} niedrig: ${lowBattery.map(friendlyName).slice(0, 3).join(", ")}`
      : "Alle Batteriewerte in Ordnung",
    entities: lowBattery.map((e) => e.entity_id),
  });

  const unavailable = entities.filter(
    (e) => !isAvailable(e) && !["camera", "person"].includes(domainOf(e.entity_id)),
  );
  checks.push({
    id: "offline",
    label: "Geräte",
    severity: unavailable.length ? "warn" : "ok",
    detail: unavailable.length
      ? `${unavailable.length} Entitäten nicht erreichbar`
      : "Alle Geräte erreichbar",
    entities: unavailable.slice(0, 20).map((e) => e.entity_id),
  });

  const climateProblem = entities.filter(
    (e) => domainOf(e.entity_id) === "climate" && !isAvailable(e),
  );
  if (entities.some((e) => domainOf(e.entity_id) === "climate")) {
    checks.push({
      id: "climate",
      label: "Heizung",
      severity: climateProblem.length ? "warn" : "ok",
      detail: climateProblem.length
        ? `${climateProblem.length} Thermostate melden einen Fehler`
        : "Alle Thermostate arbeiten normal",
      entities: climateProblem.map((e) => e.entity_id),
    });
  }

  return checks;
}

export function overallSeverity(checks: Check[]): Severity {
  if (checks.some((c) => c.severity === "critical")) return "critical";
  if (checks.some((c) => c.severity === "warn")) return "warn";
  if (checks.some((c) => c.severity === "info")) return "info";
  return "ok";
}

export function statusHeadline(severity: Severity) {
  if (severity === "critical") return "Achtung erforderlich";
  if (severity === "warn") return "Kleinigkeiten offen";
  if (severity === "info") return "Zuhause wird geprüft";
  return "Zuhause sicher";
}

/* ------------------------------- Assistent -------------------------------- */

export type AssistantContext = {
  entities: HaEntity[];
  status: HaStatus;
  /** Optional: Regenwahrscheinlichkeit der nächsten Stunden in Prozent. */
  rainChance?: number | null;
  now?: Date;
};

export function assistantHints({
  entities,
  status,
  rainChance = null,
  now = new Date(),
}: AssistantContext): Hint[] {
  const hints: Hint[] = [];
  const somebodyHome = personsHome(entities).length > 0;
  const persons = entities.filter((e) => domainOf(e.entity_id) === "person");
  const hour = now.getHours();

  // Licht sehr lange an
  for (const light of lightsOn(entities)) {
    const minutes = minutesSince(light);
    if (minutes != null && minutes >= 240) {
      hints.push({
        id: `light-long-${light.entity_id}`,
        title: `${friendlyName(light)} ist seit ${formatDuration(minutes)} eingeschaltet`,
        detail: "Falls der Raum nicht genutzt wird, kannst du das Licht ausschalten.",
        severity: "info",
        category: "energie",
        entityId: light.entity_id,
      });
    }
  }

  // Niemand zuhause, aber Licht an
  if (persons.length > 0 && !somebodyHome) {
    const on = lightsOn(entities);
    if (on.length) {
      hints.push({
        id: "away-lights",
        title: `Niemand zuhause – ${on.length} Lichter sind an`,
        detail: on.map(friendlyName).slice(0, 4).join(", "),
        severity: "warn",
        category: "energie",
      });
    }
  }

  // Waschmaschine / Trockner fertig
  for (const entity of entities) {
    const name = friendlyName(entity).toLowerCase();
    const isLaundry = /wasch|trockn|washer|dryer|spülmaschine|dishwasher|geschirrspüler/.test(name);
    if (!isLaundry) continue;
    const state = entity.state.toLowerCase();
    if (["finished", "complete", "done", "fertig", "off", "standby"].includes(state)) {
      const minutes = minutesSince(entity);
      if (
        minutes != null &&
        minutes <= 180 &&
        ["finished", "complete", "done", "fertig"].includes(state)
      ) {
        hints.push({
          id: `laundry-${entity.entity_id}`,
          title: `${friendlyName(entity)} ist fertig`,
          detail: `Programm vor ${formatDuration(minutes)} beendet.`,
          severity: "info",
          category: "komfort",
          entityId: entity.entity_id,
        });
      }
    }
  }

  // Fenster offen und Regen erwartet / kalt
  const openWindows = openings(entities).filter(
    (e) => e.state === "on" && ["window", "opening"].includes(deviceClassOf(e)),
  );
  if (openWindows.length && rainChance != null && rainChance >= 50) {
    hints.push({
      id: "rain-windows",
      title: `${openWindows.length} Fenster offen – Regen erwartet`,
      detail: `${openWindows.map(friendlyName).join(", ")} · ${rainChance}% Regenwahrscheinlichkeit.`,
      severity: "warn",
      category: "sicherheit",
    });
  } else if (openWindows.length && (hour >= 22 || hour <= 5)) {
    hints.push({
      id: "night-windows",
      title: `${openWindows.length} Fenster sind nachts geöffnet`,
      detail: openWindows.map(friendlyName).join(", "),
      severity: "info",
      category: "sicherheit",
    });
  }

  // Batterien
  for (const battery of batterySensors(entities)) {
    const value = numericState(battery);
    if (value != null && value <= 20) {
      hints.push({
        id: `battery-${battery.entity_id}`,
        title: `${friendlyName(battery)}: Batterie bei ${value}%`,
        detail: "Batterie bald wechseln, damit der Sensor weiter meldet.",
        severity: value <= 10 ? "warn" : "info",
        category: "wartung",
        entityId: battery.entity_id,
      });
    }
  }

  // Nicht erreichbare Geräte
  const unavailable = entities.filter(
    (e) =>
      !isAvailable(e) &&
      ["light", "switch", "climate", "cover", "camera"].includes(domainOf(e.entity_id)),
  );
  if (unavailable.length) {
    hints.push({
      id: "unavailable",
      title: `${unavailable.length} Geräte antworten nicht`,
      detail: unavailable.map(friendlyName).slice(0, 4).join(", "),
      severity: "warn",
      category: "geraete",
    });
  }

  // Neue Geräte seit dem letzten Abgleich
  if (status.lastSyncAt) {
    const since = new Date(status.lastSyncAt).getTime();
    const fresh = entities.filter((e) => {
      const stamp = e.last_updated ?? e.last_changed;
      return stamp ? new Date(stamp).getTime() > since : false;
    });
    if (fresh.length > 25) {
      hints.push({
        id: "fresh",
        title: `${fresh.length} Entitäten haben sich seit dem letzten Abgleich gemeldet`,
        detail: "Die Live-Verbindung liefert Daten – alles aktuell.",
        severity: "ok",
        category: "geraete",
      });
    }
  }

  // Verbindung
  if (status.websocket !== "open") {
    hints.unshift({
      id: "ha-offline",
      title: "Keine Live-Verbindung zu Home Assistant",
      detail: status.lastError ?? "Die App zeigt zwischengespeicherte Werte.",
      severity: "critical",
      category: "geraete",
    });
  }

  const rank: Record<Severity, number> = { critical: 0, warn: 1, info: 2, ok: 3 };
  return hints.sort((a, b) => rank[a.severity] - rank[b.severity]).slice(0, 12);
}

/* ---------------------------- Gerätegesundheit ---------------------------- */

export type Health = {
  entityId: string;
  name: string;
  domain: string;
  online: boolean;
  battery: number | null;
  signal: number | null;
  signalUnit: string;
  firmware: string | null;
  lastChangedMinutes: number | null;
  score: number;
  issues: string[];
};

/** Sucht passende Diagnose-Sensoren anhand des gemeinsamen Namenspräfix. */
function relatedSensor(entities: HaEntity[], entityId: string, deviceClass: string) {
  const slug = entityId.split(".")[1] ?? "";
  const base = slug.split("_").slice(0, 3).join("_");
  return entities.find(
    (e) =>
      domainOf(e.entity_id) === "sensor" &&
      deviceClassOf(e) === deviceClass &&
      (e.entity_id.includes(base) ||
        (base.length > 4 && base.includes(e.entity_id.split(".")[1]?.split("_")[0] ?? "@"))),
  );
}

export function deviceHealth(entities: HaEntity[], targets: HaEntity[]): Health[] {
  return targets.map((entity) => {
    const issues: string[] = [];
    const online = isAvailable(entity);
    if (!online) issues.push("nicht erreichbar");

    const batteryAttr = entity.attributes?.["battery_level"];
    const batterySensor = relatedSensor(entities, entity.entity_id, "battery");
    const battery =
      typeof batteryAttr === "number"
        ? batteryAttr
        : batterySensor
          ? numericState(batterySensor)
          : null;
    if (battery != null && battery <= 20) issues.push(`Batterie ${battery}%`);

    const signalSensor = relatedSensor(entities, entity.entity_id, "signal_strength");
    const signal = signalSensor ? numericState(signalSensor) : null;
    if (signal != null && signal <= -80) issues.push("schwaches Signal");

    const firmware =
      (entity.attributes?.["sw_version"] as string | undefined) ??
      (entity.attributes?.["firmware"] as string | undefined) ??
      null;

    let score = 100;
    if (!online) score -= 60;
    if (battery != null && battery <= 20) score -= 20;
    if (battery != null && battery <= 10) score -= 10;
    if (signal != null && signal <= -80) score -= 15;

    return {
      entityId: entity.entity_id,
      name: friendlyName(entity),
      domain: domainOf(entity.entity_id),
      online,
      battery,
      signal,
      signalUnit: signalSensor ? unitOf(signalSensor) : "dBm",
      firmware,
      lastChangedMinutes: minutesSince(entity),
      score: Math.max(0, score),
      issues,
    };
  });
}

/* --------------------------------- Energie -------------------------------- */

export type EnergySummary = {
  power: { entity: HaEntity; value: number; unit: string }[];
  totalPower: number;
  today: { entity: HaEntity; value: number; unit: string }[];
  totalToday: number;
  energySensors: HaEntity[];
  hasData: boolean;
};

export function energySummary(entities: HaEntity[]): EnergySummary {
  const powerSensors = selectSensors(entities, "power").filter((e) => numericState(e) != null);
  const energySensors = selectSensors(entities, "energy").filter((e) => numericState(e) != null);

  const power = powerSensors
    .map((entity) => ({ entity, value: numericState(entity) ?? 0, unit: unitOf(entity) || "W" }))
    .sort((a, b) => b.value - a.value);

  const today = energySensors
    .filter((e) => /today|heute|daily/i.test(e.entity_id + friendlyName(e)))
    .map((entity) => ({ entity, value: numericState(entity) ?? 0, unit: unitOf(entity) || "kWh" }))
    .sort((a, b) => b.value - a.value);

  return {
    power,
    totalPower: power.reduce((sum, item) => sum + item.value, 0),
    today,
    totalToday: today.reduce((sum, item) => sum + item.value, 0),
    energySensors,
    hasData: power.length > 0 || energySensors.length > 0,
  };
}
