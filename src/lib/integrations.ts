import {
  Boxes,
  Cloud,
  Lightbulb,
  Mic,
  Network,
  Radio,
  Server,
  Wifi,
  type LucideIcon,
} from "lucide-react";

import type { Device } from "@/lib/smarthome";

/**
 * Zentrale Registry aller Smart-Home-Integrationen.
 *
 * Neue Dienste werden ausschließlich hier ergänzt – Übersicht und Detailseite
 * lesen alles aus dieser Datei. `externalSource` verweist auf
 * `devices.external_source`; sobald eine echte API angebunden ist, reicht es,
 * `sync` in der Detailseite zu verdrahten.
 */
export type IntegrationId =
  "tuya" | "tapo" | "dreame" | "alexa" | "homeassistant" | "mqtt" | "hue" | "shelly" | "zigbee";

export type IntegrationDef = {
  id: IntegrationId;
  name: string;
  description: string;
  icon: LucideIcon;
  tone: "primary" | "accent" | "muted";
  /** Passt zu `devices.external_source`, falls Geräte importiert werden. */
  externalSource: string | null;
  /** Echte Synchronisierung bereits verdrahtet? */
  live: boolean;
  /** Platzhalter-Angaben für Konto/Server – später aus echten Quellen. */
  account: { label: string; value: string }[];
  /** Platzhalter für erweiterte Einstellungen. */
  advanced: { label: string; hint: string }[];
};

