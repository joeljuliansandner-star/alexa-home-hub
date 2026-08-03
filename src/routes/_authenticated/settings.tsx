import { createFileRoute } from "@tanstack/react-router";
import { AlertTriangle, Check, ExternalLink, Mic } from "lucide-react";

import { useDevices } from "@/lib/smarthome";

export const Route = createFileRoute("/_authenticated/settings")({
  head: () => ({
    meta: [
      { title: "Einstellungen & Alexa – Smarthome Control" },
      {
        name: "description",
        content: "Alexa-Zuordnung deiner Geräte und Anleitung zur echten Kopplung per Bridge.",
      },
      { property: "og:title", content: "Einstellungen & Alexa – Smarthome Control" },
      {
        property: "og:description",
        content: "So verbindest du das Adminpanel mit Alexa und deinen Geräten.",
      },
    ],
  }),
  component: SettingsPage,
});

function SettingsPage() {
  const devices = useDevices();
  const mapped = (devices.data ?? []).filter((d) => d.alexa_name);

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-3xl font-semibold">Einstellungen</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Alexa-Zuordnung und Anbindung an echte Hardware.
        </p>
      </header>

      <section className="panel space-y-4 p-6">
        <div className="flex items-start gap-3">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-destructive/15 text-destructive">
            <AlertTriangle className="size-5" />
          </span>
          <div>
            <h2 className="text-lg font-semibold">Status der Alexa-Verbindung</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Aktuell nicht verbunden. Amazon bietet keine offene Schnittstelle, mit der eine
              Website direkt deine Alexa-Geräte schalten kann. Es gibt zwei offizielle Wege:
            </p>
          </div>
        </div>

        <ol className="space-y-3 text-sm">
          <li className="rounded-xl border border-border p-4">
            <p className="font-medium">1. Bridge (empfohlen, schnellster Weg)</p>
            <p className="mt-1 text-muted-foreground">
              Eine Steuerzentrale wie Home Assistant, ioBroker oder openHAB spricht direkt mit
              deinen Geräten (Hue, Shelly, Tapo …) und stellt eine lokale REST-API bereit. Dieses
              Panel schaltet dann über diese API, Alexa hängt parallel an derselben Zentrale. Beide
              Wege steuern dieselben Geräte.
            </p>
          </li>
          <li className="rounded-xl border border-border p-4">
            <p className="font-medium">2. Eigener Alexa Smart Home Skill</p>
            <p className="mt-1 text-muted-foreground">
              Dieses Panel wird selbst zur Geräte-Quelle: Du legst im Amazon Developer Console einen
              Smart-Home-Skill mit Account Linking an, Alexa fragt dann diese App nach deinen
              Geräten. Aufwendiger, aber du sagst danach „Alexa, schalte das Wohnzimmerlicht ein"
              und der Befehl landet hier.
            </p>
          </li>
        </ol>

        <a
          href="https://www.home-assistant.io/integrations/alexa/"
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1.5 text-sm text-accent underline-offset-4 hover:underline"
        >
          Home Assistant + Alexa Anleitung <ExternalLink className="size-3.5" />
        </a>
      </section>

      <section className="panel space-y-4 p-6">
        <div className="flex items-start gap-3">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-accent/15 text-accent">
            <Mic className="size-5" />
          </span>
          <div>
            <h2 className="text-lg font-semibold">Alexa-Namen deiner Geräte</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Diese Namen sollten exakt so heißen wie in der Alexa-App – dann passt die Zuordnung,
              sobald die Verbindung steht.
            </p>
          </div>
        </div>

        {mapped.length ? (
          <ul className="divide-y divide-border">
            {mapped.map((device) => (
              <li key={device.id} className="flex items-center justify-between gap-4 py-2.5 text-sm">
                <span>{device.name}</span>
                <span className="flex items-center gap-2 text-muted-foreground">
                  <Check className="size-3.5 text-success" />
                  {device.alexa_name}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">
            Noch keine Alexa-Namen hinterlegt. Trage sie beim Anlegen eines Geräts ein.
          </p>
        )}
      </section>
    </div>
  );
}
