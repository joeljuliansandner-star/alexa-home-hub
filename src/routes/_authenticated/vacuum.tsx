import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  Bot,
  BatteryMedium,
  Play,
  Pause,
  Home,
  Volume2,
  Loader2,
  Trash2,
  Droplets,
  Wind,
  RefreshCw,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { Progress } from "@/components/ui/progress";
import { controlVacuum, getVacuumStates } from "@/lib/tuya.functions";
import {
  cleanDreameRooms,
  controlDreameVacuum,
  getDreameVacuums,
  setDreameSetting,
} from "@/lib/dreame.functions";

export const Route = createFileRoute("/_authenticated/vacuum")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Staubsauger – Smarthome Control" },
      {
        name: "description",
        content:
          "Saugroboter steuern: Start, Pause, Ladestation, Saugkraft, Wassermenge und Räume.",
      },
      { property: "og:title", content: "Staubsauger – Smarthome Control" },
      {
        property: "og:description",
        content: "Dreame-Saugroboter komplett aus dem Panel steuern – wie in der App.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: VacuumPage,
});

const STATUS_LABEL: Record<string, string> = {
  standby: "Bereit",
  smart: "Reinigt",
  chargego: "Fährt zur Ladestation",
  charging: "Lädt",
  charge_done: "Vollständig geladen",
  cleaning: "Reinigt",
  paused: "Pausiert",
  sleep: "Schlafmodus",
  goto_charge: "Fährt zur Ladestation",
  zone_clean: "Bereich wird gereinigt",
  spot_clean: "Punktreinigung",
  mop_clean: "Wischt",
};

const SUCTION = [
  { value: 0, label: "Leise" },
  { value: 1, label: "Standard" },
  { value: 2, label: "Stark" },
  { value: 3, label: "Turbo" },
];

const WATER = [
  { value: 1, label: "Wenig" },
  { value: 2, label: "Mittel" },
  { value: 3, label: "Viel" },
];

type DreameVacuum = NonNullable<
  Awaited<ReturnType<typeof getDreameVacuums>>["vacuums"]
>[number];

