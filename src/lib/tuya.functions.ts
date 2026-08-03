import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/** Holt alle Smart-Life-/Tuya-Geräte in das Panel. */
export const syncTuyaDevices = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { tuyaToken, tuyaDeviceList, kindForCategory, switchCode, brightnessCode } =
      await import("./tuya.server");

    const token = await tuyaToken();
    const cloudDevices = await tuyaDeviceList(token);

    let imported = 0;
    let online = 0;

    for (const device of cloudDevices) {
      const kind = kindForCategory(device.category);
      if (device.online) online += 1;

      const sw = switchCode(device.status);
      const isOn = sw
        ? Boolean(device.status.find((s) => s.code === sw)?.value)
        : false;

      const bright = brightnessCode(device.status);
      const brightness = bright
        ? Math.round(
            (Number(device.status.find((s) => s.code === bright.code)?.value ?? bright.max) /
              bright.max) *
              100,
          )
        : 100;

      const payload = {
        user_id: context.userId,
        external_id: device.id,
        external_source: "tuya",
        name: device.name,
        model: device.product_name ?? device.category,
        kind,
        manufacturer: "Smart Life / Tuya",
        alexa_name: device.name,
        is_online: device.online,
        is_on: isOn,
        brightness: Math.min(100, Math.max(1, brightness)),
      };

      const { data: existing } = await context.supabase
        .from("devices")
        .select("id")
        .eq("user_id", context.userId)
        .eq("external_id", device.id)
        .maybeSingle();

      const { error } = existing
        ? await context.supabase.from("devices").update(payload).eq("id", existing.id)
        : await context.supabase.from("devices").insert(payload);

      if (error) throw new Error(error.message);
      imported += 1;

    }

    await context.supabase.from("activity_log").insert({
      user_id: context.userId,
      message: `Smart-Life-Abgleich: ${imported} Geräte übernommen`,
    });

    return {
      imported,
      online,
      devices: cloudDevices.map((d) => ({
        name: d.name,
        model: d.product_name ?? d.category,
        online: d.online,
      })),
    };
  });

/** Schaltet bzw. dimmt ein Smart-Life-/Tuya-Gerät über die Cloud. */
export const controlTuyaDevice = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        externalId: z.string().min(1).max(128),
        on: z.boolean().optional(),
        brightness: z.number().int().min(1).max(100).optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { tuyaToken, tuyaDeviceStatus, tuyaSendCommands, switchCode, brightnessCode } =
      await import("./tuya.server");

    const { data: device } = await context.supabase
      .from("devices")
      .select("id")
      .eq("user_id", context.userId)
      .eq("external_id", data.externalId)
      .maybeSingle();
    if (!device) throw new Error("Gerät nicht gefunden");

    const token = await tuyaToken();
    const status = await tuyaDeviceStatus(token, data.externalId);

    const commands: Array<{ code: string; value: unknown }> = [];

    if (data.on !== undefined) {
      const code = switchCode(status);
      if (!code) {
        return { ok: false, message: "Dieses Gerät lässt sich nicht schalten." };
      }
      commands.push({ code, value: data.on });
    }

    if (data.brightness !== undefined) {
      const bright = brightnessCode(status);
      if (bright) {
        commands.push({
          code: bright.code,
          value: Math.max(1, Math.round((data.brightness / 100) * bright.max)),
        });
      }
    }

    if (!commands.length) return { ok: true, message: "Nichts zu tun" };

    try {
      const ok = await tuyaSendCommands(token, data.externalId, commands);
      return ok
        ? { ok: true, message: "Befehl gesendet" }
        : { ok: false, message: "Tuya hat den Befehl abgelehnt." };
    } catch (error) {
      return {
        ok: false,
        message: error instanceof Error ? error.message : "Tuya nicht erreichbar",
      };
    }
  });
