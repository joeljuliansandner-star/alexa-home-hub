/**
 * Version 5.0 – modulare AI-Service-Schnittstelle.
 *
 * Diese Schicht kapselt jede Form von „Intelligenz" hinter einer stabilen
 * Schnittstelle. Aktuell ist ausschließlich der lokale, regelbasierte Anbieter
 * aktiv – es wird KEIN externer KI-Dienst eingebunden und es verlassen keine
 * Daten das Gerät.
 *
 * Später kann ein echter LLM-Anbieter (z. B. über eine Server-Funktion mit dem
 * Lovable AI Gateway) ergänzt werden, indem er `AiProvider` implementiert und
 * mit `registerAiProvider()` registriert wird. Die Oberfläche muss dafür nicht
 * angepasst werden.
 */
import type { HaEntity, HaStatus } from "@/services/homeAssistant";
import type { TelemetrySnapshot } from "@/lib/os/telemetry";
import type { Briefing, HouseReport, Insight, Recommendation } from "@/lib/os/intelligence";
import {
  dailyBriefing,
  houseReport,
  recommendations,
  smartInsights,
} from "@/lib/os/intelligence";

/** Alle Daten, die einem Anbieter zur Verfügung stehen. */
export type AiContext = {
  entities: HaEntity[];
  status: HaStatus;
  snapshot: TelemetrySnapshot;
  rainChance?: number | null;
  rooms?: { id: string; name: string }[];
  devicesByRoom?: Record<string, number>;
  now?: Date;
};

export type AiAnswer = {
  text: string;
  /** Quelle der Antwort – für die Anzeige „lokal berechnet" vs. „KI". */
  source: string;
  /** Optionale weiterführende Verweise innerhalb der App. */
  links?: { label: string; to: string }[];
};

/**
 * Vertrag für Intelligenz-Anbieter. Ein zukünftiger LLM-Anbieter implementiert
 * dieselben Methoden – asynchron, damit Netzaufrufe möglich sind.
 */
export type AiProvider = {
  id: string;
  label: string;
  /** Läuft die Auswertung vollständig auf dem Gerät? */
  local: boolean;
  /** Kann der Anbieter freie Fragen beantworten? */
  canChat: boolean;
  insights(context: AiContext): Promise<Insight[]>;
  report(context: AiContext): Promise<HouseReport>;
  recommendations(context: AiContext): Promise<Recommendation[]>;
  briefing(context: AiContext): Promise<Briefing>;
  ask?(question: string, context: AiContext): Promise<AiAnswer>;
};

/** Lokaler, regelbasierter Anbieter – Standard und ohne jede Abhängigkeit. */
export const localAiProvider: AiProvider = {
  id: "local-rules",
  label: "Lokale Analyse",
  local: true,
  canChat: false,
  async insights(context) {
    return smartInsights(context);
  },
  async report(context) {
    return houseReport(context.entities, context.status, context.snapshot);
  },
  async recommendations(context) {
    return recommendations(
      context.entities,
      context.snapshot,
      context.rooms ?? [],
      context.devicesByRoom ?? {},
    );
  },
  async briefing(context) {
    return dailyBriefing(context);
  },
};

let activeProvider: AiProvider = localAiProvider;
const registry = new Map<string, AiProvider>([[localAiProvider.id, localAiProvider]]);

/** Registriert einen zusätzlichen Anbieter (z. B. später einen LLM-Dienst). */
export function registerAiProvider(provider: AiProvider, activate = false) {
  registry.set(provider.id, provider);
  if (activate) activeProvider = provider;
}

export function listAiProviders(): AiProvider[] {
  return [...registry.values()];
}

export function setActiveAiProvider(id: string) {
  const provider = registry.get(id);
  if (provider) activeProvider = provider;
  return activeProvider;
}

export function getAiProvider(): AiProvider {
  return activeProvider;
}

/** Bequemer Zugriff für die Oberfläche – immer über den aktiven Anbieter. */
export const aiService = {
  get provider() {
    return activeProvider;
  },
  insights: (context: AiContext) => activeProvider.insights(context),
  report: (context: AiContext) => activeProvider.report(context),
  recommendations: (context: AiContext) => activeProvider.recommendations(context),
  briefing: (context: AiContext) => activeProvider.briefing(context),
  ask: async (question: string, context: AiContext): Promise<AiAnswer> => {
    if (activeProvider.ask) return activeProvider.ask(question, context);
    return {
      text: "Freie Fragen sind noch nicht aktiviert. Aktuell arbeitet die App mit der lokalen Analyse.",
      source: activeProvider.label,
    };
  },
};
