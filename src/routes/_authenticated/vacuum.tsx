import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Bot, BatteryMedium, Play, Pause, Home, Volume2, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { controlVacuum, getVacuumStates } from "@/lib/tuya.functions";
import { controlDreameVacuum, getDreameVacuums } from "@/lib/dreame.functions";

export const Route = createFileRoute("/_authenticated/vacuum")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Staubsauger – Smarthome Control" },
      {
        name: "description",
        content: "Saugroboter starten, pausieren und zur Ladestation schicken.",
      },
      { property: "og:title", content: "Staubsauger – Smarthome Control" },
      {
        property: "og:description",
        content: "Dreame-Saugroboter direkt aus dem Panel steuern.",
      },
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

type Item = {
  key: string;
  source: "tuya" | "dreame";
  id: string;
  name: string;
  model: string | null;
  online: boolean;
  battery: number | null;
  statusText: string | null;
  cleanArea: number | null;
  cleanTime: number | null;
};

function VacuumPage() {
  const qc = useQueryClient();
  const fetchStates = useServerFn(getVacuumStates);
  const sendCommand = useServerFn(controlVacuum);
  const fetchDreame = useServerFn(getDreameVacuums);
  const sendDreame = useServerFn(controlDreameVacuum);

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
    }, 2000);
  };

  const handleResult = (result: { ok: boolean; message: string }) => {
    if (result.ok) {
      toast.success(result.message);
      invalidate();
    } else {
      toast.error(result.message);
    }
  };

  const control = useMutation({
    mutationFn: (vars: {
      source: "tuya" | "dreame";
      id: string;
      action: "start" | "pause" | "dock" | "locate";
    }) =>
      vars.source === "tuya"
        ? sendCommand({ data: { externalId: vars.id, action: vars.action } })
        : sendDreame({ data: { did: vars.id, action: vars.action } }),
    onSuccess: handleResult,
    onError: (error) =>
      toast.error(error instanceof Error ? error.message : "Befehl fehlgeschlagen"),
  });

  const items: Item[] = [
    ...(tuya.data?.vacuums ?? []).map((v) => ({
      key: `tuya-${v.id}`,
      source: "tuya" as const,
      id: v.externalId,
      name: v.name,
      model: v.model ?? null,
      online: Boolean(v.online),
      battery: v.battery,
      statusText: v.status ? (STATUS_LABEL[v.status] ?? v.status) : null,
      cleanArea: v.cleanArea,
      cleanTime: v.cleanTime,
    })),
    ...(dreame.data?.vacuums ?? []).map((v) => ({
      key: `dreame-${v.did}`,
      source: "dreame" as const,
      id: v.did,
      name: v.name,
      model: v.model,
      online: v.online,
      battery: v.battery,
      statusText: v.statusLabel,
      cleanArea: v.cleanArea,
      cleanTime: v.cleanTime,
    })),
  ];

  const isLoading = tuya.isLoading || dreame.isLoading;
  const dreameError = dreame.data?.error ?? null;

  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-display text-2xl font-semibold tracking-tight">Staubsauger</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Dein Saugroboter – starten, pausieren und zurück zur Ladestation schicken.
        </p>
      </header>

      {dreameError && (
        <div className="panel p-4 text-sm text-muted-foreground">
          Dreame-Konto: {dreameError}
        </div>
      )}

      {isLoading ? (
        <div className="panel flex items-center gap-3 p-6 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" /> Saugroboter werden geladen …
        </div>
      ) : items.length === 0 ? (
        <div className="panel space-y-3 p-6">
          <p className="text-sm font-medium">Noch kein Saugroboter gefunden</p>
          <p className="text-sm text-muted-foreground">
            Dein Dreame wird direkt über dein Dreamehome-Konto geladen. Falls hier nichts
            auftaucht, prüfe, ob der Sauger in der Dreamehome-App mit demselben Konto verbunden
            ist.
          </p>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {items.map((v) => (
            <div key={v.key} className="panel space-y-5 p-5">
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

              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="rounded-xl bg-secondary/60 px-2 py-2.5">
                  <p className="text-[11px] text-muted-foreground">Status</p>
                  <p className="mt-0.5 truncate text-sm font-medium">{v.statusText ?? "–"}</p>
                </div>
                <div className="rounded-xl bg-secondary/60 px-2 py-2.5">
                  <p className="text-[11px] text-muted-foreground">Fläche</p>
                  <p className="mt-0.5 text-sm font-medium">
                    {v.cleanArea !== null ? `${v.cleanArea} m²` : "–"}
                  </p>
                </div>
                <div className="rounded-xl bg-secondary/60 px-2 py-2.5">
                  <p className="text-[11px] text-muted-foreground">Dauer</p>
                  <p className="mt-0.5 text-sm font-medium">
                    {v.cleanTime !== null ? `${v.cleanTime} min` : "–"}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <Button
                  className="gap-2"
                  disabled={control.isPending}
                  onClick={() => control.mutate({ source: v.source, id: v.id, action: "start" })}
                >
                  <Play className="size-4" /> Start
                </Button>
                <Button
                  variant="secondary"
                  className="gap-2"
                  disabled={control.isPending}
                  onClick={() => control.mutate({ source: v.source, id: v.id, action: "pause" })}
                >
                  <Pause className="size-4" /> Pause
                </Button>
                <Button
                  variant="secondary"
                  className="gap-2"
                  disabled={control.isPending}
                  onClick={() => control.mutate({ source: v.source, id: v.id, action: "dock" })}
                >
                  <Home className="size-4" /> Ladestation
                </Button>
                <Button
                  variant="ghost"
                  className="gap-2"
                  disabled={control.isPending}
                  onClick={() => control.mutate({ source: v.source, id: v.id, action: "locate" })}
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

