/**
 * Version 5.0 – Smart Intelligence.
 *
 * Alle Auswertungen laufen lokal im Browser auf Basis der vorhandenen
 * Home-Assistant-Daten (Live-Zustände, Attribute, Registry) und der lokalen
 * Telemetrie. Es werden keine externen Dienste und keine zusätzlichen
 * API-Aufrufe verwendet.
 */
import { domainOf, type HaEntity, type HaStatus } from "@/services/homeAssistant";
import {
  assistantHints,
  batterySensors,
  deviceClassOf,
  deviceHealth,
  energySummary,
  formatDuration,
  friendlyName,
  isAvailable,
  lightsOn,
  minutesSince,
  numericState,
  openings,
  personsHome,
  selectSensors,
  unitOf,
  type Health,
  type Hint,
  type Severity,
} from "./insights";
import { dayKey, telemetry, type TelemetrySnapshot } from "./telemetry";

export type InsightCategory =
  | "sicherheit"
  | "energie"
  | "komfort"
  | "wartung"
  | "geraete"
  | "automationen";

export type Insight = {
  id: string;
  title: string;
  detail: string;
  severity: Severity;
  category: InsightCategory;
  /** 0–100, je höher desto wichtiger. */
  priority: number;
  entityId?: string;
  action?: { label: string; to: string };
};

const severityWeight: Record<Severity, number> = { critical: 90, warn: 65, info: 35, ok: 10 };

function mapHintCategory(hint: Hint): InsightCategory {
  return hint.category;
}

/* ------------------------------ Smart Insights ---------------------------- */

export type InsightContext = {
  entities: HaEntity[];
  status: HaStatus;
  rainChance?: number | null;
  snapshot?: TelemetrySnapshot;
  now?: Date;
};

/**
 * Erzeugt priorisierte Hinweise aus Zuständen, Sensoren, Batterien, Historie,
 * Anwesenheit, Wetter, Energie und Automationen.
 */
