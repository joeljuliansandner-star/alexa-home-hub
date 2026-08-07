/**
 * React-Anbindung an den zentralen Home-Assistant-Service.
 * Seiten verwenden ausschließlich diese Hooks bzw. `homeAssistant`.
 */
import { useCallback, useEffect, useMemo, useRef, useSyncExternalStore } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { domainOf, homeAssistant, type HaEntity, type HaStatus } from "./homeAssistant";

export function useHaConnection() {
  return useQuery({
    queryKey: ["ha", "connection"],
    queryFn: () => homeAssistant.loadConnection(),
    staleTime: 60_000,
  });
}

const emptyStatus: HaStatus = {
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

export function useHaStatus(): HaStatus {
  return useSyncExternalStore(
    (listener) => homeAssistant.subscribe(listener),
    () => homeAssistant.status,
    () => emptyStatus,
  );
}

/** Abonniert den Service und liefert bei jeder Live-Änderung eine neue Version. */
function useHaRevision() {
  return useSyncExternalStore(
    (listener) => homeAssistant.subscribe(listener),
    () =>
      `${homeAssistant.states.size}:${homeAssistant.registryVersion}:${homeAssistant.status.websocket}:${homeAssistant.status.lastSyncAt ?? ""}:${homeAssistant.dirty.size}`,
    () => "",
  );
}

/** Alle Entitäten live aus dem WebSocket-Cache – optional nach Domäne gefiltert. */
export function useHaEntities(domain?: string): HaEntity[] {
  const revision = useHaRevision();
  return useMemo(() => {
    const all = [...homeAssistant.states.values()];
    return domain ? all.filter((entity) => domainOf(entity.entity_id) === domain) : all;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [revision, domain]);
}

/** Eine einzelne Entität live. */
export function useHaEntity(entityId: string | null | undefined): HaEntity | null {
  const revision = useHaRevision();
  return useMemo(
    () => (entityId ? (homeAssistant.states.get(entityId) ?? null) : null),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [revision, entityId],
  );
}

export function useHaScenes() {
  return useHaEntities("scene");
}

export function useHaAutomations() {
  return useHaEntities("automation");
}

export function useHaScripts() {
  return useHaEntities("script");
}

export function useHaCameras() {
  return useHaEntities("camera");
}

/** Globale Suche über alle Entitäten. */
export function useHaSearch(term: string): HaEntity[] {
  const revision = useHaRevision();
  return useMemo(
    () => homeAssistant.search(term),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [revision, term],
  );
}

/** Persistente Benachrichtigungen aus Home Assistant. */
export function useHaNotifications() {
  const status = useHaStatus();
  return useQuery({
    queryKey: ["ha", "notifications", status.websocket],
    queryFn: () => homeAssistant.notifications(),
    enabled: status.websocket === "open",
    refetchInterval: 60_000,
  });
}

/** Verlauf einer Entität für Diagramme und Export. */
export function useHaHistory(entityId: string | null | undefined, hours = 24) {
  return useQuery({
    queryKey: ["ha", "history", entityId, hours],
    enabled: Boolean(entityId),
    queryFn: () => homeAssistant.history(entityId as string, hours),
    staleTime: 60_000,
  });
}

/**
 * Beim App-Start automatisch verbinden, Live-Änderungen übernehmen und bei
 * Registry-Änderungen (neue/entfernte Geräte, Räume) automatisch abgleichen.
 */
export function useHomeAssistantLive(enabled = true) {
  const queryClient = useQueryClient();
  const registryVersion = useHaRevision();
  const lastSyncedRegistry = useRef<number>(-1);
  const syncing = useRef(false);

  const runSync = useCallback(async () => {
    if (syncing.current) return;
    syncing.current = true;
    try {
      await homeAssistant.sync();
      await queryClient.invalidateQueries({ queryKey: ["devices"] });
      await queryClient.invalidateQueries({ queryKey: ["rooms"] });
    } catch {
      /* Abgleich wird beim nächsten Ereignis erneut versucht */
    } finally {
      syncing.current = false;
    }
  }, [queryClient]);

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;

    void homeAssistant.loadConnection().then((connection) => {
      if (!cancelled && connection) void homeAssistant.connectSocket();
    });

    // Live-Zustände laufen über den WebSocket; hier werden sie nur gebündelt
    // in die App-Datenbank geschrieben (kein Abfrage-Polling gegen HA).
    const timer = setInterval(async () => {
      const changed = await homeAssistant.flushLiveStates().catch(() => 0);
      if (changed > 0) await queryClient.invalidateQueries({ queryKey: ["devices"] });
    }, 3000);

    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [enabled, queryClient]);

  // Automatischer Abgleich: einmal nach dem Verbinden und danach bei jeder
  // Änderung an der Entity-/Device-/Area-Registry.
  useEffect(() => {
    if (!enabled) return;
    if (homeAssistant.status.websocket !== "open") return;
    if (lastSyncedRegistry.current === homeAssistant.registryVersion) return;
    lastSyncedRegistry.current = homeAssistant.registryVersion;
    void runSync();
  }, [enabled, registryVersion, runSync]);
}

export function useHaSync() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => homeAssistant.sync(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["devices"] });
      queryClient.invalidateQueries({ queryKey: ["rooms"] });
      queryClient.invalidateQueries({ queryKey: ["ha", "connection"] });
    },
  });
}

/** Startet eine Home-Assistant-Szene. */
export function useRunHaScene() {
  return useMutation({
    mutationFn: (entityId: string) => homeAssistant.activateScene(entityId),
  });
}

/** Automationen auslösen bzw. aktivieren/deaktivieren. */
export function useHaAutomationActions() {
  const trigger = useMutation({
    mutationFn: (entityId: string) => homeAssistant.triggerAutomation(entityId),
  });
  const setEnabled = useMutation({
    mutationFn: ({ entityId, enabled }: { entityId: string; enabled: boolean }) =>
      homeAssistant.setAutomationEnabled(entityId, enabled),
  });
  return { trigger, setEnabled };
}
