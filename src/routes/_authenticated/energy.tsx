import { createFileRoute } from "@tanstack/react-router";
import { useMemo } from "react";
import { BatteryCharging, Gauge, TrendingUp, Zap } from "lucide-react";

import {
  EmptyState,
  IconTile,
  PageHeader,
  Panel,
  Section,
  StatTile,
  grids,
  stacks,
} from "@/components/kit";
import { cn } from "@/lib/utils";
import { energySummary, friendlyName, numericState, selectSensors, unitOf } from "@/lib/os/insights";
import { useHaEntities } from "@/services/homeAssistant.hooks";

export const Route = createFileRoute("/_authenticated/energy")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Energie – Smarthome Control" },
      {
        name: "description",
        content:
          "Aktueller Stromverbrauch, Tages- und Zählerwerte sowie die größten Verbraucher aus Home Assistant.",
      },
      { property: "og:title", content: "Energie – Smarthome Control" },
      {
        property: "og:description",
        content: "Verbrauch live, Top-Verbraucher und Energiezähler auf einen Blick.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: EnergyPage,
});

function EnergyPage() {
  const entities = useHaEntities();
  const summary = useMemo(() => energySummary(entities), [entities]);

  const counters = useMemo(
    () =>
      selectSensors(entities, "energy")
        .map((entity) => ({ entity, value: numericState(entity) ?? 0, unit: unitOf(entity) }))
        .sort((a, b) => b.value - a.value)
        .slice(0, 12),
    [entities],
  );

  const maxPower = summary.power[0]?.value ?? 0;

  return (
    <div className={stacks.page}>
      <PageHeader
        title="Energie"
        description={
          summary.hasData
            ? `${summary.power.length} Leistungssensoren · ${summary.energySensors.length} Zähler`
            : "Es wurden noch keine Energiedaten in Home Assistant gefunden"
        }
      />

      {!summary.hasData ? (
        <EmptyState
          variant="card"
          title="Keine Energiedaten"
          description="Sobald Home Assistant Sensoren mit der Geräteklasse „power“ oder „energy“ liefert (z. B. smarte Steckdosen oder ein Stromzähler), erscheinen sie hier automatisch."
        />
      ) : (
        <>
          <div className={grids.stats}>
            <StatTile
              label="Aktuell"
              value={`${Math.round(summary.totalPower)} W`}
              tone="primary"
            />
            <StatTile
              label="Heute"
              value={summary.totalToday ? `${summary.totalToday.toFixed(2)} kWh` : "–"}
              tone="accent"
            />
            <StatTile label="Sensoren" value={String(summary.power.length)} />
            <StatTile label="Zähler" value={String(summary.energySensors.length)} />
          </div>

          <Section title="Top-Verbraucher (live)">
            {summary.power.length ? (
              <Panel className="space-y-3 p-4">
                {summary.power.slice(0, 10).map((item) => (
                  <div key={item.entity.entity_id} className="space-y-1.5">
                    <div className="flex items-center justify-between gap-3 text-sm">
                      <span className="truncate">{friendlyName(item.entity)}</span>
                      <span className="shrink-0 tabular-nums text-muted-foreground">
                        {item.value} {item.unit}
                      </span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-secondary">
                      <div
                        className={cn(
                          "h-full rounded-full bg-primary transition-all duration-500",
                          item.value <= 0 && "opacity-30",
                        )}
                        style={{
                          width: `${maxPower ? Math.max(2, (item.value / maxPower) * 100) : 2}%`,
                        }}
                      />
                    </div>
                  </div>
                ))}
              </Panel>
            ) : (
              <EmptyState description="Keine Leistungssensoren gefunden." />
            )}
          </Section>

          <Section title="Zählerstände">
            {counters.length ? (
              <div className={grids.cards}>
                {counters.map((item) => (
                  <Panel key={item.entity.entity_id} className="flex items-center gap-3 p-4">
                    <IconTile icon={BatteryCharging} tone="accent" />
                    <div className="min-w-0">
                      <p className="stat-value text-lg">
                        {item.value}
                        <span className="ml-1 text-xs font-normal text-muted-foreground">
                          {item.unit}
                        </span>
                      </p>
                      <p className="truncate text-xs text-muted-foreground">
                        {friendlyName(item.entity)}
                      </p>
                    </div>
                  </Panel>
                ))}
              </div>
            ) : (
              <EmptyState description="Keine Energiezähler gefunden." />
            )}
          </Section>

          <Section title="Hinweise">
            <div className="grid gap-3 sm:grid-cols-2">
              <Panel className="flex items-center gap-3 p-4">
                <IconTile icon={Zap} tone="primary" />
                <p className="text-xs text-muted-foreground">
                  Werte kommen direkt aus dem Home-Assistant-WebSocket – ohne zusätzliche Abfragen.
                </p>
              </Panel>
              <Panel className="flex items-center gap-3 p-4">
                <IconTile icon={TrendingUp} tone="accent" />
                <p className="text-xs text-muted-foreground">
                  Wochen- und Monatswerte erscheinen automatisch, sobald entsprechende Zähler in
                  Home Assistant vorhanden sind.
                </p>
              </Panel>
            </div>
          </Section>
        </>
      )}

      {!summary.hasData ? (
        <Section title="Was geprüft wird">
          <Panel className="flex items-center gap-3 p-4">
            <IconTile icon={Gauge} tone="muted" />
            <p className="text-xs text-muted-foreground">
              Gesucht werden Sensoren mit device_class „power“ (Watt) und „energy“ (kWh).
            </p>
          </Panel>
        </Section>
      ) : null}
    </div>
  );
}