export function smartInsights({
  entities,
  status,
  rainChance = null,
  snapshot = telemetry.snapshot,
  now = new Date(),
}: InsightContext): Insight[] {
  const list: Insight[] = [];

  // 1. Bestehende Assistenz-Hinweise übernehmen (Version 4.0 bleibt erhalten).
  for (const hint of assistantHints({ entities, status, rainChance, now })) {
    list.push({
      id: hint.id,
      title: hint.title,
      detail: hint.detail,
      severity: hint.severity,
      category: mapHintCategory(hint),
      priority: severityWeight[hint.severity],
      ...(hint.entityId ? { entityId: hint.entityId } : {}),
    });
  }

  // 2. Automationen, die lange nicht ausgelöst wurden.
  for (const automation of entities.filter((e) => domainOf(e.entity_id) === "automation")) {
    const last = automation.attributes?.["last_triggered"] as string | null | undefined;
    if (automation.state === "off") {
      list.push({
        id: `automation-off-${automation.entity_id}`,
        title: `Automation „${friendlyName(automation)}" ist deaktiviert`,
        detail: "Sie wird derzeit nicht ausgeführt.",
        severity: "info",
        category: "automationen",
        priority: 32,
        entityId: automation.entity_id,
        action: { label: "Automationen", to: "/automations" },
      });
      continue;
    }
    if (!last) continue;
    const days = Math.floor((now.getTime() - new Date(last).getTime()) / 86_400_000);
    if (Number.isFinite(days) && days >= 30) {
      list.push({
        id: `automation-stale-${automation.entity_id}`,
        title: `„${friendlyName(automation)}" wurde seit ${days} Tagen nicht ausgelöst`,
        detail: "Prüfe, ob die Bedingungen noch passen oder die Regel entfernt werden kann.",
        severity: "info",
        category: "automationen",
        priority: 38,
        entityId: automation.entity_id,
        action: { label: "Automationen", to: "/automations" },
      });
    }
  }

  // 3. Geräte, die ungewöhnlich oft offline gehen.
  for (const [entityId, record] of Object.entries(snapshot.entities)) {
    if (record.outages < 3) continue;
    const entity = entities.find((e) => e.entity_id === entityId);
    if (!entity) continue;
    const quote = record.samples ? Math.round((record.onlineSamples / record.samples) * 100) : 100;
    list.push({
      id: `flaky-${entityId}`,
      title: `${friendlyName(entity)} ist ungewöhnlich oft offline`,
      detail: `${record.outages} Ausfälle beobachtet · Erreichbarkeit ${quote}%.`,
      severity: record.outages >= 6 ? "warn" : "info",
      category: "geraete",
      priority: record.outages >= 6 ? 62 : 44,
      entityId,
      action: { label: "Gerätegesundheit", to: "/status" },
    });
  }

  // 4. Batterien mit schnellem Verlust (Trend aus der lokalen Historie).
  for (const battery of batterySensors(entities)) {
    const record = snapshot.entities[battery.entity_id];
    if (!record || record.battery.length < 3) continue;
    const first = record.battery[0];
    const last = record.battery[record.battery.length - 1];
    if (!first || !last) continue;
    const days = (last.t - first.t) / 86_400_000;
    const drop = first.v - last.v;
    if (days >= 1 && drop >= 10) {
      const perDay = drop / days;
      const remaining = perDay > 0 ? Math.round(last.v / perDay) : null;
      list.push({
        id: `battery-trend-${battery.entity_id}`,
        title: `${friendlyName(battery)} verliert schnell Ladung`,
        detail: `${drop.toFixed(0)} % in ${days.toFixed(1)} Tagen${
          remaining != null ? ` · rechnerisch noch ${remaining} Tage` : ""
        }.`,
        severity: last.v <= 25 ? "warn" : "info",
        category: "wartung",
        priority: last.v <= 25 ? 60 : 40,
        entityId: battery.entity_id,
      });
    }
  }

  // 5. Energie: aktuell auffällig hoher Verbrauch.
  const energy = energySummary(entities);
  if (energy.totalPower > 0) {
    const top = energy.power[0];
    if (top && top.value >= energy.totalPower * 0.5 && energy.power.length > 1) {
      list.push({
        id: "energy-top",
        title: `${friendlyName(top.entity)} verbraucht gerade am meisten`,
        detail: `${Math.round(top.value)} ${top.unit} von insgesamt ${Math.round(
          energy.totalPower,
        )} W im Haus.`,
        severity: "info",
        category: "energie",
        priority: 34,
        entityId: top.entity.entity_id,
        action: { label: "Energie", to: "/energy" },
      });
    }
  }

  // 6. Niemand zuhause, aber Geräte laufen.
  const persons = entities.filter((e) => domainOf(e.entity_id) === "person");
  if (persons.length && personsHome(entities).length === 0) {
    const on = lightsOn(entities);
    if (on.length) {
      list.push({
        id: "away-lights",
        title: `Niemand zuhause – ${on.length} Lichter brennen`,
        detail: on.map(friendlyName).slice(0, 4).join(", "),
        severity: "warn",
        category: "energie",
        priority: 72,
        action: { label: "Geräte", to: "/dashboard" },
      });
    }
    const openDoors = openings(entities).filter((e) => e.state === "on");
    if (openDoors.length) {
      list.push({
        id: "away-open",
        title: `Niemand zuhause – ${openDoors.length} Öffnungen gemeldet`,
        detail: openDoors.map(friendlyName).join(", "),
        severity: "critical",
        category: "sicherheit",
        priority: 95,
        action: { label: "Hausstatus", to: "/status" },
      });
    }
  }

  // 7. Komfort: sehr feuchte oder kalte Räume.
  for (const sensor of selectSensors(entities, "humidity")) {
    const value = numericState(sensor);
    if (value != null && value >= 70) {
      list.push({
        id: `humidity-${sensor.entity_id}`,
        title: `${friendlyName(sensor)}: ${Math.round(value)} % Luftfeuchte`,
        detail: "Kurz lüften beugt Schimmel vor.",
        severity: value >= 80 ? "warn" : "info",
        category: "komfort",
        priority: value >= 80 ? 55 : 30,
        entityId: sensor.entity_id,
      });
    }
  }
  for (const sensor of selectSensors(entities, "temperature")) {
    const value = numericState(sensor);
    if (value != null && value <= 16 && unitOf(sensor).includes("C")) {
      list.push({
        id: `cold-${sensor.entity_id}`,
        title: `${friendlyName(sensor)}: nur ${value.toFixed(1)} °C`,
        detail: "Der Raum kühlt aus – Heizung oder Fenster prüfen.",
        severity: "info",
        category: "komfort",
        priority: 36,
        entityId: sensor.entity_id,
      });
    }
  }

  // 8. Lange unveränderte Sensoren (mögliche Hänger).
  for (const sensor of entities.filter((e) => domainOf(e.entity_id) === "binary_sensor")) {
    if (!["motion", "occupancy"].includes(deviceClassOf(sensor))) continue;
    const minutes = minutesSince(sensor);
    if (minutes != null && minutes > 60 * 24 * 7) {
      list.push({
        id: `stuck-${sensor.entity_id}`,
        title: `${friendlyName(sensor)} meldet seit ${formatDuration(minutes)} nichts`,
        detail: "Sensor könnte hängen oder die Batterie ist leer.",
        severity: "info",
        category: "wartung",
        priority: 42,
        entityId: sensor.entity_id,
      });
    }
  }

  const seen = new Set<string>();
  return list
    .filter((item) => (seen.has(item.id) ? false : (seen.add(item.id), true)))
    .sort((a, b) => b.priority - a.priority);
}

