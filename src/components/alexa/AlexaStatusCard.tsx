import { Link } from "@tanstack/react-router";
import { Mic } from "lucide-react";

import { IconTile, Panel } from "@/components/kit";
import { useAlexaStatus } from "@/lib/alexa/hooks";

/** Kompakte Alexa-Statuskachel für den Systemstatus im Dashboard. */
export function AlexaStatusCard() {
  const status = useAlexaStatus();
  const info = status.data;
  const connected = Boolean(info?.connected);

  return (
    <Link to="/integration/$integrationId" params={{ integrationId: "alexa" }} className="block">
      <Panel hover className="flex h-full items-center gap-3">
        <IconTile icon={Mic} tone={connected ? "primary" : "muted"} />
        <div className="min-w-0">
          <p className="truncate text-sm font-medium">
            {connected ? `Alexa aktiv · ${info?.deviceCount ?? 0} Geräte` : "Alexa nicht verbunden"}
          </p>
          <p className="truncate text-xs text-muted-foreground">
            {info?.lastSyncAt
              ? `Abgleich ${new Date(info.lastSyncAt).toLocaleString("de-DE", {
                  day: "2-digit",
                  month: "2-digit",
                  hour: "2-digit",
                  minute: "2-digit",
                })}`
              : "Amazon-Konto verbinden"}
          </p>
        </div>
      </Panel>
    </Link>
  );
}
