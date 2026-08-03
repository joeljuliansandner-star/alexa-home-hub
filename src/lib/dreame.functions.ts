import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/** Liest alle Saugroboter aus der Dreamehome-Cloud inklusive aller Einstellungen. */
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
        reachable: state?.reachable ?? false,
        battery: state?.battery ?? null,
        statusLabel: state?.label ?? null,
        cleanArea: state?.cleanArea ?? null,
        cleanTime: state?.cleanTime ?? null,
        isRunning: state?.isRunning ?? false,
        error: state?.error ?? null,
        suction: state?.suction ?? null,
        water: state?.water ?? null,
        waterTank: state?.waterTank ?? null,
        volume: state?.volume ?? null,
        carpetBoost: state?.carpetBoost ?? null,
        childLock: state?.childLock ?? null,
        resumeCleaning: state?.resumeCleaning ?? null,
        autoEmpty: state?.autoEmpty ?? null,
        dndEnabled: state?.dndEnabled ?? null,
        dndStart: state?.dndStart ?? null,
        dndEnd: state?.dndEnd ?? null,
        mainBrushLife: state?.mainBrushLife ?? null,
        sideBrushLife: state?.sideBrushLife ?? null,
        filterLife: state?.filterLife ?? null,
      });
    }

    return { vacuums, error: null as string | null };
  });

/** Start, Pause, Ladestation, Suchton oder Absaugen für einen Dreame-Saugroboter. */
export const controlDreameVacuum = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        did: z.string().min(1).max(128),
        action: z.enum(["start", "pause", "dock", "locate", "emptyDustbin"]),
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

/** Ändert eine Einstellung: Saugkraft, Wassermenge, Lautstärke, Nicht stören, … */
export const setDreameSetting = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        did: z.string().min(1).max(128),
        key: z.enum([
          "suction",
          "water",
          "volume",
          "carpetBoost",
          "childLock",
          "resumeCleaning",
          "autoEmpty",
          "dndEnabled",
          "dndStart",
          "dndEnd",
        ]),
        value: z.union([z.number(), z.string().max(16)]),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { dreameLogin, dreameSetProp } = await import("./dreame.server");

    try {
      const session = await dreameLogin();
      const result = await dreameSetProp(session, data.did, data.key, data.value);
      if (result.ok) {
        await context.supabase.from("activity_log").insert({
          user_id: context.userId,
          message: `Dreame-Einstellung: ${data.key} = ${data.value}`,
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

/** Startet die Reinigung ausgewählter Räume (Raumnummern aus der Dreame-Karte). */
export const cleanDreameRooms = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        did: z.string().min(1).max(128),
        roomIds: z.array(z.number().int().min(1).max(64)).min(1).max(16),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { dreameLogin, dreameCleanRooms } = await import("./dreame.server");

    try {
      const session = await dreameLogin();
      const result = await dreameCleanRooms(session, data.did, data.roomIds);
      if (result.ok) {
        await context.supabase.from("activity_log").insert({
          user_id: context.userId,
          message: `Dreame-Raumreinigung: ${data.roomIds.join(", ")}`,
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