/* -------------------------------- Hausanalyse ------------------------------ */

export type ReportCategory = {
  id: "sicherheit" | "energie" | "komfort" | "netzwerk" | "geraete" | "sensoren";
  label: string;
  score: number;
  detail: string;
  improvements: string[];
};

export type HouseReport = {
  score: number;
  grade: string;
  headline: string;
  categories: ReportCategory[];
  generatedAt: string;
  improvements: string[];
};

function clamp(value: number) {
  return Math.max(0, Math.min(100, Math.round(value)));
}

/** Täglicher Gesundheitsbericht des Hauses mit Gesamtscore 0–100. */
export function houseReport(
  entities: HaEntity[],
  status: HaStatus,
  snapshot: TelemetrySnapshot = telemetry.snapshot,
): HouseReport {
  const categories: ReportCategory[] = [];

  /* Sicherheit */
  const open = openings(entities).filter((e) => e.state === "on");
  const alarms = entities.filter((e) => domainOf(e.entity_id) === "alarm_control_panel");
  const triggered = alarms.some((e) => e.state === "triggered");
  const away = entities.some((e) => domainOf(e.entity_id) === "person") && !personsHome(entities).length;
  let securityScore = 100 - open.length * 12 - (triggered ? 60 : 0) - (away && open.length ? 20 : 0);
  const securityImprovements: string[] = [];
  if (open.length) securityImprovements.push(`${open.length} Öffnungen schließen`);
  if (!alarms.length) securityImprovements.push("Alarmanlage in Home Assistant einbinden");
  if (!openings(entities).length) {
    securityScore -= 10;
    securityImprovements.push("Tür-/Fenstersensoren ergänzen");
  }
  categories.push({
    id: "sicherheit",
    label: "Sicherheit",
    score: clamp(securityScore),
    detail: triggered
      ? "Alarm ausgelöst"
      : open.length
        ? `${open.length} Türen/Fenster offen`
        : "Alles geschlossen",
    improvements: securityImprovements,
  });

  /* Energie */
  const energy = energySummary(entities);
  const on = lightsOn(entities).length;
  let energyScore = 100 - Math.min(40, on * 4) - (away && on ? 20 : 0);
  const energyImprovements: string[] = [];
  if (!energy.hasData) {
    energyScore -= 15;
    energyImprovements.push("Verbrauchssensoren (Leistung/Energie) einbinden");
  }
  if (on >= 5) energyImprovements.push(`${on} Lichter sind eingeschaltet`);
  categories.push({
    id: "energie",
    label: "Energie",
    score: clamp(energyScore),
    detail: energy.hasData
      ? `${Math.round(energy.totalPower)} W aktuell · ${on} Lichter an`
      : `${on} Lichter an · keine Verbrauchsdaten`,
    improvements: energyImprovements,
  });

  /* Komfort */
  const temps = selectSensors(entities, "temperature")
    .map(numericState)
    .filter((value): value is number => value != null);
  const humid = selectSensors(entities, "humidity")
    .map(numericState)
    .filter((value): value is number => value != null);
  const avgTemp = temps.length ? temps.reduce((a, b) => a + b, 0) / temps.length : null;
  const avgHumid = humid.length ? humid.reduce((a, b) => a + b, 0) / humid.length : null;
  let comfortScore = 100;
  const comfortImprovements: string[] = [];
  if (avgTemp != null && (avgTemp < 18 || avgTemp > 25)) {
    comfortScore -= 20;
    comfortImprovements.push(`Durchschnittstemperatur ${avgTemp.toFixed(1)} °C anpassen`);
  }
  if (avgHumid != null && (avgHumid < 35 || avgHumid > 65)) {
    comfortScore -= 20;
    comfortImprovements.push(`Luftfeuchte bei ${avgHumid.toFixed(0)} % regulieren`);
  }
  if (!temps.length) {
    comfortScore -= 15;
    comfortImprovements.push("Temperatursensoren ergänzen");
  }
  categories.push({
    id: "komfort",
    label: "Komfort",
    score: clamp(comfortScore),
    detail:
      avgTemp != null
        ? `${avgTemp.toFixed(1)} °C${avgHumid != null ? ` · ${avgHumid.toFixed(0)} % rF` : ""}`
        : "Keine Klimadaten",
    improvements: comfortImprovements,
  });

  /* Netzwerk */
  let networkScore = status.websocket === "open" ? 100 : 30;
  if (status.rest !== "ok") networkScore -= 20;
  if (status.latencyMs != null && status.latencyMs > 500) networkScore -= 20;
  else if (status.latencyMs != null && status.latencyMs > 200) networkScore -= 10;
  const networkImprovements: string[] = [];
  if (status.websocket !== "open") networkImprovements.push("Live-Verbindung zu Home Assistant herstellen");
  if (status.latencyMs != null && status.latencyMs > 200)
    networkImprovements.push(`Antwortzeit von ${status.latencyMs} ms verbessern`);
  categories.push({
    id: "netzwerk",
    label: "Netzwerk",
    score: clamp(networkScore),
    detail:
      status.websocket === "open"
        ? `Live verbunden${status.latencyMs != null ? ` · ${status.latencyMs} ms` : ""}`
        : "Keine Live-Verbindung",
    improvements: networkImprovements,
  });

  /* Geräte */
  const controllable = entities.filter((e) =>
    ["light", "switch", "climate", "cover", "camera", "vacuum", "media_player"].includes(
      domainOf(e.entity_id),
    ),
  );
  const offline = controllable.filter((e) => !isAvailable(e));
  const flaky = Object.values(snapshot.entities).filter((record) => record.outages >= 3).length;
  const deviceScore =
    100 -
    (controllable.length ? (offline.length / controllable.length) * 70 : 0) -
    Math.min(20, flaky * 5);
  const deviceImprovements: string[] = [];
  if (offline.length) deviceImprovements.push(`${offline.length} Geräte sind nicht erreichbar`);
  if (flaky) deviceImprovements.push(`${flaky} Geräte fallen wiederholt aus`);
  categories.push({
    id: "geraete",
    label: "Geräte",
    score: clamp(deviceScore),
    detail: `${controllable.length - offline.length} von ${controllable.length} erreichbar`,
    improvements: deviceImprovements,
  });

  /* Sensoren */
  const batteries = batterySensors(entities);
  const low = batteries.filter((e) => (numericState(e) ?? 100) <= 20);
  const deadSensors = entities.filter(
    (e) => ["sensor", "binary_sensor"].includes(domainOf(e.entity_id)) && !isAvailable(e),
  );
  const sensorScore = 100 - low.length * 10 - Math.min(30, deadSensors.length * 3);
  const sensorImprovements: string[] = [];
  if (low.length) sensorImprovements.push(`${low.length} Batterien wechseln`);
  if (deadSensors.length) sensorImprovements.push(`${deadSensors.length} Sensoren liefern keine Werte`);
  categories.push({
    id: "sensoren",
    label: "Sensoren",
    score: clamp(sensorScore),
    detail: batteries.length
      ? `${batteries.length} Batteriesensoren · ${low.length} niedrig`
      : "Keine Batteriesensoren",
    improvements: sensorImprovements,
  });

  const score = clamp(
    categories.reduce((sum, category) => sum + category.score, 0) / categories.length,
  );

  return {
    score,
    grade: score >= 90 ? "Sehr gut" : score >= 75 ? "Gut" : score >= 55 ? "Befriedigend" : "Handlungsbedarf",
    headline:
      score >= 90
        ? "Dein Zuhause läuft rund."
        : score >= 75
          ? "Fast alles im grünen Bereich."
          : score >= 55
            ? "Einige Punkte solltest du prüfen."
            : "Mehrere Bereiche brauchen Aufmerksamkeit.",
    categories,
    generatedAt: new Date().toISOString(),
    improvements: categories.flatMap((category) => category.improvements),
  };
}

