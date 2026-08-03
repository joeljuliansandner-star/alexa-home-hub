import { createFileRoute } from "@tanstack/react-router";
import { useMutation } from "@tanstack/react-query";
import { useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  Check,
  ExternalLink,
  Mic,
  RefreshCw,
  Wifi,
  WifiOff,
  Zap,
} from "lucide-react";
import { toast } from "sonner";

import { useDevices } from "@/lib/smarthome";
import { syncTapoDevices } from "@/lib/tapo.functions";
import { syncTuyaDevices } from "@/lib/tuya.functions";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/settings")({
  head: () => ({
    meta: [
      { title: "Einstellungen & Tapo – Smarthome Control" },
      {
        name: "description",
        content: "Tapo-Konto abgleichen, Alexa-Namen pflegen und Geräte-Status prüfen.",
      },
      { property: "og:title", content: "Einstellungen & Tapo – Smarthome Control" },
      {
        property: "og:description",
        content: "So verbindest du das Adminpanel mit deinen Tapo-Geräten und Alexa.",
      },
    ],
  }),
  component: SettingsPage,
});

function SettingsPage() {
  const devices = useDevices();
  const qc = useQueryClient();
  const tapoDevices = (devices.data ?? []).filter((d) => d.external_source === "tapo");
  const tuyaDevices = (devices.data ?? []).filter((d) => d.external_source === "tuya");
  const mapped = (devices.data ?? []).filter((d) => d.alexa_name);

  const sync = useMutation({
    mutationFn: () => syncTapoDevices(),
    onSuccess: (result) => {
      qc.invalidateQueries();
      toast.success(`${result.imported} Tapo-Geräte übernommen (${result.online} online)`);
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const syncTuya = useMutation({
    mutationFn: () => syncTuyaDevices(),
    onSuccess: (result) => {
      qc.invalidateQueries();
      toast.success(`${result.imported} Smart-Life-Geräte und ${result.rooms} Räume übernommen (${result.online} online)`);
    },
    onError: (error: Error) => toast.error(error.message),
  });

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-3xl font-semibold">Einstellungen</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Smart Life, Tapo, Geräte-Abgleich und Alexa-Zuordnung.
        </p>
      </header>

      <section className="panel space-y-4 p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-accent/15 text-accent">
              <Zap className="size-5" />
            </span>
            <div>
              <h2 className="text-lg font-semibold">Smart Life / Tuya</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Über die offizielle Tuya-Cloud. Diese Geräte lassen sich hier wirklich schalten und
                dimmen – ganz ohne Zusatzhardware.
              </p>
            </div>
          </div>
          <Button
            className="gap-2"
            disabled={syncTuya.isPending}
            onClick={() => syncTuya.mutate()}
          >
            <RefreshCw className={syncTuya.isPending ? "size-4 animate-spin" : "size-4"} />
            Smart Life abgleichen
          </Button>
        </div>

        {tuyaDevices.length ? (
          <ul className="divide-y divide-border">
            {tuyaDevices.map((device) => (
              <li key={device.id} className="flex items-center justify-between gap-4 py-2.5 text-sm">
                <span className="min-w-0">
                  <span className="block truncate">{device.name}</span>
                  <span className="text-xs text-muted-foreground">{device.model}</span>
                </span>
                <span
                  className={
                    device.is_online
                      ? "flex items-center gap-1.5 text-xs text-success"
                      : "flex items-center gap-1.5 text-xs text-muted-foreground"
                  }
                >
                  {device.is_online ? <Wifi className="size-3.5" /> : <WifiOff className="size-3.5" />}
                  {device.is_online ? "online" : "offline"}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">
            Noch kein Abgleich. Sobald Access ID und Secret aus dem Tuya-Portal hinterlegt sind,
            holt „Smart Life abgleichen" alle Geräte hierher.
          </p>
        )}
      </section>


      <section className="panel space-y-4 p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-success/15 text-success">
              <Wifi className="size-5" />
            </span>
            <div>
              <h2 className="text-lg font-semibold">Tapo-Konto verbunden</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Deine TP-Link-Zugangsdaten sind sicher hinterlegt. Der Abgleich holt alle Geräte
                aus deinem Tapo-Konto in dieses Panel.
              </p>
            </div>
          </div>
          <Button className="gap-2" disabled={sync.isPending} onClick={() => sync.mutate()}>
            <RefreshCw className={sync.isPending ? "size-4 animate-spin" : "size-4"} />
            Geräte abgleichen
          </Button>
        </div>

        {tapoDevices.length ? (
          <ul className="divide-y divide-border">
            {tapoDevices.map((device) => (
              <li key={device.id} className="flex items-center justify-between gap-4 py-2.5 text-sm">
                <span className="min-w-0">
                  <span className="block truncate">{device.name}</span>
                  <span className="text-xs text-muted-foreground">{device.model}</span>
                </span>
                <span
                  className={
                    device.is_online
                      ? "flex items-center gap-1.5 text-xs text-success"
                      : "flex items-center gap-1.5 text-xs text-muted-foreground"
                  }
                >
                  {device.is_online ? <Wifi className="size-3.5" /> : <WifiOff className="size-3.5" />}
                  {device.is_online ? "online" : "nur lokal erreichbar"}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">
            Noch kein Abgleich durchgeführt. Klick auf „Geräte abgleichen".
          </p>
        )}
      </section>

      <section className="panel space-y-4 p-6">
        <div className="flex items-start gap-3">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-destructive/15 text-destructive">
            <AlertTriangle className="size-5" />
          </span>
          <div className="space-y-3">
            <div>
              <h2 className="text-lg font-semibold">Warum Schalten noch nicht klappt</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Dein Konto enthält zwei Steuerzentralen (H100 für Sensoren, KH100 für Thermostate)
                und eine Kamera. TP-Link erlaubt für Tapo-Geräte <strong>keine</strong> Befehle über
                die Cloud – sie nehmen Schaltbefehle nur aus deinem eigenen WLAN entgegen. Die
                Geräteliste und der Status kommen an, der Schaltbefehl wird von Tapo mit „Device is
                offline" abgelehnt.
              </p>
            </div>
            <div>
              <p className="text-sm font-medium">Was hilft:</p>
              <ul className="mt-1 list-disc space-y-1 pl-5 text-sm text-muted-foreground">
                <li>
                  <strong>Tapo-Steckdosen/-Lampen (P110, L530)</strong> lassen sich mit einer kleinen
                  Bridge im Heimnetz direkt schalten – ein Raspberry Pi mit Home Assistant reicht.
                </li>
                <li>
                  <strong>Ohne Zusatzgerät</strong> bleibt das Panel deine Zentrale für Räume,
                  Szenen, Automationen und Alexa-Namen; geschaltet wird per Alexa-Sprachbefehl.
                </li>
              </ul>
            </div>
            <a
              href="https://www.home-assistant.io/integrations/tplink/"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 text-sm text-accent underline-offset-4 hover:underline"
            >
              Home Assistant + Tapo Anleitung <ExternalLink className="size-3.5" />
            </a>
          </div>
        </div>
      </section>

      <section className="panel space-y-4 p-6">
        <div className="flex items-start gap-3">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-accent/15 text-accent">
            <Mic className="size-5" />
          </span>
          <div>
            <h2 className="text-lg font-semibold">Alexa-Namen deiner Geräte</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Diese Namen sollten exakt so heißen wie in der Alexa-App.
            </p>
          </div>
        </div>

        {mapped.length ? (
          <ul className="divide-y divide-border">
            {mapped.map((device) => (
              <li key={device.id} className="flex items-center justify-between gap-4 py-2.5 text-sm">
                <span className="truncate">{device.name}</span>
                <span className="flex items-center gap-2 text-muted-foreground">
                  <Check className="size-3.5 text-success" />
                  {device.alexa_name}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">Noch keine Alexa-Namen hinterlegt.</p>
        )}
      </section>
    </div>
  );
}
