import { useEffect, useRef } from "react";
import { createFileRoute, useNavigate, useSearch } from "@tanstack/react-router";

import { LoadingState, PageHeader, Panel, stacks } from "@/components/kit";
import { Button } from "@/components/ui/button";
import { useAlexaCallback } from "@/lib/alexa/hooks";

type CallbackSearch = {
  code: string | undefined;
  error: string | undefined;
  error_description: string | undefined;
};

export const Route = createFileRoute("/_authenticated/alexa/callback")({
  validateSearch: (search: Record<string, unknown>): CallbackSearch => ({
    code: typeof search["code"] === "string" ? search["code"] : undefined,
    error: typeof search["error"] === "string" ? search["error"] : undefined,
    error_description:
      typeof search["error_description"] === "string" ? search["error_description"] : undefined,
  }),
  component: AlexaCallbackPage,
});

/** Rückkehrseite der Amazon-Anmeldung: tauscht den Code gegen Tokens. */
function AlexaCallbackPage() {
  const search = useSearch({ from: "/_authenticated/alexa/callback" });
  const navigate = useNavigate();
  const callback = useAlexaCallback();
  const started = useRef(false);

  useEffect(() => {
    if (started.current || !search.code) return;
    started.current = true;
    callback.mutate(search.code, {
      onSettled: () => {
        void navigate({ to: "/integration/$integrationId", params: { integrationId: "alexa" } });
      },
    });
  }, [callback, navigate, search.code]);

  if (search.error) {
    return (
      <div className={stacks.page}>
        <PageHeader title="Amazon-Anmeldung" description="Die Anmeldung wurde abgebrochen." />
        <Panel className="space-y-3">
          <p className="text-sm text-destructive">
            {search.error_description ?? search.error}
          </p>
          <Button
            onClick={() =>
              navigate({ to: "/integration/$integrationId", params: { integrationId: "alexa" } })
            }
          >
            Zurück zur Integration
          </Button>
        </Panel>
      </div>
    );
  }

  return <LoadingState />;
}