/* ----------------------------- Smart Empfehlungen -------------------------- */

export type Recommendation = {
  id: string;
  title: string;
  detail: string;
  kind: "automation" | "quickaction" | "hinweis" | "wartung";
  confidence: number;
  action?: { label: string; to: string };
};

function hourOf(timestamp: number) {
  return new Date(timestamp).getHours();
}

/**
 * Erkennt wiederkehrende Muster in der lokalen Historie und schlägt
 * Automationen bzw. Schnellaktionen vor. Es werden ausschließlich Vorschläge
 * erzeugt – nichts wird automatisch geändert.
 */
export function recommendations(
  entities: HaEntity[],
  snapshot: TelemetrySnapshot = telemetry.snapshot,
  rooms: { id: string; name: string }[] = [],
  devicesByRoom: Record<string, number> = {},
): Recommendation[] {
  const list: Recommendation[] = [];
  const byId = new Map(entities.map((entity) => [entity.entity_id, entity]));

  for (const [entityId, record] of Object.entries(snapshot.entities)) {
    const entity = byId.get(entityId);
    if (!entity) continue;
    const domain = domainOf(entityId);

    // Muster: gleiche Uhrzeit, gleicher Zustand, mehrfach an verschiedenen Tagen.
    if (["light", "switch", "cover"].includes(domain) && record.events.length >= 4) {
      const buckets = new Map<string, Set<string>>();
      for (const event of record.events) {
        const key = `${event.s}-${hourOf(event.t)}`;
        const days = buckets.get(key) ?? new Set<string>();
        days.add(dayKey(event.t));
        buckets.set(key, days);
      }
      for (const [key, days] of buckets) {
        if (days.size < 3) continue;
        const [state, hour] = key.split("-");
        list.push({
          id: `pattern-${entityId}-${key}`,
          title: `${friendlyName(entity)} wird oft gegen ${hour}:00 Uhr ${
            state === "on" ? "eingeschaltet" : "ausgeschaltet"
          }`,
          detail: `An ${days.size} Tagen beobachtet. Eine Automation könnte das künftig übernehmen.`,
          kind: "automation",
          confidence: Math.min(95, 45 + days.size * 12),
          action: { label: "Automationen öffnen", to: "/automations" },
        });
      }
    }

    // Muster: häufig manuell gestartete Szene → Schnellaktion vorschlagen.
    if (domain === "scene" && (record.uses >= 3 || record.changes >= 3)) {
      list.push({
        id: `scene-quick-${entityId}`,
        title: `Szene „${friendlyName(entity)}" als Schnellaktion`,
        detail: `Du startest sie regelmäßig (${Math.max(record.uses, record.changes)}×). Als Schnellaktion ist sie mit einem Tipp erreichbar.`,
        kind: "quickaction",
        confidence: 70,
        action: { label: "Schnellaktionen", to: "/home" },
      });
    }
  }

  // Selten genutzte Räume.
  for (const room of rooms) {
    const deviceCount = devicesByRoom[room.id] ?? 0;
    if (!deviceCount) {
      list.push({
        id: `room-empty-${room.id}`,
        title: `Raum „${room.name}" enthält keine Geräte`,
        detail: "Ordne Geräte in Home Assistant diesem Bereich zu oder entferne ihn.",
        kind: "hinweis",
        confidence: 60,
        action: { label: "Räume", to: "/rooms" },
      });
    }
  }

  // Automationen ohne Auslösung.
  const stale = entities.filter((entity) => {
    if (domainOf(entity.entity_id) !== "automation") return false;
    const last = entity.attributes?.["last_triggered"] as string | undefined;
    if (!last) return true;
    return Date.now() - new Date(last).getTime() > 30 * 86_400_000;
  });
  if (stale.length) {
    list.push({
      id: "stale-automations",
      title: `${stale.length} Automationen laufen nie`,
      detail: `${stale.map(friendlyName).slice(0, 3).join(", ")} – Bedingungen prüfen oder aufräumen.`,
      kind: "wartung",
      confidence: 65,
      action: { label: "Automationen", to: "/automations" },
    });
  }

  // Batterien vorausschauend wechseln.
  const soon = batterySensors(entities).filter((entity) => {
    const value = numericState(entity);
    return value != null && value <= 30 && value > 20;
  });
  if (soon.length) {
    list.push({
      id: "battery-soon",
      title: `${soon.length} Batterien bald wechseln`,
      detail: soon.map(friendlyName).slice(0, 3).join(", "),
      kind: "wartung",
      confidence: 80,
      action: { label: "Hausstatus", to: "/status" },
    });
  }

  const seen = new Set<string>();
  return list
    .filter((item) => (seen.has(item.id) ? false : (seen.add(item.id), true)))
    .sort((a, b) => b.confidence - a.confidence)
    .slice(0, 12);
}

