import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Database } from "@/integrations/supabase/types";

type SyncedDevice = {
  name: string;
  model: string;
  online: boolean;
  viaHub: string | null;
  label: string;
};

/** Loads the Tapo cloud incl. hub children (H100 / KH100) into the panel. */
export const syncTapoDevices = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { tapoLogin, tapoDeviceList, tapoChildDevices, kindForModel, isHubDevice, childLabel } =
      await import("./tapo.server");

    const token = await tapoLogin();
    const { devices: cloudDevices, raw: rawDeviceList } = await tapoDeviceList(token);

    let imported = 0;
    let online = 0;
    let hubs = 0;
    let childCount = 0;
    const errors: string[] = [];
    const unsupported: string[] = [];
    const list: SyncedDevice[] = [];
    const rawChildren: Array<{ hub: string; payload: unknown }> = [];
    const hubReports: Array<{
      hub: string;
      model: string;
      cloudSupported: boolean;
      children: number;
      attempts: Array<{ method: string; found: number; ok: boolean; message: string }>;
    }> = [];


    type DevicePayload = Database["public"]["Tables"]["devices"]["Insert"];


    const save = async (payload: DevicePayload, externalId: string) => {
      const { data: existing } = await context.supabase
        .from("devices")
        .select("id")
        .eq("user_id", context.userId)
        .eq("external_id", externalId)
        .maybeSingle();

      const { error } = existing
        ? await context.supabase.from("devices").update(payload).eq("id", existing.id)
        : await context.supabase.from("devices").insert(payload);
      if (error) throw new Error(error.message);
      imported += 1;
    };

    for (const device of cloudDevices) {
      const { kind, label } = kindForModel(device.deviceType, device.deviceModel);
      const hub = isHubDevice(device.deviceType, device.deviceModel);
      if (hub) hubs += 1;
      if (device.isOnline) online += 1;

      await save(
        {
          user_id: context.userId,
          external_id: device.deviceId,
          external_source: "tapo",
          name: device.alias,
          model: device.deviceModel,
          kind,
          manufacturer: device.deviceModel.toUpperCase().startsWith("KH")
            ? "TP-Link Kasa"
            : "TP-Link Tapo",
          alexa_name: device.alias,
          is_online: device.isOnline,
        },
        device.deviceId,
      );

      list.push({
        name: device.alias,
        model: device.deviceModel,
        online: device.isOnline,
        viaHub: null,
        label: hub ? "Steuerzentrale" : label,
      });

      if (!hub) continue;

      const { children, error, raw, attempts, cloudSupported } = await tapoChildDevices(
        token,
        device.deviceId,
      );
      for (const payload of raw) rawChildren.push({ hub: device.alias, payload });
      if (error) errors.push(`${device.alias}: ${error}`);
      hubReports.push({
        hub: device.alias,
        model: device.deviceModel,
        cloudSupported,
        children: children.length,
        attempts,
      });


      for (const child of children) {
        childCount += 1;
        const readable = childLabel(child.model, child.category);
        const childKind =
          readable === "Heizkörperthermostat"
            ? ("thermostat" as const)
            : kindForModel(child.category, child.model).kind;

        if (readable === "Sensor") {
          unsupported.push(`${child.name} (${child.model || "unbekannter Typ"})`);
        }
        if (child.online) online += 1;

        await save(
          {
            user_id: context.userId,
            external_id: child.deviceId,
            external_source: "tapo",
            name: child.name,
            model: child.model,
            kind: childKind,
            manufacturer: `${device.alias} (${readable})`,
            alexa_name: child.name,
            is_online: child.online,
            ...(child.sensorValue !== null
              ? { sensor_value: child.sensorValue, sensor_unit: child.sensorUnit }
              : {}),
          },
          child.deviceId,
        );

        list.push({
          name: child.name,
          model: child.model,
          online: child.online,
          viaHub: device.alias,
          label: readable,
        });
      }
    }

    await context.supabase.from("activity_log").insert({
      user_id: context.userId,
      message: `Tapo-Abgleich: ${imported} Geräte übernommen (${hubs} Steuerzentralen, ${childCount} Untergeräte)`,
    });

    return {
      imported,
      online,
      hubs,
      children: childCount,
      errors,
      unsupported,
      devices: list,
      api: {
        library: "Eigene Implementierung (fetch) – TP-Link Cloud API",
        endpoint: "https://eu-wap.tplinkcloud.com/",
        methods: ["login", "getDeviceList", "passthrough → get_child_device_list"],
      },
      raw: {
        deviceList: JSON.stringify(rawDeviceList, null, 2),
        childLists: rawChildren.map((entry) => ({
          hub: entry.hub,
          payload: JSON.stringify(entry.payload, null, 2),
        })),
      },
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
