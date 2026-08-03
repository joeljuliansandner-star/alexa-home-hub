import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/** Liest alle Saugroboter aus der Dreamehome-Cloud inklusive Akku und Status. */
export const getDreameVacuums = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async () => {
    const { dreameLogin, dreameDeviceList, dreameGetState } = await import("./dreame.server");

    let session;
    try {
      session = await dreameLogin();
    } catch (error) {
      return {
        vacuums: [],
        error: error instanceof Error ? error.message : "Dreame nicht erreichbar",
      };
    }

    let devices;
    try {
      devices = await dreameDeviceList(session);
    } catch (error) {
      return {
        vacuums: [],
        error: error instanceof Error ? error.message : "Dreame-Geräteliste fehlgeschlagen",
      };
    }

    const vacuums = [];
    for (const device of devices) {
      let state = null;
      try {
        state = await dreameGetState(session, device.did);
      } catch {
        state = null;
      }
      vacuums.push({
        did: device.did,
        name: device.name,
        model: device.model,
        online: device.online,
        battery: state?.battery ?? null,
        statusLabel: state?.label ?? null,
        cleanArea: state?.cleanArea ?? null,
        cleanTime: state?.cleanTime ?? null,
        isRunning: state?.isRunning ?? false,
      });
    }

    return { vacuums, error: null as string | null };
  });

/** Start, Pause, Ladestation oder Suchton für einen Dreame-Saugroboter. */
export const controlDreameVacuum = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        did: z.string().min(1).max(128),
        action: z.enum(["start", "pause", "dock", "locate"]),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { dreameLogin, dreameAction } = await import("./dreame.server");

    try {
      const session = await dreameLogin();
      const result = await dreameAction(session, data.did, data.action);
      if (result.ok) {
        await context.supabase.from("activity_log").insert({
          user_id: context.userId,
          message: `Dreame-Saugroboter: ${data.action}`,
        });
      }
      return result;
    } catch (error) {
      return {
        ok: false,
        message: error instanceof Error ? error.message : "Dreame nicht erreichbar",
      };
    }
  });