/* ------------------------------ Energie-Analyse ---------------------------- */

export type EnergyComparison = {
  label: string;
  current: number;
  previous: number;
  delta: number;
  deltaPercent: number | null;
  unit: string;
  summary: string;
};

export type EnergyAnalysis = {
  hasHistory: boolean;
  today: number | null;
  comparisons: EnergyComparison[];
  top: { name: string; value: number; unit: string; share: number }[];
  trend: "steigend" | "fallend" | "stabil" | "unbekannt";
  summary: string;
  days: { day: string; energy: number | null; avgPower: number | null }[];
};

function sumRange(snapshot: TelemetrySnapshot, from: Date, to: Date) {
  let total = 0;
  let found = false;
  for (const [key, day] of Object.entries(snapshot.days)) {
    const date = new Date(`${key}T12:00:00`);
    if (date >= from && date < to && day.energy != null) {
      total += day.energy;
      found = true;
    }
  }
  return found ? total : null;
}

function startOfDay(offsetDays = 0) {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  date.setDate(date.getDate() - offsetDays);
  return date;
}

function describeDelta(label: string, current: number, previous: number, unit: string) {
  if (previous <= 0) return `${label}: ${current.toFixed(1)} ${unit} (kein Vergleichswert).`;
  const percent = ((current - previous) / previous) * 100;
  const direction = percent > 3 ? "mehr" : percent < -3 ? "weniger" : "genauso viel";
  return `${label}: ${current.toFixed(1)} ${unit} – ${
    direction === "genauso viel" ? "etwa gleich wie" : `${Math.abs(percent).toFixed(0)} % ${direction} als`
  } ${previous.toFixed(1)} ${unit} zuvor.`;
}

