/**
 * Ausführung von Schnellaktionen – nutzt ausschließlich vorhandene
 * Home-Assistant-Dienste über den bestehenden Service.
 */
import { domainOf, homeAssistant, type HaEntity } from "@/services/homeAssistant";
import type { QuickAction } from "./prefs";

export async function runQuickAction(action: QuickAction, entities: HaEntity[]) {
  if (action.kind === "scene") {
    await homeAssistant.activateScene(action.target);
    return 1;
  }
  if (action.kind === "script") {
    await homeAssistant.runScript(action.target);
    return 1;
  }
  if (action.kind === "automation") {
    await homeAssistant.triggerAutomation(action.target);
    return 1;
  }

  const domain = action.target;
  const on = action.kind === "domain-on";
  const targets = entities
    .filter((entity) => domainOf(entity.entity_id) === domain)
    .filter((entity) => (on ? entity.state !== "on" : entity.state === "on" || domain === "cover"))
    .map((entity) => entity.entity_id);

  if (!targets.length) return 0;

  if (domain === "cover") {
    await homeAssistant.callService("cover", on ? "open_cover" : "close_cover", {
      entity_id: targets,
    });
    return targets.length;
  }

  await homeAssistant.callService(domain, on ? "turn_on" : "turn_off", { entity_id: targets });
  return targets.length;
}

export const actionDomains = [
  { value: "light", label: "Lichter" },
  { value: "switch", label: "Schalter & Steckdosen" },
  { value: "cover", label: "Rollläden" },
  { value: "media_player", label: "Medien" },
  { value: "fan", label: "Ventilatoren" },
] as const;
