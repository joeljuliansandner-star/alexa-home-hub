import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import {
  AlertTriangle,
  Bell,
  Check,
  Download,
  ExternalLink,
  Fingerprint,
  Info,
  KeyRound,
  LayoutDashboard,
  LogOut,
  Mail,
  Mic,
  Palette,
  RefreshCw,
  Save,
  ShieldCheck,
  Upload,
  User,
  Wifi,
  WifiOff,
  Zap,
  DoorOpen,
} from "lucide-react";
import { toast } from "sonner";

import { useDevices, useRooms } from "@/lib/smarthome";
import { syncTapoDevices } from "@/lib/tapo.functions";
import { syncTuyaDevices } from "@/lib/tuya.functions";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  PageHeader,
  Panel,
  Section,
  IconTile,
  EntryList,
  EntryRow,
  grids,
  stacks,
} from "@/components/kit";

export const Route = createFileRoute("/_authenticated/settings")({
  head: () => ({
    meta: [
      { title: "Einstellungen – Smarthome Control" },
      {
        name: "description",
        content:
          "Profil, Smart Home, Benachrichtigungen, Darstellung, Sicherheit und Backup zentral verwalten.",
      },
      { property: "og:title", content: "Einstellungen – Smarthome Control" },
      {
        property: "og:description",
        content: "Alle Einstellungen deines Smarthome-Panels an einem Ort.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: SettingsPage,
});

/** Beschriftete Einstellungszeile – Label links, Steuerelement rechts. */
function SettingRow({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between sm:gap-6">
      <div className="min-w-0">
        <p className="text-sm font-medium">{label}</p>
        {hint ? <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p> : null}
      </div>
      <div className="shrink-0 sm:w-64">{children}</div>
    </div>
  );
}

const ACCENTS = [
  { id: "orange", label: "Orange", className: "bg-primary" },
  { id: "teal", label: "Türkis", className: "bg-accent" },
  { id: "green", label: "Grün", className: "bg-success" },
  { id: "red", label: "Rot", className: "bg-destructive" },
] as const;

function SettingsPage() {
  const devices = useDevices();
  const rooms = useRooms();
  const qc = useQueryClient();

  const tapoDevices = (devices.data ?? []).filter((d) => d.external_source === "tapo");
  const tuyaDevices = (devices.data ?? []).filter((d) => d.external_source === "tuya");
  const mapped = (devices.data ?? []).filter((d) => d.alexa_name);

  // Platzhalter-Zustände – später an echte Speicherung anbindbar
  const [username, setUsername] = useState("Joel");
  const [language, setLanguage] = useState("de");
  const [timezone, setTimezone] = useState("Europe/Berlin");
  const [defaultRoom, setDefaultRoom] = useState("none");
  const [defaultFavorite, setDefaultFavorite] = useState(false);
  const [push, setPush] = useState(true);
  const [emailNotify, setEmailNotify] = useState(false);
  const [hints, setHints] = useState(true);
  const [darkMode, setDarkMode] = useState(true);
  const [accent, setAccent] = useState<string>("orange");
  const [fontSize, setFontSize] = useState([100]);
  const [animations, setAnimations] = useState(true);
  const [pin, setPin] = useState("");
  const [biometric, setBiometric] = useState(false);

  const soon = () => toast.info("Platzhalter – Funktion folgt später.");

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
      toast.success(
        `${result.imported} Smart-Life-Geräte und ${result.rooms} Räume übernommen (${result.online} online)`,
      );
    },
    onError: (error: Error) => toast.error(error.message),
  });

  return (
    <div className={stacks.page}>
      <PageHeader
        title="Einstellungen"
        description="Profil, Smart Home, Benachrichtigungen, Darstellung, Sicherheit, Backup und Info."
      />

      {/* Profil */}
      <Section title="Profil">
        <Panel className="space-y-1">
          <div className="flex items-center gap-3 pb-3">
            <Avatar className="size-12">
              <AvatarFallback className="bg-secondary text-sm">
                {username.slice(0, 2).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0">
              <p className="truncate text-sm font-medium">{username}</p>
              <p className="text-xs text-muted-foreground">Profilbild (Platzhalter)</p>
            </div>
            <Button variant="secondary" size="sm" className="ml-auto gap-2" onClick={soon}>
              <User className="size-4" /> Ändern
            </Button>
          </div>

          <div className="divide-y divide-border">
            <SettingRow label="Benutzername" hint="Wird in der Begrüßung angezeigt.">
              <Input value={username} onChange={(e) => setUsername(e.target.value)} />
            </SettingRow>
            <SettingRow label="Sprache">
              <Select value={language} onValueChange={setLanguage}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="de">Deutsch</SelectItem>
                  <SelectItem value="en">English</SelectItem>
                </SelectContent>
              </Select>
            </SettingRow>
            <SettingRow label="Zeitzone">
              <Select value={timezone} onValueChange={setTimezone}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Europe/Berlin">Europe/Berlin</SelectItem>
                  <SelectItem value="Europe/London">Europe/London</SelectItem>
                  <SelectItem value="UTC">UTC</SelectItem>
                </SelectContent>
              </Select>
            </SettingRow>
          </div>

          <div className="pt-3">
            <Button className="gap-2" onClick={soon}>
              <Save className="size-4" /> Profil speichern
            </Button>
          </div>
        </Panel>
      </Section>

      {/* Smart Home */}
      <Section title="Smart Home">
        <div className={grids.pairs}>
          <Panel className="flex items-center gap-3" hover as="article">
            <IconTile icon={LayoutDashboard} tone="primary" />
            <div className="min-w-0">
              <p className="text-sm font-medium">Geräte</p>
              <p className="text-xs text-muted-foreground">
                {devices.data?.length ?? 0} verbunden
              </p>
            </div>
            <Button asChild variant="secondary" size="sm" className="ml-auto">
              <Link to="/dashboard">Öffnen</Link>
            </Button>
          </Panel>
          <Panel className="flex items-center gap-3" hover as="article">
            <IconTile icon={DoorOpen} tone="accent" />
            <div className="min-w-0">
              <p className="text-sm font-medium">Räume</p>
              <p className="text-xs text-muted-foreground">{rooms.data?.length ?? 0} angelegt</p>
            </div>
            <Button asChild variant="secondary" size="sm" className="ml-auto">
              <Link to="/rooms">Öffnen</Link>
            </Button>
          </Panel>
        </div>

        <Panel className="space-y-1">
          <p className="text-sm font-semibold">Standards für neue Geräte</p>
          <div className="divide-y divide-border">
            <SettingRow label="Standardraum" hint="Raum für neu erkannte Geräte.">
              <Select value={defaultRoom} onValueChange={setDefaultRoom}>
                <SelectTrigger>
                  <SelectValue placeholder="Kein Raum" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Kein Raum</SelectItem>
                  {(rooms.data ?? []).map((room) => (
                    <SelectItem key={room.id} value={room.id}>
                      {room.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </SettingRow>
            <SettingRow label="Automatisch als Favorit" hint="Neue Geräte direkt markieren.">
              <div className="flex sm:justify-end">
                <Switch checked={defaultFavorite} onCheckedChange={setDefaultFavorite} />
              </div>
            </SettingRow>
          </div>
        </Panel>

        {/* Smart Life / Tuya */}
        <Panel className="space-y-4">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="flex items-start gap-3">
              <IconTile icon={Zap} tone="accent" />
              <div>
                <h3 className="text-base font-semibold">Smart Life / Tuya</h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  Über die offizielle Tuya-Cloud – Geräte lassen sich hier schalten und dimmen.
                </p>
              </div>
            </div>
            <Button className="gap-2" disabled={syncTuya.isPending} onClick={() => syncTuya.mutate()}>
              <RefreshCw className={syncTuya.isPending ? "size-4 animate-spin" : "size-4"} />
              Smart Life abgleichen
            </Button>
          </div>

          {tuyaDevices.length ? (
            <EntryList>
              {tuyaDevices.map((device) => (
                <EntryRow
                  key={device.id}
                  meta={
                    <span className="flex items-center gap-1.5">
                      {device.is_online ? (
                        <Wifi className="size-3.5 text-success" />
                      ) : (
                        <WifiOff className="size-3.5" />
                      )}
                      {device.is_online ? "online" : "offline"}
                    </span>
                  }
                >
                  {device.name}
                </EntryRow>
              ))}
            </EntryList>
          ) : (
            <p className="text-sm text-muted-foreground">
              Noch kein Abgleich. „Smart Life abgleichen" holt alle Geräte hierher.
            </p>
          )}
        </Panel>

        {/* Tapo */}
        <Panel className="space-y-4">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="flex items-start gap-3">
              <IconTile icon={Wifi} tone="primary" />
              <div>
                <h3 className="text-base font-semibold">Tapo-Konto verbunden</h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  Der Abgleich holt alle Geräte aus deinem Tapo-Konto in dieses Panel.
                </p>
              </div>
            </div>
            <Button className="gap-2" disabled={sync.isPending} onClick={() => sync.mutate()}>
              <RefreshCw className={sync.isPending ? "size-4 animate-spin" : "size-4"} />
              Geräte abgleichen
            </Button>
          </div>

          {tapoDevices.length ? (
            <EntryList>
              {tapoDevices.map((device) => (
                <EntryRow
                  key={device.id}
                  meta={
                    <span className="flex items-center gap-1.5">
                      {device.is_online ? (
                        <Wifi className="size-3.5 text-success" />
                      ) : (
                        <WifiOff className="size-3.5" />
                      )}
                      {device.is_online ? "online" : "nur lokal erreichbar"}
                    </span>
                  }
                >
                  {device.name}
                </EntryRow>
              ))}
            </EntryList>
          ) : (
            <p className="text-sm text-muted-foreground">
              Noch kein Abgleich durchgeführt. Klick auf „Geräte abgleichen".
            </p>
          )}
        </Panel>

        {/* Hinweis Tapo-Schalten */}
        <Panel className="flex items-start gap-3">
          <IconTile icon={AlertTriangle} tone="destructive" />
          <div className="space-y-3">
            <div>
              <h3 className="text-base font-semibold">Warum Schalten bei Tapo nicht klappt</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                TP-Link erlaubt für Tapo-Geräte keine Befehle über die Cloud – Status kommt an, der
                Schaltbefehl wird abgelehnt. Eine Bridge im Heimnetz (z. B. Home Assistant) löst das.
              </p>
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
        </Panel>

        {/* Alexa-Namen */}
        <Panel className="space-y-4">
          <div className="flex items-start gap-3">
            <IconTile icon={Mic} tone="accent" />
            <div>
              <h3 className="text-base font-semibold">Alexa-Namen deiner Geräte</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                Diese Namen sollten exakt so heißen wie in der Alexa-App.
              </p>
            </div>
          </div>

          {mapped.length ? (
            <EntryList>
              {mapped.map((device) => (
                <EntryRow
                  key={device.id}
                  meta={
                    <span className="flex items-center gap-2">
                      <Check className="size-3.5 text-success" />
                      {device.alexa_name}
                    </span>
                  }
                >
                  {device.name}
                </EntryRow>
              ))}
            </EntryList>
          ) : (
            <p className="text-sm text-muted-foreground">Noch keine Alexa-Namen hinterlegt.</p>
          )}
        </Panel>
      </Section>

      {/* Benachrichtigungen */}
      <Section title="Benachrichtigungen">
        <Panel className="space-y-1">
          <div className="flex items-start gap-3 pb-2">
            <IconTile icon={Bell} tone="primary" />
            <p className="pt-2 text-sm text-muted-foreground">
              Steuert, worüber dich das Panel informiert (Platzhalter).
            </p>
          </div>
          <div className="divide-y divide-border">
            <SettingRow label="Push-Mitteilungen" hint="Meldungen direkt aufs iPhone.">
              <div className="flex sm:justify-end">
                <Switch checked={push} onCheckedChange={setPush} />
              </div>
            </SettingRow>
            <SettingRow label="E-Mail" hint="Zusammenfassungen per Mail.">
              <div className="flex items-center gap-2 sm:justify-end">
                <Mail className="size-4 text-muted-foreground" />
                <Switch checked={emailNotify} onCheckedChange={setEmailNotify} />
              </div>
            </SettingRow>
            <SettingRow label="Hinweise" hint="Tipps und Systemmeldungen im Panel.">
              <div className="flex sm:justify-end">
                <Switch checked={hints} onCheckedChange={setHints} />
              </div>
            </SettingRow>
          </div>
        </Panel>
      </Section>

      {/* Darstellung */}
      <Section title="Darstellung">
        <Panel className="space-y-1">
          <div className="flex items-start gap-3 pb-2">
            <IconTile icon={Palette} tone="accent" />
            <p className="pt-2 text-sm text-muted-foreground">
              Aussehen des Panels – aktuell als Vorschau ohne Speicherung.
            </p>
          </div>
          <div className="divide-y divide-border">
            <SettingRow label="Dark Mode" hint="Standard für dieses Panel.">
              <div className="flex sm:justify-end">
                <Switch checked={darkMode} onCheckedChange={setDarkMode} />
              </div>
            </SettingRow>
            <SettingRow label="Akzentfarbe">
              <div className="flex gap-2 sm:justify-end">
                {ACCENTS.map((tone) => (
                  <button
                    key={tone.id}
                    type="button"
                    aria-label={tone.label}
                    onClick={() => setAccent(tone.id)}
                    className={`size-8 rounded-full transition-transform duration-300 ${tone.className} ${
                      accent === tone.id ? "ring-2 ring-foreground ring-offset-2 ring-offset-background scale-105" : ""
                    }`}
                  />
                ))}
              </div>
            </SettingRow>
            <SettingRow label="Schriftgröße" hint={`${fontSize[0]} %`}>
              <Slider value={fontSize} onValueChange={setFontSize} min={85} max={130} step={5} />
            </SettingRow>
            <SettingRow label="Animationen" hint="Weiche Übergänge und Effekte.">
              <div className="flex sm:justify-end">
                <Switch checked={animations} onCheckedChange={setAnimations} />
              </div>
            </SettingRow>
          </div>
        </Panel>
      </Section>

      {/* Sicherheit */}
      <Section title="Sicherheit">
        <Panel className="space-y-1">
          <div className="flex items-start gap-3 pb-2">
            <IconTile icon={ShieldCheck} tone="primary" />
            <p className="pt-2 text-sm text-muted-foreground">
              Zusätzlicher Schutz für dieses Panel (Platzhalter).
            </p>
          </div>
          <div className="divide-y divide-border">
            <SettingRow label="PIN" hint="Vierstellig, beim Öffnen abfragen.">
              <div className="flex gap-2">
                <Input
                  value={pin}
                  onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 4))}
                  inputMode="numeric"
                  placeholder="••••"
                />
                <Button variant="secondary" size="icon" onClick={soon} aria-label="PIN speichern">
                  <KeyRound className="size-4" />
                </Button>
              </div>
            </SettingRow>
            <SettingRow label="Biometrische Anmeldung" hint="Face ID / Touch ID – folgt später.">
              <div className="flex items-center gap-2 sm:justify-end">
                <Fingerprint className="size-4 text-muted-foreground" />
                <Switch checked={biometric} onCheckedChange={setBiometric} />
              </div>
            </SettingRow>
            <SettingRow label="Sitzung beenden" hint="Auf diesem Gerät abmelden.">
              <div className="flex sm:justify-end">
                <Button
                  variant="secondary"
                  className="gap-2"
                  onClick={() => supabase.auth.signOut()}
                >
                  <LogOut className="size-4" /> Abmelden
                </Button>
              </div>
            </SettingRow>
          </div>
        </Panel>
      </Section>

      {/* Backup */}
      <Section title="Backup">
        <div className={grids.cards}>
          <Panel className="flex flex-col gap-3" hover as="article">
            <IconTile icon={Save} tone="primary" />
            <div>
              <p className="text-sm font-medium">Backup erstellen</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Räume, Geräte und Szenen sichern.
              </p>
            </div>
            <Button variant="secondary" className="mt-auto" onClick={soon}>
              Sichern
            </Button>
          </Panel>
          <Panel className="flex flex-col gap-3" hover as="article">
            <IconTile icon={Upload} tone="accent" />
            <div>
              <p className="text-sm font-medium">Backup wiederherstellen</p>
              <p className="mt-1 text-xs text-muted-foreground">Sicherung einspielen.</p>
            </div>
            <Button variant="secondary" className="mt-auto" onClick={soon}>
              Wiederherstellen
            </Button>
          </Panel>
          <Panel className="flex flex-col gap-3" hover as="article">
            <IconTile icon={Download} tone="muted" />
            <div>
              <p className="text-sm font-medium">Export der Einstellungen</p>
              <p className="mt-1 text-xs text-muted-foreground">Als Datei herunterladen.</p>
            </div>
            <Button variant="secondary" className="mt-auto" onClick={soon}>
              Exportieren
            </Button>
          </Panel>
        </div>
      </Section>

      {/* Über */}
      <Section title="Über">
        <Panel className="space-y-4">
          <div className="flex items-start gap-3">
            <IconTile icon={Info} tone="muted" />
            <div>
              <h3 className="text-base font-semibold">Smarthome Control</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                Persönliches Adminpanel für Smart Life, Tapo und Dreame.
              </p>
            </div>
          </div>
          <EntryList>
            <EntryRow meta="1.0.0">App-Version</EntryRow>
            <EntryRow meta="2026.08.04">Build-Version</EntryRow>
            <EntryRow meta="MIT / Open Source Komponenten">Lizenzinformationen</EntryRow>
          </EntryList>
          <p className="text-xs text-muted-foreground">powered by Joel-Julian Sandner</p>
        </Panel>
      </Section>
    </div>
  );
}
