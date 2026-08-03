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

function VacuumPage() {
  const qc = useQueryClient();
  const fetchStates = useServerFn(getVacuumStates);
  const sendCommand = useServerFn(controlVacuum);

  const { data, isLoading } = useQuery({
    queryKey: ["vacuums"],
    queryFn: () => fetchStates(),
    refetchInterval: 20_000,
    retry: false,
  });

  const control = useMutation({
    mutationFn: (vars: { externalId: string; action: "start" | "pause" | "dock" | "locate" }) =>
      sendCommand({ data: vars }),
    onSuccess: (result) => {
      if (result.ok) {
        toast.success(result.message);
        setTimeout(() => qc.invalidateQueries({ queryKey: ["vacuums"] }), 2000);
      } else {
        toast.error(result.message);
      }
    },
    onError: (error) =>
      toast.error(error instanceof Error ? error.message : "Befehl fehlgeschlagen"),
  });

  const vacuums = data?.vacuums ?? [];

  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-display text-2xl font-semibold tracking-tight">Staubsauger</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Dein Saugroboter – starten, pausieren und zurück zur Ladestation schicken.
        </p>
      </header>

      {isLoading ? (
        <div className="panel flex items-center gap-3 p-6 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" /> Saugroboter werden geladen …
        </div>
      ) : vacuums.length === 0 ? (
        <div className="panel space-y-3 p-6">
          <p className="text-sm font-medium">Noch kein Saugroboter gefunden</p>
          <p className="text-sm text-muted-foreground">
            Verbinde den Dreame-Saugroboter in der Smart-Life-App mit deinem Konto und starte
            danach in den Einstellungen „Smart Life abgleichen“. Danach erscheint er hier
            automatisch.
          </p>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {vacuums.map((v) => (
            <div key={v.id} className="panel space-y-5 p-5">
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
                  <p className="mt-0.5 truncate text-sm font-medium">
                    {v.status ? (STATUS_LABEL[v.status] ?? v.status) : "–"}
                  </p>
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
                  onClick={() => control.mutate({ externalId: v.externalId, action: "start" })}
                >
                  <Play className="size-4" /> Start
                </Button>
                <Button
                  variant="secondary"
                  className="gap-2"
                  disabled={control.isPending}
                  onClick={() => control.mutate({ externalId: v.externalId, action: "pause" })}
                >
                  <Pause className="size-4" /> Pause
                </Button>
                <Button
                  variant="secondary"
                  className="gap-2"
                  disabled={control.isPending}
                  onClick={() => control.mutate({ externalId: v.externalId, action: "dock" })}
                >
                  <Home className="size-4" /> Ladestation
                </Button>
                <Button
                  variant="ghost"
                  className="gap-2"
                  disabled={control.isPending}
                  onClick={() => control.mutate({ externalId: v.externalId, action: "locate" })}
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