export const integrations: IntegrationDef[] = [
  {
    id: "tuya",
    name: "Tuya / Smart Life",
    description: "Geräte aus der Smart-Life-App schalten, dimmen und abgleichen.",
    icon: Cloud,
    tone: "accent",
    externalSource: "tuya",
    live: true,
    account: [
      { label: "Konto", value: "Tuya IoT Cloud" },
      { label: "Region", value: "Central Europe" },
      { label: "Zugang", value: "Access ID hinterlegt" },
    ],
    advanced: [
      { label: "Abgleich-Intervall", hint: "15 Sekunden (Live-Abgleich)" },
      { label: "Geräte automatisch importieren", hint: "Neue Geräte beim Abgleich übernehmen" },
    ],
  },
  {
    id: "tapo",
    name: "TP-Link Tapo & Kasa",
    description:
      "Kameras, Steckdosen sowie H100- und KH100-Steuerzentralen samt Sensoren und Thermostaten.",
    icon: Wifi,
    tone: "primary",
    externalSource: "tapo",
    live: true,
    account: [
      { label: "Konto", value: "Tapo / Kasa Cloud" },
      { label: "Zugang", value: "E-Mail und Passwort hinterlegt" },
      { label: "Steuerzentralen", value: "H100 und KH100 inkl. Untergeräte" },
      { label: "Schalten", value: "Cloud-Befehle von TP-Link gesperrt" },
    ],
    advanced: [
      { label: "Untergeräte abrufen", hint: "Sensoren und Thermostate über den Hub laden" },
      { label: "Kameras einbeziehen", hint: "TC-Modelle beim Abgleich übernehmen" },
    ],
  },
  {
    id: "dreame",
    name: "Dreame",
    description: "Staubsauger-Roboter mit Status, Saugkraft und Wartung.",
    icon: Boxes,
    tone: "accent",
    externalSource: "dreame",
    live: true,
    account: [
      { label: "Konto", value: "Dreame Cloud" },
      { label: "Gerät", value: "Staubi" },
      { label: "Standby", value: "Aufwecken per Wiederholversuch" },
    ],
    advanced: [
      { label: "Aufweck-Versuche", hint: "4 Versuche mit 1200 ms Pause" },
      { label: "Wartungswerte anzeigen", hint: "Bürste, Filter, Wischtuch" },
    ],
  },
  {
    id: "alexa",
    name: "Amazon Alexa",
    description: "Echo-Geräte über das eigene Amazon-Konto anbinden, abgleichen und steuern.",
    icon: Mic,
    tone: "primary",
    externalSource: "alexa",
    live: true,
    account: [
      { label: "Anmeldung", value: "Login with Amazon (OAuth 2.0)" },
      { label: "Geräte", value: "Echo Dot, Show, Pop, Studio, Flex, Auto, Hub, Input" },
      { label: "Steuerung", value: "Lautstärke und Stummschaltung" },
    ],
    advanced: [
      { label: "Automatischer Abgleich", hint: "Intervall in den Einstellungen" },
      { label: "Debugmodus", hint: "API-Aufrufe im Entwicklerbereich protokollieren" },
    ],
  },
  {
    id: "homeassistant",
    name: "Home Assistant",
    description:
      "Zentrale Plattform: Geräte, Räume, Sensoren und Live-Zustände aus Home Assistant.",
    icon: Server,
    tone: "primary",
    externalSource: "homeassistant",
    live: true,
    account: [
      { label: "Server", value: "Adresse im Einrichtungsassistenten" },
      { label: "Zugang", value: "Long Lived Access Token" },
      { label: "Live-Updates", value: "WebSocket (state_changed)" },
    ],
    advanced: [
      { label: "Bereiche übernehmen", hint: "Räume kommen aus den Home-Assistant-Areas" },
      {
        label: "Unterstützte Domains",
        hint: "light, switch, sensor, climate, cover, camera u. a.",
      },
    ],
  },
  {
    id: "mqtt",
    name: "MQTT",
    description: "Direkter Draht zu Brokern für eigene Sensoren und Aktoren.",
    icon: Network,
    tone: "muted",
    externalSource: null,
    live: false,
    account: [
      { label: "Broker", value: "mqtt://192.168.1.10:1883" },
      { label: "Benutzer", value: "Noch nicht hinterlegt" },
    ],
    advanced: [
      { label: "Basis-Topic", hint: "smarthome/#" },
      { label: "QoS", hint: "Stufe 1 (mindestens einmal)" },
    ],
  },
  {
    id: "hue",
    name: "Philips Hue",
    description: "Lampen und Lichtszenen der Hue-Bridge übernehmen.",
    icon: Lightbulb,
    tone: "muted",
    externalSource: null,
    live: false,
    account: [
      { label: "Bridge", value: "Noch nicht gefunden" },
      { label: "Konto", value: "Platzhalter" },
    ],
    advanced: [
      { label: "Lichtszenen importieren", hint: "Hue-Szenen als Szenen übernehmen" },
      { label: "Übergangszeit", hint: "400 ms" },
    ],
  },
  {
    id: "shelly",
    name: "Shelly",
    description: "Relais und Messsteckdosen inklusive Verbrauchswerten.",
    icon: Radio,
    tone: "muted",
    externalSource: null,
    live: false,
    account: [
      { label: "Konto", value: "Shelly Cloud" },
      { label: "Zugang", value: "Noch nicht hinterlegt" },
    ],
    advanced: [
      { label: "Verbrauch erfassen", hint: "Platzhalter für Energiewerte" },
      { label: "Lokale Steuerung", hint: "Direkt im Heimnetz schalten" },
    ],
  },
  {
    id: "zigbee",
    name: "Zigbee",
    description: "Zigbee-Geräte über einen Koordinator im Heimnetz einbinden.",
    icon: Boxes,
    tone: "muted",
    externalSource: null,
    live: false,
    account: [
      { label: "Koordinator", value: "Noch nicht verbunden" },
      { label: "Kanal", value: "Platzhalter" },
    ],
    advanced: [
      { label: "Anlernmodus", hint: "60 Sekunden Kopplungsfenster" },
      { label: "Netzwerkkarte", hint: "Platzhalter für Mesh-Ansicht" },
    ],
  },
];

export function getIntegration(id: string): IntegrationDef | undefined {
  return integrations.find((entry) => entry.id === id);
}

/** Geräte, die zu einer Integration gehören. */
export function devicesFor(integration: IntegrationDef, devices: Device[]): Device[] {
  if (!integration.externalSource) return [];
  return devices.filter((device) => device.external_source === integration.externalSource);
}

/** Verbunden = es liegen bereits importierte Geräte vor. */
export function isConnected(integration: IntegrationDef, devices: Device[]): boolean {
  return devicesFor(integration, devices).length > 0;
}

/** Letzte Synchronisierung = jüngstes `updated_at` der importierten Geräte. */
export function lastSync(integration: IntegrationDef, devices: Device[]): Date | null {
  const own = devicesFor(integration, devices);
  if (!own.length) return null;
  const newest = own.reduce((max, device) => {
    const value = new Date(device.updated_at).getTime();
    return value > max ? value : max;
  }, 0);
  return newest ? new Date(newest) : null;
}

export function formatSync(date: Date | null): string {
  if (!date) return "Noch nie";
  return date.toLocaleString("de-DE", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}
