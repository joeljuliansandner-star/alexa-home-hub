import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Serverseitiger Weiterleiter für die Home-Assistant-REST-API.
 *
 * Home Assistant erlaubt Browser-Anfragen (CORS) nur von der eigenen Adresse.
 * Deshalb scheitert ein direkter `fetch()` aus der App mit „Failed to fetch“,
 * obwohl die Adresse im Browser einwandfrei funktioniert. Öffentlich
 * erreichbare Instanzen (z. B. Nabu Casa) werden daher über den Server der App
 * angesprochen – dort gibt es keine CORS-Beschränkung.
 */
export const haProxy = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        baseUrl: z.string().min(1),
        token: z.string().min(1),
        path: z.string().default("/"),
        method: z.string().default("GET"),
        body: z.string().nullable().default(null),
      })
      .parse(data),
  )
  .handler(async ({ data }) => {
    const base = data.baseUrl.trim().replace(/\/+$/, "");
    const url = `${base}/api${data.path.startsWith("/") ? data.path : `/${data.path}`}`;

    try {
      const response = await fetch(url, {
        method: data.method,
        headers: {
          Authorization: `Bearer ${data.token}`,
          "Content-Type": "application/json",
        },
        body: data.body,
      });
      const text = await response.text();
      return { ok: response.ok, status: response.status, body: text, error: null as string | null };
    } catch (error) {
      return {
        ok: false,
        status: 0,
        body: "",
        error: error instanceof Error ? error.message : "Netzwerkfehler",
      };
    }
  });
