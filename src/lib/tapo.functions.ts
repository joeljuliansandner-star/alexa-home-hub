import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/** Loads the Tapo cloud, mirrors every device into the panel. */
export const syncTapoDevices = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { tapoLogin, tapoDeviceList, kindForModel } = await import("./tapo.server");

    const token = await tapoLogin();
    const cloudDevices = await tapoDeviceList(token);

    let imported = 0;
    let online = 0;

    for (const device of cloudDevices) {
      const { kind } = kindForModel(device.deviceType, device.deviceModel);
      if (device.status === 1) online += 1;

      const payload = {
        user_id: context.userId,
        external_id: device.deviceId,
        external_source: "tapo",
        name: device.alias,
        model: device.deviceModel,
        kind,
        manufacturer: "TP-Link Tapo",
        alexa_name: device.alias,
        is_online: device.status === 1,
      };

      const { data: existing } = await context.supabase
        .from("devices")
        .select("id")
        .eq("user_id", context.userId)
        .eq("external_id", device.deviceId)
        .maybeSingle();

      const { error } = existing
        ? await context.supabase.from("devices").update(payload).eq("id", existing.id)
        : await context.supabase.from("devices").insert(payload);

      if (error) throw new Error(error.message);
      imported += 1;

    }

    await context.supabase.from("activity_log").insert({
      user_id: context.userId,
      message: `Tapo-Abgleich: ${imported} Geräte übernommen`,
    });

    return {
      imported,
      online,
      devices: cloudDevices.map((d) => ({
        name: d.alias,
        model: d.deviceModel,
        online: d.status === 1,
      })),
    };
  });

/** Attempts to switch a Tapo device through the TP-Link cloud. */
export const controlTapoDevice = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({ externalId: z.string().min(1).max(128), on: z.boolean() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { tapoLogin, tapoPassthrough } = await import("./tapo.server");

    const { data: device } = await context.supabase
      .from("devices")
      .select("id")
      .eq("user_id", context.userId)
      .eq("external_id", data.externalId)
      .maybeSingle();
    if (!device) throw new Error("Gerät nicht gefunden");

    const token = await tapoLogin();
    return tapoPassthrough(token, data.externalId, {
      method: "set_device_info",
      params: { device_on: data.on },
    });
  });
