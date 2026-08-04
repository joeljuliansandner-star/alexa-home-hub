/**
 * Alexa – React-Query-Anbindung für die Oberfläche.
 * Reine Client-Schicht: kein direkter Zugriff auf Amazon oder die Datenbank.
 */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";

import {
  clearAlexaLog,
  completeAlexaLogin,
  controlAlexaDevice,
  disconnectAlexa,
  getAlexaLog,
  getAlexaSettings,
  getAlexaStatus,
  listAlexaDevices,
  saveAlexaSettings,
  startAlexaLogin,
  syncAlexa,
} from "@/lib/alexa.functions";
import type { AlexaSettingsModel } from "@/lib/alexa/model";

export const alexaKeys = {
  status: ["alexa", "status"] as const,
  devices: ["alexa", "devices"] as const,
  settings: ["alexa", "settings"] as const,
  log: ["alexa", "log"] as const,
};

export function useAlexaStatus() {
  const fetcher = useServerFn(getAlexaStatus);
  return useQuery({ queryKey: alexaKeys.status, queryFn: () => fetcher() });
}

export function useAlexaDevices() {
  const fetcher = useServerFn(listAlexaDevices);
  return useQuery({ queryKey: alexaKeys.devices, queryFn: () => fetcher() });
}

export function useAlexaSettings() {
  const fetcher = useServerFn(getAlexaSettings);
  return useQuery({ queryKey: alexaKeys.settings, queryFn: () => fetcher() });
}

export function useAlexaLog() {
  const fetcher = useServerFn(getAlexaLog);
  return useQuery({ queryKey: alexaKeys.log, queryFn: () => fetcher() });
}

/** Startet die Anmeldung bei Amazon (Login with Amazon). */
export function useAlexaLogin() {
  const start = useServerFn(startAlexaLogin);
  return useMutation({
    mutationFn: async () => {
      const redirectUri = `${window.location.origin}/alexa/callback`;
      return start({ data: { redirectUri } });
    },
    onSuccess: (result) => {
      window.location.href = result.url;
    },
    onError: (error: Error) => toast.error(error.message),
  });
}

export function useAlexaCallback() {
  const complete = useServerFn(completeAlexaLogin);
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (code: string) =>
      complete({ data: { code, redirectUri: `${window.location.origin}/alexa/callback` } }),
    onSuccess: (result) => {
      void qc.invalidateQueries({ queryKey: ["alexa"] });
      result.ok ? toast.success(result.message) : toast.error(result.message);
    },
    onError: (error: Error) => toast.error(error.message),
  });
}

export function useAlexaDisconnect() {
  const run = useServerFn(disconnectAlexa);
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => run(),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["alexa"] });
      toast.success("Amazon-Konto getrennt.");
    },
    onError: (error: Error) => toast.error(error.message),
  });
}

export function useAlexaSync() {
  const run = useServerFn(syncAlexa);
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => run(),
    onSuccess: (result) => {
      void qc.invalidateQueries({ queryKey: ["alexa"] });
      if (result.available) toast.success(`${result.imported} Alexa-Geräte abgeglichen.`);
      else toast.warning(result.reason ?? "Amazon liefert keine Geräte.");
    },
    onError: (error: Error) => toast.error(error.message),
  });
}

export function useAlexaControl() {
  const run = useServerFn(controlAlexaDevice);
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { deviceId: string; volume?: number; muted?: boolean }) =>
      run({ data: input }),
    onSuccess: (result) => {
      void qc.invalidateQueries({ queryKey: alexaKeys.log });
      result.ok ? toast.success(result.message) : toast.warning(result.message);
    },
    onError: (error: Error) => toast.error(error.message),
  });
}

export function useSaveAlexaSettings() {
  const run = useServerFn(saveAlexaSettings);
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (settings: AlexaSettingsModel) => run({ data: settings }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: alexaKeys.settings });
      toast.success("Alexa-Einstellungen gespeichert.");
    },
    onError: (error: Error) => toast.error(error.message),
  });
}

export function useClearAlexaLog() {
  const run = useServerFn(clearAlexaLog);
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => run(),
    onSuccess: () => qc.invalidateQueries({ queryKey: alexaKeys.log }),
  });
}