/** Tages-, Wochen- und Monatsvergleich aus der lokal aufgezeichneten Historie. */
export function energyAnalysis(
  entities: HaEntity[],
  snapshot: TelemetrySnapshot = telemetry.snapshot,
): EnergyAnalysis {
  const base = energySummary(entities);
  const unit = "kWh";
  const dayEntries = Object.entries(snapshot.days).sort(([a], [b]) => a.localeCompare(b));
  const days = dayEntries.slice(-30).map(([day, value]) => ({
    day,
    energy: value.energy,
    avgPower: value.powerCount ? value.powerSum / value.powerCount : null,
  }));

  const today = snapshot.days[dayKey()]?.energy ?? (base.totalToday || null);
  const yesterday = snapshot.days[dayKey(startOfDay(1))]?.energy ?? null;

  const comparisons: EnergyComparison[] = [];
  const push = (label: string, current: number | null, previous: number | null) => {
    if (current == null) return;
    const prev = previous ?? 0;
    comparisons.push({
      label,
      current,
      previous: prev,
      delta: current - prev,
      deltaPercent: prev > 0 ? ((current - prev) / prev) * 100 : null,
      unit,
      summary: describeDelta(label, current, prev, unit),
    });
  };

  push("Heute", today, yesterday);
  push(
    "Diese Woche",
    sumRange(snapshot, startOfDay(6), startOfDay(-1)),
    sumRange(snapshot, startOfDay(13), startOfDay(6)),
  );
  push(
    "Dieser Monat",
    sumRange(snapshot, startOfDay(29), startOfDay(-1)),
    sumRange(snapshot, startOfDay(59), startOfDay(29)),
  );

  const totalPower = base.totalPower || 1;
  const top = base.power.slice(0, 6).map((item) => ({
    name: friendlyName(item.entity),
    value: item.value,
    unit: item.unit,
    share: Math.round((item.value / totalPower) * 100),
  }));

  const withEnergy = days.filter((day) => day.energy != null) as { day: string; energy: number }[];
  let trend: EnergyAnalysis["trend"] = "unbekannt";
  if (withEnergy.length >= 4) {
    const half = Math.floor(withEnergy.length / 2);
    const older = withEnergy.slice(0, half).reduce((sum, day) => sum + day.energy, 0) / half;
    const newer =
      withEnergy.slice(half).reduce((sum, day) => sum + day.energy, 0) / (withEnergy.length - half);
    trend = newer > older * 1.08 ? "steigend" : newer < older * 0.92 ? "fallend" : "stabil";
  }

  const summary = base.hasData
    ? `Aktuell ${Math.round(base.totalPower)} W im Haus.${
        today != null ? ` Heute bisher ${today.toFixed(1)} kWh.` : ""
      }${trend !== "unbekannt" ? ` Der Verbrauch ist ${trend}.` : ""}${
        top[0] ? ` Größter Verbraucher: ${top[0].name}.` : ""
      }`
    : "Es sind noch keine Energiedaten aus Home Assistant vorhanden.";

  return {
    hasHistory: withEnergy.length >= 2,
    today,
    comparisons,
    top,
    trend,
    summary,
    days,
  };
}

