/**
 * Lokaler Speicher für benutzerdefinierte Schnellaktionen und angepinnte
 * Elemente (Räume, Szenen, Automationen). Bewusst ohne Backend-Änderung –
 * die Daten liegen im Browser des Nutzers.
 */
import { useCallback, useSyncExternalStore } from "react";

export type QuickActionKind =
  | "domain-off"
  | "domain-on"
  | "scene"
  | "script"
  | "automation";

export type QuickAction = {
  id: string;
  label: string;
  kind: QuickActionKind;
  /** Domäne (light, switch, cover …) oder Entity-ID der Szene/des Skripts. */
  target: string;
  icon: string;
};

export type PinKind = "room" | "scene" | "automation";
export type Pin = { kind: PinKind; id: string; label: string };

type Store<T> = {
  read: () => T;
  write: (value: T) => void;
  subscribe: (listener: () => void) => () => void;
};

function createStore<T>(key: string, fallback: T): Store<T> {
  let cache: T | null = null;
  const listeners = new Set<() => void>();

  const read = () => {
    if (cache !== null) return cache;
    if (typeof window === "undefined") return fallback;
    try {
      const raw = window.localStorage.getItem(key);
      cache = raw ? (JSON.parse(raw) as T) : fallback;
    } catch {
      cache = fallback;
    }
    return cache;
  };

  return {
    read,
    write(value: T) {
      cache = value;
      try {
        window.localStorage.setItem(key, JSON.stringify(value));
      } catch {
        /* Speicher voll oder gesperrt – Aktion bleibt für die Sitzung aktiv */
      }
      listeners.forEach((listener) => listener());
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}

export const defaultQuickActions: QuickAction[] = [
  { id: "lights-off", label: "Alle Lichter aus", kind: "domain-off", target: "light", icon: "lightbulb" },
  { id: "covers-close", label: "Rollläden schließen", kind: "domain-off", target: "cover", icon: "blinds" },
  { id: "plugs-off", label: "Steckdosen aus", kind: "domain-off", target: "switch", icon: "plug" },
];

const quickActionStore = createStore<QuickAction[]>("os.quickActions", defaultQuickActions);
const pinStore = createStore<Pin[]>("os.pins", []);

export function useQuickActions() {
  const actions = useSyncExternalStore(
    quickActionStore.subscribe,
    quickActionStore.read,
    () => defaultQuickActions,
  );

  const add = useCallback((action: Omit<QuickAction, "id">) => {
    quickActionStore.write([
      ...quickActionStore.read(),
      { ...action, id: `qa-${Date.now().toString(36)}` },
    ]);
  }, []);

  const remove = useCallback((id: string) => {
    quickActionStore.write(quickActionStore.read().filter((action) => action.id !== id));
  }, []);

  const reset = useCallback(() => quickActionStore.write(defaultQuickActions), []);

  return { actions, add, remove, reset };
}

export function usePins() {
  const pins = useSyncExternalStore(pinStore.subscribe, pinStore.read, () => [] as Pin[]);

  const toggle = useCallback((pin: Pin) => {
    const current = pinStore.read();
    const exists = current.some((entry) => entry.kind === pin.kind && entry.id === pin.id);
    pinStore.write(
      exists
        ? current.filter((entry) => !(entry.kind === pin.kind && entry.id === pin.id))
        : [...current, pin],
    );
  }, []);

  const isPinned = useCallback(
    (kind: PinKind, id: string) => pins.some((entry) => entry.kind === kind && entry.id === id),
    [pins],
  );

  return { pins, toggle, isPinned };
}
