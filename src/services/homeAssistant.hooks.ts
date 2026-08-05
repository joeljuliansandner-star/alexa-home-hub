/**
 * React-Anbindung an den zentralen Home-Assistant-Service.
 * Seiten verwenden ausschließlich diese Hooks bzw. `homeAssistant`.
 */
import { useEffect, useSyncExternalStore } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { homeAssistant, type HaStatus } from "./homeAssistant";

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

/** Beim App-Start automatisch verbinden und Live-Änderungen übernehmen. */
export function useHomeAssistantLive(enabled = true) {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;

    void homeAssistant.loadConnection().then((connection) => {
      if (!cancelled && connection) void homeAssistant.connectSocket();
    });

    const timer = setInterval(async () => {
      const changed = await homeAssistant.flushLiveStates().catch(() => 0);
      if (changed > 0) await queryClient.invalidateQueries({ queryKey: ["devices"] });
    }, 3000);

    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [enabled, queryClient]);
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