/* --------------------------- Tägliche Zusammenfassung ---------------------- */

export function greeting(now = new Date()) {
  const hour = now.getHours();
  if (hour < 5) return "Gute Nacht";
  if (hour < 11) return "Guten Morgen";
  if (hour < 18) return "Guten Tag";
  return "Guten Abend";
}

export type Briefing = {
  greeting: string;
  lines: string[];
  text: string;
  severity: Severity;
};

/** Verständliche Tageszusammenfassung in ganzen Sätzen. */
export function dailyBriefing({
  entities,
  status,
  rainChance = null,
  snapshot = telemetry.snapshot,
  now = new Date(),
}: InsightContext): Briefing {
  const lines: string[] = [];
  const insights = smartInsights({ entities, status, rainChance, snapshot, now });
  const critical = insights.filter((item) => item.severity === "critical");
  const warnings = insights.filter((item) => item.severity === "warn");

  if (status.websocket !== "open") {
    lines.push("Es besteht gerade keine Live-Verbindung zu Home Assistant.");
  } else if (!critical.length && !warnings.length) {
    lines.push("Alle Systeme laufen normal.");
  } else if (critical.length) {
    lines.push(`${critical.length} Punkte brauchen sofort deine Aufmerksamkeit.`);
  } else {
    lines.push(`${warnings.length} Hinweise warten auf dich.`);
  }

  const on = lightsOn(entities).length;
  if (on) lines.push(`${on} ${on === 1 ? "Lampe ist" : "Lampen sind"} noch eingeschaltet.`);

  const open = openings(entities).filter((entity) => entity.state === "on");
  if (open.length) lines.push(`${open.length} ${open.length === 1 ? "Öffnung ist" : "Öffnungen sind"} offen: ${open.map(friendlyName).slice(0, 3).join(", ")}.`);

  if (rainChance != null && rainChance >= 50) lines.push("Heute wird Regen erwartet.");

  const laundry = entities.find((entity) =>
    /wasch|trockn|washer|dryer|spülmaschine|geschirrspüler/.test(friendlyName(entity).toLowerCase()),
  );
  if (laundry) {
    const state = laundry.state.toLowerCase();
    lines.push(
      ["finished", "complete", "done", "fertig"].includes(state)
        ? `${friendlyName(laundry)} ist fertig.`
        : ["on", "running", "washing"].includes(state)
          ? `${friendlyName(laundry)} läuft gerade.`
          : `${friendlyName(laundry)} ist betriebsbereit.`,
    );
  }

  const energy = energySummary(entities);
  if (energy.hasData && energy.totalPower > 0) {
    lines.push(`Aktueller Verbrauch: ${Math.round(energy.totalPower)} Watt.`);
  }

  const low = batterySensors(entities).filter((entity) => (numericState(entity) ?? 100) <= 20);
  if (low.length) lines.push(`${low.length} ${low.length === 1 ? "Batterie ist" : "Batterien sind"} fast leer.`);

  const severity: Severity = critical.length ? "critical" : warnings.length ? "warn" : "ok";

  return {
    greeting: greeting(now),
    lines,
    text: `${greeting(now)}. ${lines.join(" ")}`,
    severity,
  };
}