function VacuumPage() {
  const qc = useQueryClient();
  const fetchStates = useServerFn(getVacuumStates);
  const sendCommand = useServerFn(controlVacuum);
  const fetchDreame = useServerFn(getDreameVacuums);
  const sendDreame = useServerFn(controlDreameVacuum);
  const changeSetting = useServerFn(setDreameSetting);
  const startRooms = useServerFn(cleanDreameRooms);

  const tuya = useQuery({
    queryKey: ["vacuums"],
    queryFn: () => fetchStates(),
    refetchInterval: 20_000,
    retry: false,
  });

  const dreame = useQuery({
    queryKey: ["dreame-vacuums"],
    queryFn: () => fetchDreame(),
    refetchInterval: 30_000,
    retry: false,
  });

  const invalidate = () => {
    setTimeout(() => {
      qc.invalidateQueries({ queryKey: ["vacuums"] });
      qc.invalidateQueries({ queryKey: ["dreame-vacuums"] });
    }, 2500);
  };

  const handleResult = (result: { ok: boolean; message: string }) => {
    if (result.ok) {
      toast.success(result.message);
      invalidate();
    } else {
      toast.error(result.message);
    }
  };

  const onError = (error: unknown) =>
    toast.error(error instanceof Error ? error.message : "Befehl fehlgeschlagen");

  const control = useMutation({
    mutationFn: (vars: {
      source: "tuya" | "dreame";
      id: string;
      action: "start" | "pause" | "dock" | "locate" | "emptyDustbin";
    }) =>
      vars.source === "tuya"
        ? sendCommand({
            data: {
              externalId: vars.id,
              action: vars.action === "emptyDustbin" ? "start" : vars.action,
            },
          })
        : sendDreame({ data: { did: vars.id, action: vars.action } }),
    onSuccess: handleResult,
    onError,
  });

  const setting = useMutation({
    mutationFn: (vars: {
      did: string;
      key:
        | "suction"
        | "water"
        | "volume"
        | "carpetBoost"
        | "childLock"
        | "resumeCleaning"
        | "autoEmpty"
        | "dndEnabled";
      value: number;
    }) => changeSetting({ data: vars }),
    onSuccess: handleResult,
    onError,
  });

  const rooms = useMutation({
    mutationFn: (vars: { did: string; roomIds: number[] }) => startRooms({ data: vars }),
    onSuccess: handleResult,
    onError,
  });

  const tuyaItems = tuya.data?.vacuums ?? [];
  const dreameItems = dreame.data?.vacuums ?? [];
  const isLoading = tuya.isLoading || dreame.isLoading;
  const dreameError = dreame.data?.error ?? null;

  const busy = control.isPending || setting.isPending || rooms.isPending;

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-semibold tracking-tight">Staubsauger</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Voller Zugriff wie in der App: Reinigung, Saugkraft, Wasser, Räume und Wartung.
          </p>
        </div>
        <Button
          variant="secondary"
          className="gap-2"
          onClick={() => {
            qc.invalidateQueries({ queryKey: ["dreame-vacuums"] });
            qc.invalidateQueries({ queryKey: ["vacuums"] });
          }}
        >
          <RefreshCw className="size-4" /> Aktualisieren
        </Button>
      </header>

      {dreameError && (
        <div className="panel p-4 text-sm text-muted-foreground">Dreame-Konto: {dreameError}</div>
      )}

      {isLoading ? (
        <div className="panel flex items-center gap-3 p-6 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" /> Saugroboter werden geladen …
        </div>
      ) : tuyaItems.length + dreameItems.length === 0 ? (
        <div className="panel space-y-3 p-6">
          <p className="text-sm font-medium">Noch kein Saugroboter gefunden</p>
          <p className="text-sm text-muted-foreground">
            Dein Dreame wird direkt über dein Dreamehome-Konto geladen. Falls hier nichts
            auftaucht, prüfe, ob der Sauger in der Dreamehome-App mit demselben Konto verbunden
            ist.
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {dreameItems.map((v) => (
            <DreameCard
              key={`dreame-${v.did}`}
              vacuum={v}
              busy={busy}
              onAction={(action) => control.mutate({ source: "dreame", id: v.did, action })}
              onSetting={(key, value) => setting.mutate({ did: v.did, key, value })}
              onRooms={(roomIds) => rooms.mutate({ did: v.did, roomIds })}
            />
          ))}

          {tuyaItems.map((v) => (
            <div key={`tuya-${v.id}`} className="panel space-y-5 p-5">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3">
                  <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-secondary text-foreground">
                    <Bot className="size-5" />
                  </span>
                  <div>
                    <p className="font-medium leading-tight">{v.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {v.model ?? "Saugroboter"} · {v.online ? "online" : "offline"}
                    </p>
                  </div>
                </div>
                {v.battery !== null && (
                  <span className="flex items-center gap-1.5 rounded-full bg-secondary px-2.5 py-1 text-xs font-medium">
                    <BatteryMedium className="size-3.5" />
                    {v.battery}%
                  </span>
                )}
              </div>
              <Stats
                status={v.status ? (STATUS_LABEL[v.status] ?? v.status) : null}
                area={v.cleanArea}
                time={v.cleanTime}
              />
              <div className="grid grid-cols-2 gap-2">
                <Button
                  className="gap-2"
                  disabled={busy}
                  onClick={() =>
                    control.mutate({ source: "tuya", id: v.externalId, action: "start" })
                  }
                >
                  <Play className="size-4" /> Start
                </Button>
                <Button
                  variant="secondary"
                  className="gap-2"
                  disabled={busy}
                  onClick={() =>
                    control.mutate({ source: "tuya", id: v.externalId, action: "pause" })
                  }
                >
                  <Pause className="size-4" /> Pause
                </Button>
                <Button
                  variant="secondary"
                  className="gap-2"
                  disabled={busy}
                  onClick={() =>
                    control.mutate({ source: "tuya", id: v.externalId, action: "dock" })
                  }
                >
                  <Home className="size-4" /> Ladestation
                </Button>
                <Button
                  variant="ghost"
                  className="gap-2"
                  disabled={busy}
                  onClick={() =>
                    control.mutate({ source: "tuya", id: v.externalId, action: "locate" })
                  }
                >
                  <Volume2 className="size-4" /> Suchen
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function Stats({
  status,
  area,
  time,
}: {
  status: string | null;
  area: number | null;
  time: number | null;
}) {
  return (
    <div className="grid grid-cols-3 gap-2 text-center">
      <div className="rounded-xl bg-secondary/60 px-2 py-2.5">
        <p className="text-[11px] text-muted-foreground">Status</p>
        <p className="mt-0.5 truncate text-sm font-medium">{status ?? "–"}</p>
      </div>
      <div className="rounded-xl bg-secondary/60 px-2 py-2.5">
        <p className="text-[11px] text-muted-foreground">Fläche</p>
        <p className="mt-0.5 text-sm font-medium">{area !== null ? `${area} m²` : "–"}</p>
      </div>
      <div className="rounded-xl bg-secondary/60 px-2 py-2.5">
        <p className="text-[11px] text-muted-foreground">Dauer</p>
        <p className="mt-0.5 text-sm font-medium">{time !== null ? `${time} min` : "–"}</p>
      </div>
    </div>
  );
}

function DreameCard({
  vacuum,
  busy,
  onAction,
  onSetting,
  onRooms,
}: {
  vacuum: DreameVacuum;
  busy: boolean;
  onAction: (action: "start" | "pause" | "dock" | "locate" | "emptyDustbin") => void;
  onSetting: (
    key:
      | "suction"
      | "water"
      | "volume"
      | "carpetBoost"
      | "childLock"
      | "resumeCleaning"
      | "autoEmpty"
      | "dndEnabled",
    value: number,
  ) => void;
  onRooms: (roomIds: number[]) => void;
}) {
  const [selectedRooms, setSelectedRooms] = useState<number[]>([]);

  const toggleRoom = (id: number) =>
    setSelectedRooms((prev) =>
      prev.includes(id) ? prev.filter((r) => r !== id) : [...prev, id],
    );

  return (
    <div className="panel space-y-6 p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-secondary text-foreground">
            <Bot className="size-5" />
          </span>
          <div>
            <p className="font-medium leading-tight">{vacuum.name}</p>
            <p className="text-xs text-muted-foreground">
              {vacuum.model} · {vacuum.reachable ? "erreichbar" : "im Standby / nicht erreichbar"}
            </p>
          </div>
        </div>
        {vacuum.battery !== null && (
          <span className="flex items-center gap-1.5 rounded-full bg-secondary px-2.5 py-1 text-xs font-medium">
            <BatteryMedium className="size-3.5" />
            {vacuum.battery}%
          </span>
        )}
      </div>

      <Stats status={vacuum.statusLabel} area={vacuum.cleanArea} time={vacuum.cleanTime} />

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        <Button className="gap-2" disabled={busy} onClick={() => onAction("start")}>
          <Play className="size-4" /> Start
        </Button>
        <Button
          variant="secondary"
          className="gap-2"
          disabled={busy}
          onClick={() => onAction("pause")}
        >
          <Pause className="size-4" /> Pause
        </Button>
        <Button
          variant="secondary"
          className="gap-2"
          disabled={busy}
          onClick={() => onAction("dock")}
        >
          <Home className="size-4" /> Ladestation
        </Button>
        <Button
          variant="secondary"
          className="gap-2"
          disabled={busy}
          onClick={() => onAction("emptyDustbin")}
        >
          <Trash2 className="size-4" /> Absaugen
        </Button>
        <Button variant="ghost" className="gap-2" disabled={busy} onClick={() => onAction("locate")}>
          <Volume2 className="size-4" /> Suchen
        </Button>
      </div>

      <section className="space-y-3">
        <p className="flex items-center gap-2 text-sm font-medium">
          <Wind className="size-4" /> Saugkraft
        </p>
        <div className="grid grid-cols-4 gap-2">
          {SUCTION.map((s) => (
            <Button
              key={s.value}
              size="sm"
              variant={vacuum.suction === s.value ? "default" : "secondary"}
              disabled={busy}
              onClick={() => onSetting("suction", s.value)}
            >
              {s.label}
            </Button>
          ))}
        </div>
      </section>

      <section className="space-y-3">
        <p className="flex items-center gap-2 text-sm font-medium">
          <Droplets className="size-4" /> Wassermenge
        </p>
        <div className="grid grid-cols-3 gap-2">
          {WATER.map((w) => (
            <Button
              key={w.value}
              size="sm"
              variant={vacuum.water === w.value ? "default" : "secondary"}
              disabled={busy}
              onClick={() => onSetting("water", w.value)}
            >
              {w.label}
            </Button>
          ))}
        </div>
      </section>

      <section className="space-y-3">
        <div className="flex items-center justify-between text-sm font-medium">
          <span className="flex items-center gap-2">
            <Volume2 className="size-4" /> Lautstärke
          </span>
          <span className="text-muted-foreground">{vacuum.volume ?? "–"}%</span>
        </div>
        <Slider
          value={[vacuum.volume ?? 50]}
          min={0}
          max={100}
          step={5}
          disabled={busy}
          onValueCommit={(value) => onSetting("volume", value[0] ?? 50)}
        />
      </section>

      <section className="grid gap-3 sm:grid-cols-2">
        <ToggleRow
          label="Teppich-Boost"
          checked={vacuum.carpetBoost === 1}
          disabled={busy}
          onChange={(next) => onSetting("carpetBoost", next ? 1 : 0)}
        />
        <ToggleRow
          label="Kindersicherung"
          checked={vacuum.childLock === 1}
          disabled={busy}
          onChange={(next) => onSetting("childLock", next ? 1 : 0)}
        />
        <ToggleRow
          label="Reinigung fortsetzen"
          checked={vacuum.resumeCleaning === 1}
          disabled={busy}
          onChange={(next) => onSetting("resumeCleaning", next ? 1 : 0)}
        />
        <ToggleRow
          label="Automatisch absaugen"
          checked={vacuum.autoEmpty === 1}
          disabled={busy}
          onChange={(next) => onSetting("autoEmpty", next ? 1 : 0)}
        />
        <ToggleRow
          label={`Nicht stören${vacuum.dndStart && vacuum.dndEnd ? ` (${vacuum.dndStart}–${vacuum.dndEnd})` : ""}`}
          checked={vacuum.dndEnabled === 1}
          disabled={busy}
          onChange={(next) => onSetting("dndEnabled", next ? 1 : 0)}
        />
      </section>

      <section className="space-y-3">
        <p className="text-sm font-medium">Räume reinigen</p>
        <p className="text-xs text-muted-foreground">
          Raumnummern entsprechen der Reihenfolge in der Dreame-Karte (1 = erster Raum).
        </p>
        <div className="flex flex-wrap gap-2">
          {[1, 2, 3, 4, 5, 6, 7, 8].map((id) => (
            <Button
              key={id}
              size="sm"
              variant={selectedRooms.includes(id) ? "default" : "secondary"}
              disabled={busy}
              onClick={() => toggleRoom(id)}
            >
              Raum {id}
            </Button>
          ))}
        </div>
        <Button
          className="gap-2"
          disabled={busy || selectedRooms.length === 0}
          onClick={() => onRooms(selectedRooms)}
        >
          <Play className="size-4" /> Ausgewählte Räume reinigen
        </Button>
      </section>

      <section className="space-y-3">
        <p className="text-sm font-medium">Verbrauchsmaterial</p>
        <Consumable label="Hauptbürste" value={vacuum.mainBrushLife} />
        <Consumable label="Seitenbürste" value={vacuum.sideBrushLife} />
        <Consumable label="Filter" value={vacuum.filterLife} />
      </section>
    </div>
  );
}

function ToggleRow({
  label,
  checked,
  disabled,
  onChange,
}: {
  label: string;
  checked: boolean;
  disabled: boolean;
  onChange: (next: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between rounded-xl bg-secondary/60 px-3 py-2.5">
      <span className="text-sm">{label}</span>
      <Switch checked={checked} disabled={disabled} onCheckedChange={onChange} />
    </div>
  );
}

function Consumable({ label, value }: { label: string; value: number | null }) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-xs">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-medium">{value !== null ? `${value}%` : "–"}</span>
      </div>
      <Progress value={value ?? 0} className="h-1.5" />
    </div>
  );
}
