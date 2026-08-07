/**
 * Version 5.0 – React-Anbindung der Smart-Intelligence-Analysen.
 *
 * Alle Hooks arbeiten auf dem vorhandenen Home-Assistant-Live-Cache und der
 * lokalen Telemetrie. Es werden keine zusätzlichen API-Aufrufe ausgelöst.
 */
import { useMemo, useSyncExternalStore } from "react";

import { domainOf } from "@/services/homeAssistant";
import { useHaEntities, useHaStatus } from "@/services/homeAssistant.hooks";
import { useDevices, useRooms } from "@/lib/smarthome";
import { telemetry } from "./telemetry";
import {
  dailyBriefing,
  deviceHealthPlus,
  energyAnalysis,
  houseReport,
  recommendations,
  smartInsights,
  type Briefing,
  type EnergyAnalysis,
  type HealthPlus,
  type HouseReport,
  type Insight,
  type Recommendation,
} from "./intelligence";

/** Abonniert die lokale Telemetrie und liefert bei Änderungen eine neue Version. */
export function useTelemetryRevision() {
  return useSyncExternalStore(
    (listener) => telemetry.subscribe(listener),
    () => telemetry.revision,
    () => 0,
  );
}

/**
 * Regenwahrscheinlichkeit aus einer vorhandenen Home-Assistant-Wetterentität.
 * Ohne Wetterentität wird `null` geliefert – es wird kein externer Dienst
 * zusätzlich angefragt.
 */
export function useRainChance(): number | null {
  const entities = useHaEntities();
  return useMemo(() => {
    const weather = entities.find((entity) => domainOf(entity.entity_id) === "weather");
    if (!weather) return null;
    const direct = weather.attributes?.["precipitation_probability"];
    if (typeof direct === "number") return Math.round(direct);
    const forecast = weather.attributes?.["forecast"];
    if (Array.isArray(forecast)) {
      const next = forecast
        .slice(0, 3)
        .map((item: Record<string, unknown>) => Number(item?.["precipitation_probability"]))
        .filter((value) => Number.isFinite(value));
      if (next.length) return Math.round(Math.max(...next));
    }
    if (/rain|shower|pouring|regen/i.test(weather.state)) return 80;
    return null;
  }, [entities]);
}

export function useSmartInsights(): Insight[] {
  const entities = useHaEntities();
  const status = useHaStatus();
  const rainChance = useRainChance();
  const revision = useTelemetryRevision();
  return useMemo(
    () => smartInsights({ entities, status, rainChance, snapshot: telemetry.snapshot }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [entities, status, rainChance, revision],
  );
}

export function useHouseReport(): HouseReport {
  const entities = useHaEntities();
  const status = useHaStatus();
  const revision = useTelemetryRevision();
  return useMemo(
    () => houseReport(entities, status, telemetry.snapshot),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [entities, status, revision],
  );
}

export function useRecommendations(): Recommendation[] {
  const entities = useHaEntities();
  const rooms = useRooms();
  const devices = useDevices();
  const revision = useTelemetryRevision();

  return useMemo(() => {
    const byRoom: Record<string, number> = {};
    for (const device of devices.data ?? []) {
      if (device.room_id) byRoom[device.room_id] = (byRoom[device.room_id] ?? 0) + 1;
    }
    return recommendations(
      entities,
      telemetry.snapshot,
      (rooms.data ?? []).map((room) => ({ id: room.id, name: room.name })),
      byRoom,
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entities, rooms.data, devices.data, revision]);
}

export function useEnergyAnalysis(): EnergyAnalysis {
  const entities = useHaEntities();
  const revision = useTelemetryRevision();
  return useMemo(
    () => energyAnalysis(entities, telemetry.snapshot),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [entities, revision],
  );
}

export function useDailyBriefing(): Briefing {
  const entities = useHaEntities();
  const status = useHaStatus();
  const rainChance = useRainChance();
  const revision = useTelemetryRevision();
  return useMemo(
    () => dailyBriefing({ entities, status, rainChance, snapshot: telemetry.snapshot }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [entities, status, rainChance, revision],
  );
}

const HEALTH_DOMAINS = ["light", "switch", "climate", "cover", "camera", "vacuum", "media_player"];

export function useDeviceHealthPlus(): HealthPlus[] {
  const entities = useHaEntities();
  const status = useHaStatus();
  const revision = useTelemetryRevision();
  return useMemo(() => {
    const targets = entities.filter((entity) =>
      HEALTH_DOMAINS.includes(domainOf(entity.entity_id)),
    );
    return deviceHealthPlus(entities, targets, status, telemetry.snapshot);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entities, status, revision]);
}