/* --------------------------- Gerätegesundheit Plus ------------------------- */

export type HealthPlus = Health & {
  /** Erreichbarkeit in Prozent aus der lokalen Beobachtung. */
  uptime: number | null;
  /** Beobachtete Ausfälle und Zeitpunkt des letzten Ausfalls. */
  outages: number;
  lastOutageAt: number | null;
  /** Reaktionszeit der Instanz in Millisekunden (Home Assistant REST). */
  responseMs: number | null;
  /** Batterieverlauf für die Sparkline. */
  batteryTrend: { t: number; v: number }[];
  /** Verbindungsqualität in Prozent (Signal, Erreichbarkeit). */
  linkQuality: number | null;
  critical: boolean;
};

export function deviceHealthPlus(
  entities: HaEntity[],
  targets: HaEntity[],
  status: HaStatus,
  snapshot: TelemetrySnapshot = telemetry.snapshot,
): HealthPlus[] {
  return deviceHealth(entities, targets)
    .map((item) => {
      const record = snapshot.entities[item.entityId];
      const uptime =
        record && record.samples > 3 ? Math.round((record.onlineSamples / record.samples) * 100) : null;
      const linkQuality =
        item.signal != null
          ? Math.max(0, Math.min(100, Math.round(((item.signal + 100) / 60) * 100)))
          : uptime;
      const outages = record?.outages ?? 0;
      return {
        ...item,
        uptime,
        outages,
        lastOutageAt: record?.lastOutageAt ?? null,
        responseMs: status.latencyMs,
        batteryTrend: record?.battery ?? [],
        linkQuality,
        critical: !item.online || item.score < 60 || outages >= 5,
      } satisfies HealthPlus;
    })
    .sort((a, b) => a.score - b.score);
}
